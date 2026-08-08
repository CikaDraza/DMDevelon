'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAuth } from './useAuth';

// The server's page size. Kept here as the single source of truth: the
// pagination cursor logic below and the prefetch helper both need it, and two
// copies would drift.
export const CHAT_PAGE_SIZE = 50;

/**
 * The exact React Query key `useChatMessages` uses. Exported so a prefetch
 * writes into the same cache entry the mounted thread will read — a key that
 * is merely "similar" would prefetch into a slot nothing ever looks at.
 */
export function chatMessagesQueryKey(channelId, { flag, q } = {}) {
  return ['chat-messages', channelId, { flag: flag || 'all', q: q || '' }];
}

// One page fetch, shared by the hook and the prefetcher. `flag`/`q` default to
// the unfiltered view — the prefetcher only ever primes that one.
async function fetchChatMessagePage({
  channelId,
  pageParam = null,
  flag = null,
  q = "",
  headers,
}) {
  const params = new URLSearchParams();
  if (pageParam) params.set('before', pageParam);
  if (flag && flag !== 'all') {
    // "attachment:image"/"attachment:document" are the one filter value that
    // isn't a message flag — translate to the server's separate attachmentType
    // param (image|pdf) instead of sending it as `flag`.
    if (flag.startsWith('attachment:')) {
      params.set(
        'attachmentType',
        flag === 'attachment:image' ? 'image' : 'pdf',
      );
    } else {
      params.set('flag', flag);
    }
  }
  if (q) params.set('q', q);
  const res = await axios.get(
    `/api/chat/channels/${channelId}/messages?${params.toString()}`,
    { headers },
  );
  return res.data; // oldest-first within this page
}

// Every channel visible to the caller, with unread count and a last-message
// preview already attached (GET /api/chat/channels does the lazy group-
// channel creation and the DM privacy filtering server-side — this hook is a
// thin wrapper).
export function useChatChannels() {
  const queryClient = useQueryClient();
  const { getAuthHeaders, isAuthenticated } = useAuth();

  const channelsQuery = useQuery({
    queryKey: ['chat-channels'],
    enabled: isAuthenticated,
    refetchInterval: 15000,
    queryFn: async () => {
      const res = await axios.get('/api/chat/channels', {
        headers: getAuthHeaders(),
      });
      return res.data;
    },
  });

  // Get-or-create a direct message with a fellow project participant. The
  // server rejects a target with no relationship to the project — this is
  // not a way to message an arbitrary stranger.
  const startDirectMessage = useMutation({
    mutationFn: async ({ projectId, userId }) => {
      const res = await axios.post(
        '/api/chat/dm',
        { projectId, userId },
        { headers: getAuthHeaders() },
      );
      return res.data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['chat-channels'] }),
  });

  return {
    channels: channelsQuery.data || [],
    isLoading: channelsQuery.isLoading,
    error: channelsQuery.error,
    startDirectMessage,
  };
}

/**
 * Warm the latest page of every visible channel once, so switching channels
 * paints instantly instead of showing "Loading…" on each first visit.
 *
 * Deliberately narrow so this does not become a second polling budget (I8):
 *  - each channel is prefetched AT MOST ONCE per session (`primedRef`),
 *  - only the unfiltered view is primed, which is the one a channel opens in,
 *  - `staleTime` keeps the mounted thread's own 4s poll as the only repeat
 *    traffic — a prefetch never schedules anything of its own.
 * `MAX_PREFETCH` bounds the burst for an operator whose sidebar lists every
 * project on the platform.
 */
const MAX_PREFETCH = 12;

export function usePrefetchChannelMessages(channels) {
  const queryClient = useQueryClient();
  const { getAuthHeaders, isAuthenticated } = useAuth();
  const primedRef = useRef(new Set());

  useEffect(() => {
    if (!isAuthenticated || !Array.isArray(channels) || channels.length === 0) {
      return;
    }
    const todo = channels
      .filter((c) => c?._id && !primedRef.current.has(c._id))
      .slice(0, MAX_PREFETCH);
    if (todo.length === 0) return;

    for (const channel of todo) {
      primedRef.current.add(channel._id);
      queryClient
        .prefetchInfiniteQuery({
          queryKey: chatMessagesQueryKey(channel._id),
          initialPageParam: null,
          staleTime: 4000,
          queryFn: ({ pageParam }) =>
            fetchChatMessagePage({
              channelId: channel._id,
              pageParam,
              headers: getAuthHeaders(),
            }),
        })
        .catch(() => {
          // A channel that fails to prime just loads normally when opened;
          // allow a later attempt rather than marking it done forever.
          primedRef.current.delete(channel._id);
        });
    }
  }, [channels, isAuthenticated, queryClient, getAuthHeaders]);
}

// Pinned messages for one channel — its own small query since the pinned bar
// (Section 11) renders independently of the main scroll-back thread below.
export function useChatPinned(channelId) {
  const { getAuthHeaders, isAuthenticated } = useAuth();
  const pinnedQuery = useQuery({
    queryKey: ['chat-pinned', channelId],
    enabled: isAuthenticated && !!channelId,
    queryFn: async () => {
      const res = await axios.get(`/api/chat/channels/${channelId}/pinned`, {
        headers: getAuthHeaders(),
      });
      return res.data;
    },
  });
  return {
    pinned: pinnedQuery.data || [],
    isLoading: pinnedQuery.isLoading,
  };
}

// One channel's message thread, with backward pagination for scroll-up
// history, plus every mutation the composer/message list needs.
//
// Pages are fetched newest-first (page 0 = latest 50, oldest-first within
// that batch); `getNextPageParam` asks the server for whatever is older than
// the oldest message currently loaded. `messages` below un-reverses the page
// order so the caller always gets one flat, oldest-to-newest array.
export function useChatMessages(channelId, { flag, q } = {}) {
  const queryClient = useQueryClient();
  const { getAuthHeaders, isAuthenticated } = useAuth();

  const invalidate = () => {
    // A prefix match: invalidates every {flag, q} variant of this channel's
    // messages, not just the one currently on screen.
    queryClient.invalidateQueries({ queryKey: ['chat-messages', channelId] });
    queryClient.invalidateQueries({ queryKey: ['chat-channels'] });
  };

  const messagesQuery = useInfiniteQuery({
    queryKey: chatMessagesQueryKey(channelId, { flag, q }),
    enabled: isAuthenticated && !!channelId,
    refetchInterval: 4000,
    // `staleTime: 0` + `refetchOnMount: 'always'` used to mean a prefetched or
    // cached channel STILL showed "Loading…" on open. A short staleTime lets
    // the primed page paint immediately while the 4s poll (and the
    // notification poll's invalidation) keep it fresh — the freshness budget
    // is unchanged, only the blank frame is gone.
    staleTime: 3000,
    refetchOnMount: true,
    initialPageParam: null,
    queryFn: ({ pageParam }) =>
      fetchChatMessagePage({
        channelId,
        pageParam,
        flag,
        q,
        headers: getAuthHeaders(),
      }),
    // A page shorter than the server's limit means there is nothing older
    // left to fetch.
    getNextPageParam: (lastPage) => {
      if (!Array.isArray(lastPage) || lastPage.length < CHAT_PAGE_SIZE) {
        return undefined;
      }
      return lastPage[0]?.createdAt;
    },
  });

  // pages[0] is the newest batch (fetched first), pages[N] the oldest
  // (fetched last via fetchNextPage) — reverse the page order, keep each
  // page's own oldest-first order, to get one chronological array.
  //
  // Memoized on the pages array identity: React Query only replaces that
  // identity when the data actually changed, so an unchanged 4s poll no longer
  // hands MessageList a brand-new array and re-render every list item.
  const messages = useMemo(
    () =>
      (messagesQuery.data?.pages || [])
        .slice()
        .reverse()
        .flat(),
    [messagesQuery.data?.pages],
  );

  const sendMessage = useMutation({
    mutationFn: async (data) => {
      const res = await axios.post(
        `/api/chat/channels/${channelId}/messages`,
        data,
        { headers: getAuthHeaders() },
      );
      return res.data;
    },
    onSuccess: invalidate,
  });

  const editMessage = useMutation({
    mutationFn: async ({ messageId, body }) => {
      const res = await axios.patch(
        `/api/chat/messages/${messageId}`,
        { body },
        { headers: getAuthHeaders() },
      );
      return res.data;
    },
    onSuccess: invalidate,
  });

  const deleteMessage = useMutation({
    mutationFn: async (messageId) => {
      const res = await axios.delete(`/api/chat/messages/${messageId}`, {
        headers: getAuthHeaders(),
      });
      return res.data;
    },
    onSuccess: invalidate,
  });

  const togglePin = useMutation({
    mutationFn: async ({ messageId, pinned }) => {
      const res = await axios.post(
        `/api/chat/messages/${messageId}/pin`,
        { pinned },
        { headers: getAuthHeaders() },
      );
      return res.data;
    },
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['chat-pinned', channelId] });
    },
  });

  const markRead = useMutation({
    mutationFn: async (messageId) => {
      const res = await axios.post(
        `/api/chat/channels/${channelId}/read`,
        messageId ? { messageId } : {},
        { headers: getAuthHeaders() },
      );
      return res.data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['chat-channels'] }),
  });

  const clearConversation = useMutation({
    mutationFn: async () => {
      const res = await axios.post(
        `/api/chat/channels/${channelId}/clear`,
        {},
        { headers: getAuthHeaders() },
      );
      return res.data;
    },
    onSuccess: invalidate,
  });

  // projectId is passed at call time (the caller already has it from the
  // channel object) rather than baked into this hook's own parameters, so
  // this hook's signature stays exactly `(channelId, { flag, q })`.
  const uploadAttachment = useMutation({
    mutationFn: async ({ file, name, projectId, kind = 'chat' }) => {
      const res = await axios.post(
        '/api/upload',
        { file, name, projectId, kind },
        { headers: getAuthHeaders() },
      );
      return res.data; // { url, type, name }
    },
  });

  // "Convert to…" (Section 12) — `payload` shape depends entirely on
  // `target` (see sanitizeConvertPayload in lib/chat-domain.mjs): item needs
  // kind/title(/severity), task/milestone_comment need milestoneId(/title),
  // request needs title. Invalidates project-items too, since a successful
  // convert may have just created one.
  const convertMessage = useMutation({
    mutationFn: async ({ messageId, target, ...payload }) => {
      const res = await axios.post(
        `/api/chat/messages/${messageId}/convert`,
        { target, ...payload },
        { headers: getAuthHeaders() },
      );
      return res.data; // { message, target, created }
    },
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['project-items'] });
    },
  });

  return {
    messages,
    isLoading: messagesQuery.isLoading,
    error: messagesQuery.error,
    hasMoreHistory: !!messagesQuery.hasNextPage,
    isLoadingMoreHistory: messagesQuery.isFetchingNextPage,
    loadMoreHistory: messagesQuery.fetchNextPage,
    sendMessage,
    editMessage,
    deleteMessage,
    togglePin,
    markRead,
    clearConversation,
    uploadAttachment,
    convertMessage,
  };
}
