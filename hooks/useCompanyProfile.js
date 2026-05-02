"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useAuth } from "./useAuth";

export function useCompanyProfile() {
  const queryClient = useQueryClient();
  const { getAuthHeaders } = useAuth();

  // GET company profile (public)
  const profileQuery = useQuery({
    queryKey: ["company-profile"],
    queryFn: async () => {
      const { data } = await axios.get("/api/company-profile");
      return data;
    },
  });

  // UPDATE company profile (admin only)
  const updateProfile = useMutation({
    mutationFn: async (profileData) => {
      const { data } = await axios.put("/api/company-profile", profileData, {
        headers: getAuthHeaders(),
      });
      return data;
    },
    onSuccess: (updatedData) => {
      // Update cache with new data
      queryClient.setQueryData(["company-profile"], updatedData);
      // Optionally invalidate to refetch from server
      // queryClient.invalidateQueries({ queryKey: ['company-profile'] });
    },
  });

  return {
    profile: profileQuery.data,
    isLoading: profileQuery.isLoading,
    error: profileQuery.error,
    updateProfile,
    isUpdating: updateProfile.isPending,
  };
}
