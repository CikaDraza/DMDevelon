'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAuth } from './useAuth';

// Team roster + invitations for one project. GET /api/client-projects/:id/members
// already scopes pending invitations to whoever can invite, and private
// emails to owner/admin — this hook just exposes what the server returns.
export function useProjectMembers(projectId) {
  const queryClient = useQueryClient();
  const { getAuthHeaders, isAuthenticated } = useAuth();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['project-members', projectId] });
  };

  const membersQuery = useQuery({
    queryKey: ['project-members', projectId],
    enabled: isAuthenticated && !!projectId,
    queryFn: async () => {
      const res = await axios.get(
        `/api/client-projects/${projectId}/members`,
        { headers: getAuthHeaders() },
      );
      return res.data; // { members, invitations }
    },
  });

  const invite = useMutation({
    mutationFn: async (data) => {
      // { email, intendedRole, roleLabel?, personalMessage? }
      const res = await axios.post(
        `/api/client-projects/${projectId}/invitations`,
        data,
        { headers: getAuthHeaders() },
      );
      return res.data;
    },
    onSuccess: invalidate,
  });

  const resendInvitation = useMutation({
    mutationFn: async (invitationId) => {
      const res = await axios.post(
        `/api/client-projects/${projectId}/invitations/${invitationId}/resend`,
        {},
        { headers: getAuthHeaders() },
      );
      return res.data;
    },
    onSuccess: invalidate,
  });

  const revokeInvitation = useMutation({
    mutationFn: async (invitationId) => {
      const res = await axios.delete(
        `/api/client-projects/${projectId}/invitations/${invitationId}`,
        { headers: getAuthHeaders() },
      );
      return res.data;
    },
    onSuccess: invalidate,
  });

  const updateMember = useMutation({
    mutationFn: async ({ memberId, data }) => {
      // data: { role?, roleLabel? }
      const res = await axios.patch(
        `/api/client-projects/${projectId}/members/${memberId}`,
        data,
        { headers: getAuthHeaders() },
      );
      return res.data;
    },
    onSuccess: invalidate,
  });

  const removeMember = useMutation({
    mutationFn: async (memberId) => {
      const res = await axios.delete(
        `/api/client-projects/${projectId}/members/${memberId}`,
        { headers: getAuthHeaders() },
      );
      return res.data;
    },
    onSuccess: invalidate,
  });

  // The owner has no leaveProject permission (there is no membership row for
  // them to leave) — the server rejects that with 403, this hook doesn't
  // special-case it.
  const leaveProject = useMutation({
    mutationFn: async () => {
      const res = await axios.post(
        `/api/client-projects/${projectId}/leave`,
        {},
        { headers: getAuthHeaders() },
      );
      return res.data;
    },
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['client-projects'] });
      queryClient.invalidateQueries({ queryKey: ['chat-channels'] });
    },
  });

  return {
    members: membersQuery.data?.members || [],
    invitations: membersQuery.data?.invitations || [],
    isLoading: membersQuery.isLoading,
    error: membersQuery.error,
    invite,
    resendInvitation,
    revokeInvitation,
    updateMember,
    removeMember,
    leaveProject,
  };
}
