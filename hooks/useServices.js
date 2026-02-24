'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAuth } from './useAuth';

export function useServices() {
  const queryClient = useQueryClient();
  const { getAuthHeaders } = useAuth();

  const servicesQuery = useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      const response = await axios.get('/api/services');
      return response.data;
    },
  });

  const createService = useMutation({
    mutationFn: async (data) => {
      const response = await axios.post('/api/services', data, {
        headers: getAuthHeaders(),
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
    },
  });

  const updateService = useMutation({
    mutationFn: async ({ id, data }) => {
      const response = await axios.put(`/api/services/${id}`, data, {
        headers: getAuthHeaders(),
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
    },
  });

  const deleteService = useMutation({
    mutationFn: async (id) => {
      const response = await axios.delete(`/api/services/${id}`, {
        headers: getAuthHeaders(),
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
    },
  });

  return {
    services: servicesQuery.data || [],
    isLoading: servicesQuery.isLoading,
    error: servicesQuery.error,
    createService,
    updateService,
    deleteService,
  };
}
