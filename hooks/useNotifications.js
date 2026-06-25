'use client';

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
      // payload: { id } | { entityId } | {} (all)
      const res = await axios.post('/api/notifications/read', payload, {
        headers: getAuthHeaders(),
      });
      return res.data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const items = query.data?.items || [];
  // Entities (request/project ids) that have at least one unread notification
  const unreadEntityIds = new Set(
    items.filter((n) => !n.read && n.entityId).map((n) => n.entityId),
  );

  return {
    items,
    unreadCount: query.data?.unreadCount || 0,
    isLoading: query.isLoading,
    markRead,
    unreadEntityIds,
  };
}
