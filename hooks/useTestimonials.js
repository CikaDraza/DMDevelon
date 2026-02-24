'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAuth } from './useAuth';

export function useTestimonials() {
  const queryClient = useQueryClient();
  const { getAuthHeaders } = useAuth();

  const testimonialsQuery = useQuery({
    queryKey: ['testimonials'],
    queryFn: async () => {
      const response = await axios.get('/api/testimonials');
      return response.data;
    },
  });

  const createTestimonial = useMutation({
    mutationFn: async (data) => {
      const response = await axios.post('/api/testimonials', data, {
        headers: getAuthHeaders(),
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['testimonials'] });
    },
  });

  const updateTestimonial = useMutation({
    mutationFn: async ({ id, data }) => {
      const response = await axios.put(`/api/testimonials/${id}`, data, {
        headers: getAuthHeaders(),
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['testimonials'] });
    },
  });

  const deleteTestimonial = useMutation({
    mutationFn: async (id) => {
      const response = await axios.delete(`/api/testimonials/${id}`, {
        headers: getAuthHeaders(),
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['testimonials'] });
    },
  });

  return {
    testimonials: testimonialsQuery.data || [],
    isLoading: testimonialsQuery.isLoading,
    error: testimonialsQuery.error,
    createTestimonial,
    updateTestimonial,
    deleteTestimonial,
  };
}
