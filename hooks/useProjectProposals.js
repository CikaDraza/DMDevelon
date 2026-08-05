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
  const { getAuthHeaders, isAuthenticated } = useAuth();
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
    enabled: enabled && isAuthenticated && !!projectId,
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
    // Accept is the one action whose response already contains the fully
    // reconciled project (with the phase's milestones now materialized).
    // Writing it straight into the cache makes the new milestones appear the
    // instant the client clicks, instead of after the invalidated refetch
    // lands — the difference between "it worked" and "did that do anything?".
    onSuccess: async (data) => {
      if (data?.project?._id) {
        queryClient.setQueryData(["client-projects", projectId], data.project);
      }
      await invalidate();
    },
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
  // Pull a sent proposal back to draft, before the client has answered.
  const withdrawProposal = useProposalLifecycleMutation({
    projectId,
    action: "withdraw",
    getAuthHeaders,
    onSuccess: invalidate,
  });

  // Hard delete, allowed only for a draft or a rejected proposal — nothing
  // has been materialized from either, so there is nothing to unwind.
  const deleteProposal = useMutation({
    mutationFn: async ({ proposalId }) => {
      const response = await axios.delete(proposalUrl(projectId, proposalId), {
        headers: getAuthHeaders(),
      });
      return response.data;
    },
    onSuccess: async () => {
      await invalidate();
      // The originating chat item was just released for another handoff.
      await queryClient.invalidateQueries({ queryKey: ["project-items"] });
    },
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
    withdrawProposal,
    deleteProposal,
    createRevision,
  };
}
