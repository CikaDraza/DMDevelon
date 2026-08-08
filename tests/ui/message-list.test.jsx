// The chat thread's scroll contract, rendered.
//
// These are the behaviours the operator reported as intermittent: opening a
// channel not landing on the last message, and sending a message not scrolling
// down. Both are timing-sensitive interactions between React Query's cache and
// the DOM, which is exactly the class of thing an API test cannot see.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// The thread pulls in the notifications hook (for the bell's read receipts)
// and the messages hook. Stub both: this suite is about scroll mechanics, and
// the data layer already has its own integration coverage.
const hookState = {
  messages: [],
  isLoading: false,
  hasMoreHistory: false,
  isLoadingMoreHistory: false,
};
const loadMoreHistory = vi.fn(async () => {});
const markReadMutate = vi.fn();

vi.mock("@/hooks/useProjectChat", () => ({
  useChatMessages: () => ({
    messages: hookState.messages,
    isLoading: hookState.isLoading,
    hasMoreHistory: hookState.hasMoreHistory,
    isLoadingMoreHistory: hookState.isLoadingMoreHistory,
    loadMoreHistory,
    togglePin: { mutate: vi.fn(), isPending: false },
    editMessage: { mutate: vi.fn() },
    deleteMessage: { mutate: vi.fn() },
    markRead: { mutate: markReadMutate },
    convertMessage: { mutateAsync: vi.fn() },
  }),
}));

vi.mock("@/hooks/useNotifications", () => ({
  useNotifications: () => ({ markRead: { mutate: vi.fn() } }),
}));

const { MessageList } = await import("@/components/chat/MessageList");

const message = (id, authorUserId = "someone-else") => ({
  _id: id,
  channelId: "chan-1",
  authorUserId,
  authorName: "Someone",
  authorRole: "client",
  body: `message ${id}`,
  kind: "user",
  flag: "none",
  attachments: [],
  createdAt: new Date().toISOString(),
});

function renderThread(props = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MessageList channelId="chan-1" currentUserId="me" {...props} />
    </QueryClientProvider>,
  );
}

/**
 * jsdom has no layout, so a scroll container reports every dimension as 0 and
 * `scrollTop = scrollHeight` is indistinguishable from doing nothing. Give the
 * container real geometry, and make scrollTop clamp the way a browser does.
 */
function giveContainerGeometry(el, { scrollHeight = 2000, clientHeight = 400 }) {
  Object.defineProperty(el, "scrollHeight", {
    configurable: true,
    get: () => scrollHeight,
  });
  Object.defineProperty(el, "clientHeight", {
    configurable: true,
    get: () => clientHeight,
  });
  let top = 0;
  Object.defineProperty(el, "scrollTop", {
    configurable: true,
    get: () => top,
    set: (value) => {
      top = Math.min(Math.max(value, 0), scrollHeight - clientHeight);
    },
  });
  el.scrollTo = (options) => {
    if (options && typeof options === "object") el.scrollTop = options.top ?? 0;
  };
}

const scrollBox = (container) => container.querySelector(".overflow-y-auto");

beforeEach(() => {
  hookState.messages = [];
  hookState.isLoading = false;
  hookState.hasMoreHistory = false;
  hookState.isLoadingMoreHistory = false;
  loadMoreHistory.mockClear();
  markReadMutate.mockClear();
});

describe("opening a channel", () => {
  it("lands on the last message, not the top of the thread", async () => {
    hookState.messages = Array.from({ length: 30 }, (_, i) =>
      message(`m-${i}`),
    );
    const { container } = renderThread();
    const box = scrollBox(container);
    giveContainerGeometry(box, { scrollHeight: 2000, clientHeight: 400 });

    await waitFor(() => expect(box.scrollTop).toBe(1600));
  });

  it("does not load older history before it has settled at the bottom", async () => {
    // The regression that put people in the middle of a long conversation.
    // On open, scrollTop is legitimately 0 for a frame or two while the
    // scroll-to-bottom is queued. A scroll event in that window used to read
    // as "the reader scrolled up to see history", load the previous page, and
    // restore the position of the OLD top — i.e. the middle — with the
    // one-shot scroll flag already spent, so nothing pulled it back down.
    //
    // It only bit channels with a full first page, which is why it looked
    // intermittent.
    hookState.messages = Array.from({ length: 50 }, (_, i) => message(`m-${i}`));
    hookState.hasMoreHistory = true;

    const { container } = renderThread();
    const box = scrollBox(container);
    giveContainerGeometry(box, { scrollHeight: 4000, clientHeight: 400 });

    // A scroll event at the top, before the initial pin has run.
    await act(async () => {
      box.dispatchEvent(new Event("scroll"));
    });
    expect(loadMoreHistory).not.toHaveBeenCalled();

    await waitFor(() => expect(box.scrollTop).toBe(3600));
  });

  it("a smooth follow-scroll's own events don't count as scrolling away", async () => {
    // A smooth scroll keeps emitting events after the call returns, with the
    // position still mid-flight near the top. Reading intent out of those
    // flipped stick-to-bottom off during the animation, so the message right
    // after raised the pill instead of following. Instant scrolls get no such
    // window — see the test above, where a reader scrolling up immediately
    // after open must still be honoured.
    hookState.messages = Array.from({ length: 20 }, (_, i) => message(`m-${i}`));
    const { container, rerender } = renderThread();
    const box = scrollBox(container);
    giveContainerGeometry(box, { scrollHeight: 2000, clientHeight: 400 });
    await waitFor(() => expect(box.scrollTop).toBe(1600));

    // Someone else's message → smooth follow, which opens the guard window.
    hookState.messages = [...hookState.messages, message("first", "them")];
    const queryClient = new QueryClient();
    await act(async () => {
      rerender(
        <QueryClientProvider client={queryClient}>
          <MessageList channelId="chan-1" currentUserId="me" />
        </QueryClientProvider>,
      );
    });

    // Mid-animation echo, reported near the top.
    await act(async () => {
      box.scrollTop = 100;
      box.dispatchEvent(new Event("scroll"));
    });

    hookState.messages = [...hookState.messages, message("second", "them")];
    await act(async () => {
      rerender(
        <QueryClientProvider client={queryClient}>
          <MessageList channelId="chan-1" currentUserId="me" />
        </QueryClientProvider>,
      );
    });

    expect(screen.queryByText("New messages")).toBeNull();
  });

  it("still lands at the bottom when the page came from cache", async () => {
    // The cached-data path is the one that regressed: `isLoading` is already
    // false on the very first render, so the effect has to handle a thread
    // that exists before the component has ever painted an empty state.
    hookState.isLoading = false;
    hookState.messages = [message("only")];
    const { container, rerender } = renderThread();
    const box = scrollBox(container);
    giveContainerGeometry(box, { scrollHeight: 900, clientHeight: 300 });

    hookState.messages = Array.from({ length: 10 }, (_, i) => message(`c-${i}`));
    const queryClient = new QueryClient();
    await act(async () => {
      rerender(
        <QueryClientProvider client={queryClient}>
          <MessageList channelId="chan-1" currentUserId="me" />
        </QueryClientProvider>,
      );
    });

    await waitFor(() => expect(box.scrollTop).toBe(600));
  });
});

describe("a message arriving", () => {
  it("follows your own message down even when you had scrolled up", async () => {
    // The rule the operator asked for: writing a message always scrolls to the
    // bottom. Previously a reader who had scrolled up to re-read something got
    // the "New messages" pill for their OWN message.
    hookState.messages = Array.from({ length: 20 }, (_, i) => message(`m-${i}`));
    const { container, rerender } = renderThread();
    const box = scrollBox(container);
    giveContainerGeometry(box, { scrollHeight: 2000, clientHeight: 400 });
    await waitFor(() => expect(box.scrollTop).toBe(1600));

    // Reader scrolls up to the top.
    await act(async () => {
      box.scrollTop = 0;
      box.dispatchEvent(new Event("scroll"));
    });
    expect(box.scrollTop).toBe(0);

    hookState.messages = [...hookState.messages, message("mine", "me")];
    const queryClient = new QueryClient();
    await act(async () => {
      rerender(
        <QueryClientProvider client={queryClient}>
          <MessageList channelId="chan-1" currentUserId="me" />
        </QueryClientProvider>,
      );
    });

    await waitFor(() => expect(box.scrollTop).toBe(1600));
    expect(screen.queryByText("New messages")).toBeNull();
  });

  it("offers a pill instead of yanking you down for someone else's message", async () => {
    hookState.messages = Array.from({ length: 20 }, (_, i) => message(`m-${i}`));
    const { container, rerender } = renderThread();
    const box = scrollBox(container);
    giveContainerGeometry(box, { scrollHeight: 2000, clientHeight: 400 });
    await waitFor(() => expect(box.scrollTop).toBe(1600));

    await act(async () => {
      box.scrollTop = 0;
      box.dispatchEvent(new Event("scroll"));
    });

    hookState.messages = [...hookState.messages, message("theirs", "them")];
    const queryClient = new QueryClient();
    await act(async () => {
      rerender(
        <QueryClientProvider client={queryClient}>
          <MessageList channelId="chan-1" currentUserId="me" />
        </QueryClientProvider>,
      );
    });

    expect(await screen.findByText("New messages")).toBeInTheDocument();
    expect(box.scrollTop).toBe(0);
  });

  it("scrolls to the bottom when the composer reports a successful send", async () => {
    hookState.messages = Array.from({ length: 20 }, (_, i) => message(`m-${i}`));
    const { container, rerender } = renderThread({ scrollRequest: 0 });
    const box = scrollBox(container);
    giveContainerGeometry(box, { scrollHeight: 2000, clientHeight: 400 });
    await waitFor(() => expect(box.scrollTop).toBe(1600));

    await act(async () => {
      box.scrollTop = 0;
      box.dispatchEvent(new Event("scroll"));
    });

    const queryClient = new QueryClient();
    await act(async () => {
      rerender(
        <QueryClientProvider client={queryClient}>
          <MessageList channelId="chan-1" currentUserId="me" scrollRequest={1} />
        </QueryClientProvider>,
      );
    });

    await waitFor(() => expect(box.scrollTop).toBe(1600));
  });
});

describe("jumping to a message", () => {
  it("pages history backwards until the target appears", async () => {
    // A pinned message from last week is not in the first page. Before this,
    // clicking it produced a toast and nothing else.
    hookState.messages = [message("recent")];
    hookState.hasMoreHistory = true;
    loadMoreHistory.mockImplementation(async () => {
      hookState.messages = [message("older-target"), ...hookState.messages];
      hookState.hasMoreHistory = false;
    });

    const { container, rerender } = renderThread();
    giveContainerGeometry(scrollBox(container), {
      scrollHeight: 800,
      clientHeight: 300,
    });

    const queryClient = new QueryClient();
    await act(async () => {
      rerender(
        <QueryClientProvider client={queryClient}>
          <MessageList
            channelId="chan-1"
            currentUserId="me"
            jumpRequest={{ messageId: "older-target", nonce: 1 }}
          />
        </QueryClientProvider>,
      );
    });

    await waitFor(() => expect(loadMoreHistory).toHaveBeenCalled());
    await waitFor(() =>
      expect(
        container.querySelector('[data-message-id="older-target"]'),
      ).toBeTruthy(),
    );
  });
});
