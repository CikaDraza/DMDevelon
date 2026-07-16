"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useAuth } from "./useAuth";

function proposalUrl(projectId, proposalId, action) {
  const base = `/api/client-projects/${projectId}/proposals`;
  if (!proposalId) return base;
  return `${base}/${proposalId}${action ? `/${action}` : ""}`;
}

function useProposalLifecycleMutation({
  projectId,
  action,
  getAuthHeaders,
  onSuccess,
}) {
  return useMutation({
    mutationFn: async ({ proposalId, data = {} }) => {
      const response = await axios.post(
        proposalUrl(projectId, proposalId, action),
        data,
        { headers: getAuthHeaders() },
      );
      return response.data;
    },
    onSuccess,
  });
}

/**
 * Project proposal lifecycle for both the admin and client project views.
 * The API is responsible for filtering drafts for non-admin users.
 */
export function useProjectProposals(projectId, { enabled = true } = {}) {
  const queryClient = useQueryClient();
  const { getAuthHeaders } = useAuth();
  const queryKey = ["project-proposals", projectId];

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["client-projects"] }),
      queryClient.invalidateQueries({
        queryKey: ["client-projects", projectId],
      }),
      queryClient.invalidateQueries({ queryKey }),
      queryClient.invalidateQueries({ queryKey: ["notifications"] }),
      queryClient.invalidateQueries({
        queryKey: ["project-messages", projectId],
      }),
    ]);
  };

  const proposalsQuery = useQuery({
    queryKey,
    enabled: enabled && !!projectId,
    queryFn: async () => {
      const response = await axios.get(proposalUrl(projectId), {
        headers: getAuthHeaders(),
      });
      return Array.isArray(response.data)
        ? response.data
        : response.data?.proposals || [];
    },
  });

  const createProposal = useMutation({
    mutationFn: async (data) => {
      const response = await axios.post(proposalUrl(projectId), data, {
        headers: getAuthHeaders(),
      });
      return response.data;
    },
    onSuccess: invalidate,
  });

  const updateProposal = useMutation({
    mutationFn: async ({ proposalId, data }) => {
      const response = await axios.patch(
        proposalUrl(projectId, proposalId),
        data,
        { headers: getAuthHeaders() },
      );
      return response.data;
    },
    onSuccess: invalidate,
  });

  const sendProposal = useProposalLifecycleMutation({
    projectId,
    action: "send",
    getAuthHeaders,
    onSuccess: invalidate,
  });
  const acceptProposal = useProposalLifecycleMutation({
    projectId,
    action: "accept",
    getAuthHeaders,
    onSuccess: invalidate,
  });
  const requestChanges = useProposalLifecycleMutation({
    projectId,
    action: "request-changes",
    getAuthHeaders,
    onSuccess: invalidate,
  });
  const rejectProposal = useProposalLifecycleMutation({
    projectId,
    action: "reject",
    getAuthHeaders,
    onSuccess: invalidate,
  });
  const archiveProposal = useProposalLifecycleMutation({
    projectId,
    action: "archive",
    getAuthHeaders,
    onSuccess: invalidate,
  });

  // Revisions are created as new drafts through the collection endpoint. The
  // server copies only safe proposal fields and links the source snapshot.
  const createRevision = useMutation({
    mutationFn: async ({ proposalId, data = {} }) => {
      const response = await axios.post(
        proposalUrl(projectId),
        { ...data, sourceProposalId: proposalId },
        { headers: getAuthHeaders() },
      );
      return response.data;
    },
    onSuccess: invalidate,
  });

  return {
    proposals: proposalsQuery.data || [],
    isLoading: proposalsQuery.isLoading,
    error: proposalsQuery.error,
    refetch: proposalsQuery.refetch,
    createProposal,
    updateProposal,
    sendProposal,
    acceptProposal,
    requestChanges,
    rejectProposal,
    archiveProposal,
    createRevision,
  };
}
