'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAuth } from './useAuth';

// Returns only the caller's projects for clients, all projects for admins
// (the API scopes the result based on the auth token).
export function useClientProjects() {
  const queryClient = useQueryClient();
  const { getAuthHeaders } = useAuth();

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
  };
}

// Single project by id (used on the detail page).
export function useClientProject(id) {
  const { getAuthHeaders } = useAuth();
  return useQuery({
    queryKey: ['client-projects', id],
    enabled: !!id,
    queryFn: async () => {
      const res = await axios.get(`/api/client-projects/${id}`, {
        headers: getAuthHeaders(),
      });
      return res.data;
    },
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
