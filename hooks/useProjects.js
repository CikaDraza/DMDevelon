'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAuth } from './useAuth';

export function useProjects(category = null) {
  const queryClient = useQueryClient();
  const { getAuthHeaders } = useAuth();

  const projectsQuery = useQuery({
    queryKey: ['projects', category],
    queryFn: async () => {
      const params = category && category !== 'all' ? `?category=${encodeURIComponent(category)}` : '';
      const response = await axios.get(`/api/projects${params}`);
      return response.data;
    },
  });

  const createProject = useMutation({
    mutationFn: async (data) => {
      const response = await axios.post('/api/projects', data, {
        headers: getAuthHeaders(),
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  const updateProject = useMutation({
    mutationFn: async ({ id, data }) => {
      const response = await axios.put(`/api/projects/${id}`, data, {
        headers: getAuthHeaders(),
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  const deleteProject = useMutation({
    mutationFn: async (id) => {
      const response = await axios.delete(`/api/projects/${id}`, {
        headers: getAuthHeaders(),
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  return {
    projects: projectsQuery.data || [],
    isLoading: projectsQuery.isLoading,
    error: projectsQuery.error,
    createProject,
    updateProject,
    deleteProject,
  };
}
