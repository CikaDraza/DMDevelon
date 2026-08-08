// The pinned panel: jumping to a pinned message, and unpinning from the panel
// itself. Both were asked for directly — the second did not exist at all, the
// only way to unpin was to find the message in the thread and use its menu.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const pinnedState = { pinned: [] };
const togglePinMutate = vi.fn();

vi.mock("@/hooks/useProjectChat", () => ({
  useChatPinned: () => ({ pinned: pinnedState.pinned, isLoading: false }),
  useChatMessages: () => ({
    convertMessage: { mutateAsync: vi.fn() },
    togglePin: { mutate: togglePinMutate, isPending: false },
  }),
}));

const { PinnedBar } = await import("@/components/chat/PinnedBar");

const pinnedMessage = (overrides = {}) => ({
  _id: "msg-1",
  authorName: "Anja",
  body: "Booking stays request-first",
  flag: "decision",
  convertedTo: [],
  ...overrides,
});

beforeEach(() => {
  pinnedState.pinned = [];
  togglePinMutate.mockClear();
});

describe("the pinned panel", () => {
  it("renders nothing when there is nothing pinned", () => {
    const { container } = render(<PinnedBar channelId="chan-1" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("offers an unpin control on every row when the viewer may pin", async () => {
    pinnedState.pinned = [pinnedMessage(), pinnedMessage({ _id: "msg-2" })];
    render(<PinnedBar channelId="chan-1" canPin />);

    const unpinButtons = screen.getAllByRole("button", { name: /^Unpin/i });
    expect(unpinButtons).toHaveLength(2);

    await userEvent.click(unpinButtons[0]);
    expect(togglePinMutate).toHaveBeenCalledWith({
      messageId: "msg-1",
      pinned: false,
    });
  });

  it("hides unpin from a viewer who has no pin permission", () => {
    // `canPin` is the server's own answer, carried on the channel summary —
    // the UI must not offer a control the API would 403.
    pinnedState.pinned = [pinnedMessage()];
    render(<PinnedBar channelId="chan-1" canPin={false} />);

    expect(screen.queryByRole("button", { name: /^Unpin/i })).toBeNull();
  });

  it("clicking a pinned message asks the thread to jump to it", async () => {
    pinnedState.pinned = [pinnedMessage()];
    const onJumpToMessage = vi.fn();
    render(
      <PinnedBar
        channelId="chan-1"
        canPin
        onJumpToMessage={onJumpToMessage}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: /Booking stays request-first/i }),
    );
    expect(onJumpToMessage).toHaveBeenCalledWith("msg-1");
  });
});
