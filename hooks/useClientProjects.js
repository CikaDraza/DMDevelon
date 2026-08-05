'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAuth } from './useAuth';

// Returns only the caller's projects for clients, all projects for admins
// (the API scopes the result based on the auth token).
export function useClientProjects() {
  const queryClient = useQueryClient();
  const { getAuthHeaders, isAuthenticated } = useAuth();

  const invalidate = async (projectId) => {
    const invalidations = [
      queryClient.invalidateQueries({ queryKey: ['client-projects'] }),
      queryClient.invalidateQueries({ queryKey: ['notifications'] }),
    ];
    if (projectId) {
      invalidations.push(
        queryClient.invalidateQueries({
          queryKey: ['client-projects', projectId],
        }),
        queryClient.invalidateQueries({
          queryKey: ['project-proposals', projectId],
        }),
      );
    }
    await Promise.all(invalidations);
  };

  const projectsQuery = useQuery({
    queryKey: ['client-projects'],
    enabled: isAuthenticated,
    queryFn: async () => {
      const res = await axios.get('/api/client-projects', {
        headers: getAuthHeaders(),
      });
      return res.data;
    },
  });

  const createProject = useMutation({
    mutationFn: async (data) => {
      const res = await axios.post('/api/client-projects', data, {
        headers: getAuthHeaders(),
      });
      return res.data;
    },
    onSuccess: (project) => invalidate(project?._id),
  });

  const updateProject = useMutation({
    mutationFn: async ({ id, data }) => {
      const res = await axios.put(`/api/client-projects/${id}`, data, {
        headers: getAuthHeaders(),
      });
      return res.data;
    },
    onSuccess: (project, variables) => invalidate(project?._id || variables.id),
  });

  const deleteProject = useMutation({
    mutationFn: async (id) => {
      const res = await axios.delete(`/api/client-projects/${id}`, {
        headers: getAuthHeaders(),
      });
      return res.data;
    },
    onSuccess: (_, id) => invalidate(id),
  });

  // --- Granular (patch-based) progress updates ---
  const updateProjectStatus = useMutation({
    mutationFn: async ({ id, status, publishToHomepage }) => {
      const res = await axios.patch(
        `/api/client-projects/${id}/status`,
        { status, publishToHomepage },
        { headers: getAuthHeaders() },
      );
      return res.data;
    },
    onSuccess: (project, variables) => invalidate(project?._id || variables.id),
  });

  const updateMilestone = useMutation({
    mutationFn: async ({ id, mid, data }) => {
      const res = await axios.patch(
        `/api/client-projects/${id}/milestone/${mid}`,
        data,
        { headers: getAuthHeaders() },
      );
      return res.data;
    },
    onSuccess: (project, variables) => invalidate(project?._id || variables.id),
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, mid, tid, data }) => {
      const res = await axios.patch(
        `/api/client-projects/${id}/milestone/${mid}/task/${tid}`,
        data,
        { headers: getAuthHeaders() },
      );
      return res.data;
    },
    onSuccess: (project, variables) => invalidate(project?._id || variables.id),
  });

  // Full, audited milestone/task edit. Unlike the quick status PATCH above,
  // this endpoint requires changeSummary and records before/after snapshots.
  const updateMilestoneAgreed = useMutation({
    mutationFn: async ({ id, mid, data }) => {
      const res = await axios.put(
        `/api/client-projects/${id}/milestones/${mid}`,
        data,
        { headers: getAuthHeaders() },
      );
      return res.data;
    },
    onSuccess: (project, variables) => invalidate(project?._id || variables.id),
  });

  const addInitialMilestones = useMutation({
    mutationFn: async ({ id, data }) => {
      const res = await axios.put(
        `/api/client-projects/${id}/initial-milestones`,
        data,
        { headers: getAuthHeaders() },
      );
      return res.data;
    },
    onSuccess: (project, variables) => invalidate(project?._id || variables.id),
  });

  return {
    projects: projectsQuery.data || [],
    isLoading: projectsQuery.isLoading,
    error: projectsQuery.error,
    createProject,
    updateProject,
    deleteProject,
    updateProjectStatus,
    updateMilestone,
    updateTask,
    updateMilestoneAgreed,
    addInitialMilestones,
  };
}

// Single project by id (used on the detail page).
export function useClientProject(id) {
  const { getAuthHeaders, loading: authLoading, token } = useAuth();
  return useQuery({
    queryKey: ['client-projects', id],
    // Do not issue an unauthenticated request while the client auth state is
    // still hydrating. The project endpoint itself is the sole source of truth
    // for whether this exact ID exists; the dashboard list is never used to
    // decide that.
    enabled: !!id && !authLoading && !!token,
    queryFn: async () => {
      const res = await axios.get(`/api/client-projects/${id}`, {
        headers: getAuthHeaders(),
      });
      return res.data;
    },
    // A 404 is definitive. Network/server failures are retried before the UI
    // presents its explicit Refresh action.
    retry: (failureCount, error) => {
      const status = error?.response?.status;
      if (status === 404 || status === 401 || status === 403) return false;
      return failureCount < 2;
    },
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 4000),
  });
}

// Per-milestone chat thread + sending (with optional Cloudinary attachments).
export function useProjectMessages(projectId, milestoneId) {
  const queryClient = useQueryClient();
  const { getAuthHeaders } = useAuth();

  const messagesQuery = useQuery({
    queryKey: ['project-messages', projectId, milestoneId],
    enabled: !!projectId && !!milestoneId,
    refetchInterval: 15000,
    // Chat must be live: always pull the latest when the drawer (re)opens
    // instead of serving the 60s-stale global cache.
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: async () => {
      const res = await axios.get(
        `/api/client-projects/${projectId}/messages?milestoneId=${encodeURIComponent(
          milestoneId,
        )}`,
        { headers: getAuthHeaders() },
      );
      return res.data;
    },
  });

  const uploadAttachment = useMutation({
    mutationFn: async ({ file, name, kind = 'chat' }) => {
      const res = await axios.post(
        '/api/upload',
        { file, name, projectId, kind },
        { headers: getAuthHeaders() },
      );
      return res.data; // { url, type, name }
    },
  });

  const sendMessage = useMutation({
    mutationFn: async (data) => {
      const res = await axios.post(
        `/api/client-projects/${projectId}/messages`,
        { milestoneId, ...data },
        { headers: getAuthHeaders() },
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['project-messages', projectId, milestoneId],
      });
    },
  });

  return {
    messages: messagesQuery.data || [],
    isLoading: messagesQuery.isLoading,
    uploadAttachment,
    sendMessage,
  };
}
