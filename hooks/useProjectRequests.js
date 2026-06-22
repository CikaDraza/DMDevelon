'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAuth } from './useAuth';

// List + admin actions. API scopes the list by the auth token
// (admin -> all, client -> own).
export function useProjectRequests() {
  const queryClient = useQueryClient();
  const { getAuthHeaders } = useAuth();

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['project-requests'] });

  const requestsQuery = useQuery({
    queryKey: ['project-requests'],
    queryFn: async () => {
      const res = await axios.get('/api/project-requests', {
        headers: getAuthHeaders(),
      });
      return res.data;
    },
  });

  const createRequest = useMutation({
    mutationFn: async (data) => {
      const res = await axios.post('/api/project-requests', data, {
        headers: getAuthHeaders(),
      });
      return res.data;
    },
    onSuccess: invalidate,
  });

  const convertFromMessage = useMutation({
    mutationFn: async (fromMessageId) => {
      const res = await axios.post(
        '/api/project-requests',
        { fromMessageId },
        { headers: getAuthHeaders() },
      );
      return res.data;
    },
    onSuccess: invalidate,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }) => {
      const res = await axios.patch(
        `/api/project-requests/${id}/status`,
        { status },
        { headers: getAuthHeaders() },
      );
      return res.data;
    },
    onSuccess: invalidate,
  });

  const saveProposal = useMutation({
    mutationFn: async ({ id, data }) => {
      const res = await axios.put(
        `/api/project-requests/${id}/proposal`,
        data,
        { headers: getAuthHeaders() },
      );
      return res.data;
    },
    onSuccess: invalidate,
  });

  const deleteRequest = useMutation({
    mutationFn: async (id) => {
      const res = await axios.delete(`/api/project-requests/${id}`, {
        headers: getAuthHeaders(),
      });
      return res.data;
    },
    onSuccess: invalidate,
  });

  return {
    requests: requestsQuery.data || [],
    isLoading: requestsQuery.isLoading,
    error: requestsQuery.error,
    createRequest,
    convertFromMessage,
    updateStatus,
    saveProposal,
    deleteRequest,
  };
}

// Single request (thread) + per-request actions.
export function useProjectRequest(id) {
  const queryClient = useQueryClient();
  const { getAuthHeaders } = useAuth();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['project-requests', id] });
    queryClient.invalidateQueries({ queryKey: ['project-requests'] });
  };

  const requestQuery = useQuery({
    queryKey: ['project-requests', id],
    enabled: !!id,
    refetchInterval: 15000,
    queryFn: async () => {
      const res = await axios.get(`/api/project-requests/${id}`, {
        headers: getAuthHeaders(),
      });
      return res.data;
    },
  });

  const uploadAttachment = useMutation({
    mutationFn: async ({ file, name, kind = 'chat' }) => {
      const res = await axios.post(
        '/api/upload',
        { file, name, requestId: id, kind },
        { headers: getAuthHeaders() },
      );
      return res.data; // { url, type, name }
    },
  });

  const postMessage = useMutation({
    mutationFn: async (data) => {
      const res = await axios.post(
        `/api/project-requests/${id}/messages`,
        data,
        { headers: getAuthHeaders() },
      );
      return res.data;
    },
    onSuccess: invalidate,
  });

  const accept = useMutation({
    mutationFn: async () => {
      const res = await axios.post(
        `/api/project-requests/${id}/accept`,
        {},
        { headers: getAuthHeaders() },
      );
      return res.data; // { projectId, request }
    },
    onSuccess: invalidate,
  });

  const requestChanges = useMutation({
    mutationFn: async (data) => {
      const res = await axios.post(
        `/api/project-requests/${id}/request-changes`,
        data,
        { headers: getAuthHeaders() },
      );
      return res.data;
    },
    onSuccess: invalidate,
  });

  return {
    request: requestQuery.data,
    isLoading: requestQuery.isLoading,
    error: requestQuery.error,
    uploadAttachment,
    postMessage,
    accept,
    requestChanges,
  };
}
