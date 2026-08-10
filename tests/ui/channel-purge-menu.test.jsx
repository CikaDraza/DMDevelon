// The header's purge menu. The two things worth pinning down in the UI are
// that the menu is invisible to anyone the API would 403, and that confirming
// sends the right scope — the difference between "delete the last month's
// worth" and "delete everything" is one field in the request body.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const purgeState = { mutateAsync: vi.fn(), isPending: false };

vi.mock("@/hooks/useProjectChat", () => ({
  usePurgeChannel: () => purgeState,
}));

vi.mock("react-hot-toast", () => {
  const toast = vi.fn();
  toast.success = vi.fn();
  toast.error = vi.fn();
  return { default: toast };
});

const { ChannelPurgeMenu } = await import(
  "@/components/chat/ChannelPurgeMenu"
);
const toast = (await import("react-hot-toast")).default;

const channel = (overrides = {}) => ({
  _id: "chan-1",
  kind: "group",
  name: "Redesign — Project Group",
  canModerate: true,
  ...overrides,
});

const openMenu = () =>
  userEvent.click(screen.getByRole("button", { name: /Conversation actions/i }));

beforeEach(() => {
  purgeState.mutateAsync = vi.fn().mockResolvedValue({
    message: "Deleted 3 messages",
    deletedCount: 3,
    convertedCount: 0,
  });
  purgeState.isPending = false;
  toast.mockClear();
  toast.success.mockClear();
  toast.error.mockClear();
});

describe("the purge menu", () => {
  it("renders nothing for a viewer who may not moderate", () => {
    const { container } = render(
      <ChannelPurgeMenu channel={channel({ canModerate: false })} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("offers both windows to a moderator", async () => {
    render(<ChannelPurgeMenu channel={channel()} />);
    await openMenu();

    expect(
      screen.getByRole("menuitem", { name: /older than 30 days/i }),
    ).toBeTruthy();
    expect(
      screen.getByRole("menuitem", { name: /Delete all messages/i }),
    ).toBeTruthy();
  });

  it("confirms before deleting everything, and names the channel", async () => {
    render(<ChannelPurgeMenu channel={channel()} />);
    await openMenu();
    await userEvent.click(
      screen.getByRole("menuitem", { name: /Delete all messages/i }),
    );

    // Nothing has been sent yet — the menu item only opens the confirmation.
    expect(purgeState.mutateAsync).not.toHaveBeenCalled();
    expect(screen.getByText(/#Redesign — Project Group/)).toBeTruthy();
    expect(screen.getByText(/cannot be undone/i)).toBeTruthy();

    await userEvent.click(
      screen.getByRole("button", { name: /Delete everything/i }),
    );
    expect(purgeState.mutateAsync).toHaveBeenCalledWith({ scope: "all" });
  });

  it("sends the 30-day window for the older-than action", async () => {
    render(<ChannelPurgeMenu channel={channel()} />);
    await openMenu();
    await userEvent.click(
      screen.getByRole("menuitem", { name: /older than 30 days/i }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: /Delete older messages/i }),
    );

    expect(purgeState.mutateAsync).toHaveBeenCalledWith({
      scope: "older_than",
      days: 30,
    });
  });

  it("cancelling sends nothing", async () => {
    render(<ChannelPurgeMenu channel={channel()} />);
    await openMenu();
    await userEvent.click(
      screen.getByRole("menuitem", { name: /Delete all messages/i }),
    );
    await userEvent.click(screen.getByRole("button", { name: /Cancel/i }));

    expect(purgeState.mutateAsync).not.toHaveBeenCalled();
  });

  it("describes a DM as a direct message, not as a #channel", async () => {
    render(
      <ChannelPurgeMenu channel={channel({ kind: "dm", name: "" })} />,
    );
    await openMenu();
    await userEvent.click(
      screen.getByRole("menuitem", { name: /Delete all messages/i }),
    );

    expect(screen.getByText(/this direct message/)).toBeTruthy();
  });

  it("warns when the purge orphaned converted records", async () => {
    purgeState.mutateAsync = vi.fn().mockResolvedValue({
      message: "Deleted 5 messages",
      deletedCount: 5,
      convertedCount: 2,
    });
    render(<ChannelPurgeMenu channel={channel()} />);
    await openMenu();
    await userEvent.click(
      screen.getByRole("menuitem", { name: /Delete all messages/i }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: /Delete everything/i }),
    );

    expect(toast.success).toHaveBeenCalledWith("Deleted 5 messages");
    expect(toast).toHaveBeenCalledWith(
      expect.stringContaining("2 of them"),
      expect.anything(),
    );
  });

  it("reports a failure instead of implying the messages are gone", async () => {
    purgeState.mutateAsync = vi
      .fn()
      .mockRejectedValue({ response: { data: { error: "Nope" } } });
    render(<ChannelPurgeMenu channel={channel()} />);
    await openMenu();
    await userEvent.click(
      screen.getByRole("menuitem", { name: /Delete all messages/i }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: /Delete everything/i }),
    );

    expect(toast.error).toHaveBeenCalledWith("Nope");
    expect(toast.success).not.toHaveBeenCalled();
  });
});
