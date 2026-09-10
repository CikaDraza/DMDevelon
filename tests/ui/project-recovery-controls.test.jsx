import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const get = vi.fn();
const getAuthHeaders = vi.fn(() => ({ Authorization: "Bearer test" }));
vi.mock("axios", () => ({ default: { get } }));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ getAuthHeaders }),
}));

const { default: ProjectRecoveryControls } = await import(
  "@/components/admin/ProjectRecoveryControls"
);

const mutations = {
  restoreProject: { isPending: false, mutateAsync: vi.fn() },
  assignProjectOwner: { isPending: false, mutateAsync: vi.fn() },
};

const users = [
  { _id: "admin", name: "Milan", email: "admin@test.local", isAdmin: true },
  { _id: "petra", name: "Petra", email: "petra@test.local", isAdmin: false },
];

beforeEach(() => {
  get.mockReset();
  get.mockResolvedValue({ data: { members: [], invitations: [] } });
  mutations.restoreProject.mutateAsync.mockReset();
  mutations.assignProjectOwner.mutateAsync.mockReset();
});

describe("project recovery controls", () => {
  it("presents the ownerless and deleted states as separate recovery facts", () => {
    render(
      <ProjectRecoveryControls
        project={{
          _id: "project-1",
          title: "Psihointegritet",
          status: "deleted",
          clientName: "Previous client",
          clientEmail: "previous@test.local",
          ownerAccountDeletedAt: "2026-08-09T16:52:56.147Z",
        }}
        users={users}
        {...mutations}
      />,
    );

    expect(screen.getByText("This project has no active owner")).toBeVisible();
    expect(screen.getByText(/Last owner: Previous client/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Restore project" })).toBeVisible();
    expect(screen.queryByText(/ownerAccountDeletedAt/)).not.toBeInTheDocument();
    expect(screen.queryByText(/clientUserId/)).not.toBeInTheDocument();
  });

  it("explains history preservation before a restore is confirmed", async () => {
    render(
      <ProjectRecoveryControls
        project={{
          _id: "project-1",
          title: "Psihointegritet",
          status: "deleted",
          clientUserId: null,
          ownerAccountDeletedAt: "2026-08-09T16:52:56.147Z",
        }}
        users={users}
        {...mutations}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Restore project" }));

    expect(await screen.findByText(/Existing milestones, tasks and completed-work history/))
      .toBeVisible();
    await waitFor(() => expect(get).toHaveBeenCalledTimes(1));
    expect(screen.getByText("Active collaborators")).toBeVisible();
    expect(screen.getByText(/Global admins cannot be client owners/)).toBeVisible();
  });

  it("keeps ownership transfer behind a secondary disclosure", async () => {
    render(
      <ProjectRecoveryControls
        project={{
          _id: "project-2",
          title: "Live project",
          status: "in_progress",
          clientUserId: "petra",
          ownerAccountDeletedAt: null,
        }}
        users={users}
        {...mutations}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Transfer owner", hidden: true }),
    ).not.toBeVisible();
    fireEvent.click(screen.getByText("Transfer owner?"));
    const transferButton = screen.getByRole("button", {
      name: "Transfer owner",
    });
    expect(transferButton).toBeVisible();
    fireEvent.click(transferButton);
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(screen.getByText("Assign new owner")).toBeVisible();
    await waitFor(() => expect(get).toHaveBeenCalledTimes(1));
    expect(screen.getByText("No active collaborators.")).toBeVisible();
    expect(
      screen.queryByText("This project has no active owner"),
    ).not.toBeInTheDocument();
  });
});
