'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAuth } from './useAuth';

// Formal records ("Convert to…") for one project: ideas, problems,
// incidents, decisions. Creation happens through useChatMessages'
// convertMessage mutation; what lives here is reading them back and acting
// on one afterwards (deciding its status, or turning it into real work).
export function useProjectItems(projectId, { kind } = {}) {
  const queryClient = useQueryClient();
  const { getAuthHeaders, isAuthenticated } = useAuth();

  const invalidate = () => {
    // Prefix match: refreshes every {kind} variant for this project, not
    // just the filter currently on screen.
    queryClient.invalidateQueries({ queryKey: ['project-items', projectId] });
  };

  const query = useQuery({
    queryKey: ['project-items', projectId, kind || 'all'],
    enabled: isAuthenticated && !!projectId,
    queryFn: async () => {
      const params = new URLSearchParams({ projectId });
      if (kind) params.set('kind', kind);
      const res = await axios.get(`/api/project-items?${params.toString()}`, {
        headers: getAuthHeaders(),
      });
      return res.data;
    },
  });

  // Operator-only (`itemsApprove`). Setting the status to "accepted" also
  // co-signs the record server-side — see sanitizeProjectItemUpdate.
  const decideItem = useMutation({
    mutationFn: async ({ itemId, status }) => {
      const res = await axios.patch(
        `/api/project-items/${itemId}`,
        { status },
        { headers: getAuthHeaders() },
      );
      return res.data;
    },
    onSuccess: invalidate,
  });

  // Turn an item into a milestone task (owner + admin). Invalidates the
  // project caches too, since a milestone just grew a task.
  const promoteToTask = useMutation({
    mutationFn: async ({ itemId, milestoneId }) => {
      const res = await axios.post(
        `/api/project-items/${itemId}/task`,
        { milestoneId },
        { headers: getAuthHeaders() },
      );
      return res.data;
    },
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['client-projects'] });
      // Also the detail query a mounted project page reads from — the bare
      // prefix above does match it, but naming it keeps that intentional.
      queryClient.invalidateQueries({
        queryKey: ['client-projects', projectId],
      });
    },
  });

  // Hand the item off as NEW billable work: creates a DRAFT phase proposal.
  // It does not create a live phase or milestone — the admin prices it and
  // sends it, and only the client's acceptance materializes the work.
  const handOffAsWork = useMutation({
    mutationFn: async ({ itemId, ...payload }) => {
      const res = await axios.post(
        `/api/project-items/${itemId}/handoff`,
        payload,
        { headers: getAuthHeaders() },
      );
      return res.data;
    },
    onSuccess: () => {
      invalidate();
      // Scoped to this project, not the bare prefix: a bare
      // ['project-proposals'] invalidation refetches every project's
      // proposals that happens to be mounted.
      queryClient.invalidateQueries({
        queryKey: ['project-proposals', projectId],
      });
    },
  });

  return {
    items: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    decideItem,
    promoteToTask,
    handOffAsWork,
  };
}
