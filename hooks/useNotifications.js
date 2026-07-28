'use client';

import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from './useAuth';

// Never announce more than this at once — a burst that big is better read in
// the bell than thrown on screen one toast at a time.
const MAX_TOASTS_PER_POLL = 3;

// Announced notification ids, deliberately MODULE-level rather than per-hook.
// This hook is mounted by up to seven components at once (the bell, the
// dashboard, the admin managers, the chat list…), all sharing one query
// cache — per-instance state would toast the same message once per mount.
// `null` means "no poll has been seen yet this session", so the first result
// is only recorded, never announced: nobody wants their backlog thrown at
// them on page load.
let announcedIds = null;

if (typeof window !== 'undefined') {
  // A different account must not inherit the previous one's seen-set.
  window.addEventListener('dmdevelon:session-cleared', () => {
    announcedIds = null;
  });
}

export function useNotifications() {
  const queryClient = useQueryClient();
  const { getAuthHeaders, isAuthenticated } = useAuth();

  const query = useQuery({
    queryKey: ['notifications'],
    enabled: isAuthenticated,
    refetchInterval: 30000,
    queryFn: async () => {
      const res = await axios.get('/api/notifications', {
        headers: getAuthHeaders(),
      });
      return res.data; // { items, unreadCount }
    },
  });

  const markRead = useMutation({
    mutationFn: async (payload = {}) => {
      // payload: { id } | { entityId } | { entityId, milestoneId }
      //   | { entityId, proposalId } | { entityId, excludeMilestones: true,
      //       excludeProposals?: true } | { channelId } | {} (all)
      const res = await axios.post('/api/notifications/read', payload, {
        headers: getAuthHeaders(),
      });
      return res.data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  // Each time the notifications poll lands, refresh the data behind whatever
  // it just told us about, so the page agrees with the bell.
  //
  // This poll is the app's only cross-browser sync signal — there is no
  // websocket, and NONE of these query keys poll on their own. Without the
  // project/proposal keys here, a client accepting a phase left the admin
  // looking at stale milestones until they manually refreshed (and vice
  // versa: an admin sending a proposal didn't appear for the client).
  // Piggybacking costs no extra requests: it only refetches keys that are
  // actually mounted.
  useEffect(() => {
    if (!query.dataUpdatedAt) return;
    queryClient.invalidateQueries({ queryKey: ['project-messages'] });
    queryClient.invalidateQueries({ queryKey: ['chat-messages'] });
    queryClient.invalidateQueries({ queryKey: ['client-projects'] });
    queryClient.invalidateQueries({ queryKey: ['project-proposals'] });
    queryClient.invalidateQueries({ queryKey: ['project-items'] });
  }, [query.dataUpdatedAt, queryClient]);

  // Announce genuinely new arrivals in-app. Until now nothing surfaced an
  // inbound event except the bell badge and an OS push — so with push
  // declined (or suppressed because you're online) a message could land with
  // no visible sign at all. Toasts are the channel that is never throttled.
  useEffect(() => {
    const items = query.data?.items;
    if (!Array.isArray(items)) return;

    if (announcedIds === null) {
      announcedIds = new Set(items.map((n) => n._id));
      return;
    }

    const fresh = items.filter((n) => !announcedIds.has(n._id) && !n.read);
    // Mark everything seen BEFORE toasting, so a second mounted instance
    // running the same effect on the same data finds nothing left to say.
    for (const n of items) announcedIds.add(n._id);

    // items arrive newest-first; announce oldest-first so the newest ends up
    // on top of the stack.
    for (const n of fresh.slice(0, MAX_TOASTS_PER_POLL).reverse()) {
      toast(n.title, { icon: '🔔', duration: 5000 });
    }
    if (fresh.length > MAX_TOASTS_PER_POLL) {
      toast(`+${fresh.length - MAX_TOASTS_PER_POLL} more notifications`, {
        icon: '🔔',
        duration: 5000,
      });
    }
  }, [query.data]);

  const items = query.data?.items || [];
  // Entities (request/project ids) that have at least one unread notification
  const unreadEntityIds = new Set(
    items.filter((n) => !n.read && n.entityId).map((n) => n.entityId),
  );
  // Milestones with at least one unread chat message (drives the pulsing bubble)
  const unreadMilestoneIds = new Set(
    items.filter((n) => !n.read && n.milestoneId).map((n) => n.milestoneId),
  );
  const unreadProposalIds = new Set(
    items.filter((n) => !n.read && n.proposalId).map((n) => n.proposalId),
  );
  // Latest unread notification per milestone (items are sorted newest-first),
  // so callers can show its preview as a badge next to the chat icon.
  const unreadByMilestone = {};
  const unreadByProposal = {};
  for (const n of items) {
    if (!n.read && n.milestoneId && !unreadByMilestone[n.milestoneId]) {
      unreadByMilestone[n.milestoneId] = n;
    }
    if (!n.read && n.proposalId && !unreadByProposal[n.proposalId]) {
      unreadByProposal[n.proposalId] = n;
    }
  }
  // No unreadChannelIds/unreadByChannel here, unlike milestones/proposals
  // above: chat already has a purpose-built, per-user read-receipt system
  // (ChatRead, Section 6) that GET /chat/channels turns into a precise
  // unreadCount per channel. Milestones/proposals have no such mechanism —
  // this Notification-based tally is the only unread signal they get. Adding
  // a second, notification-based tally for chat would just be a less
  // accurate shadow of what useChatChannels() already provides.

  return {
    items,
    unreadCount: query.data?.unreadCount || 0,
    isLoading: query.isLoading,
    markRead,
    unreadEntityIds,
    unreadMilestoneIds,
    unreadByMilestone,
    unreadProposalIds,
    unreadByProposal,
  };
}
