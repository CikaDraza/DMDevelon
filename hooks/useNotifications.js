'use client';

import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAuth } from './useAuth';

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
      //       excludeProposals?: true } | {} (all)
      const res = await axios.post('/api/notifications/read', payload, {
        headers: getAuthHeaders(),
      });
      return res.data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  // Each time the notifications poll lands, refresh any open milestone chat so
  // the new message appears together with its notification (not a poll later).
  useEffect(() => {
    if (!query.dataUpdatedAt) return;
    queryClient.invalidateQueries({ queryKey: ['project-messages'] });
  }, [query.dataUpdatedAt, queryClient]);

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
