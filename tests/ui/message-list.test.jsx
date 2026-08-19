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
function giveContainerGeometry(
  el,
  { scrollHeight = 2000, clientHeight = 400 },
) {
  let height = scrollHeight;
  let visible = clientHeight;
  Object.defineProperty(el, "scrollHeight", {
    configurable: true,
    get: () => height,
  });
  Object.defineProperty(el, "clientHeight", {
    configurable: true,
    get: () => visible,
  });
  let top = 0;
  Object.defineProperty(el, "scrollTop", {
    configurable: true,
    get: () => top,
    set: (value) => {
      top = Math.min(Math.max(value, 0), height - visible);
    },
  });
  el.scrollTo = (options) => {
    if (options && typeof options === "object") el.scrollTop = options.top ?? 0;
  };
  // Lets a test reproduce content that arrives after the scroll — an image
  // decoding, the web font swapping in — which is exactly what a single write
  // to scrollTop cannot survive.
  return {
    grow: (to) => {
      height = to;
    },
    // The composer taking height out of the thread beneath it.
    shrinkViewportTo: (to) => {
      visible = to;
    },
  };
}

const scrollBox = (container) => container.querySelector(".overflow-y-auto");

/**
 * The reader scrolling, as a browser actually reports it: an input event the
 * person produced, then the scroll it caused. The thread attributes scrolling
 * from the input event — a bare `scroll` event is exactly what it cannot tell
 * apart from its own pinning, so simulating one alone tests nothing.
 */
async function readerScrollsTo(box, top) {
  await act(async () => {
    box.dispatchEvent(new Event("wheel"));
    box.scrollTop = top;
    box.dispatchEvent(new Event("scroll"));
  });
}

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
    hookState.messages = Array.from({ length: 50 }, (_, i) =>
      message(`m-${i}`),
    );
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
    hookState.messages = Array.from({ length: 20 }, (_, i) =>
      message(`m-${i}`),
    );
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

    hookState.messages = Array.from({ length: 10 }, (_, i) =>
      message(`c-${i}`),
    );
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
    hookState.messages = Array.from({ length: 20 }, (_, i) =>
      message(`m-${i}`),
    );
    const { container, rerender } = renderThread();
    const box = scrollBox(container);
    giveContainerGeometry(box, { scrollHeight: 2000, clientHeight: 400 });
    await waitFor(() => expect(box.scrollTop).toBe(1600));

    // Reader scrolls up to the top.
    await readerScrollsTo(box, 0);
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
    hookState.messages = Array.from({ length: 20 }, (_, i) =>
      message(`m-${i}`),
    );
    const { container, rerender } = renderThread();
    const box = scrollBox(container);
    giveContainerGeometry(box, { scrollHeight: 2000, clientHeight: 400 });
    await waitFor(() => expect(box.scrollTop).toBe(1600));

    await readerScrollsTo(box, 0);

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
    hookState.messages = Array.from({ length: 20 }, (_, i) =>
      message(`m-${i}`),
    );
    const { container, rerender } = renderThread({ scrollRequest: 0 });
    const box = scrollBox(container);
    giveContainerGeometry(box, { scrollHeight: 2000, clientHeight: 400 });
    await waitFor(() => expect(box.scrollTop).toBe(1600));

    await readerScrollsTo(box, 0);

    const queryClient = new QueryClient();
    await act(async () => {
      rerender(
        <QueryClientProvider client={queryClient}>
          <MessageList
            channelId="chan-1"
            currentUserId="me"
            scrollRequest={1}
          />
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

describe("telling our own scrolling apart from the reader's", () => {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  it("keeps re-pinning while the thread is still growing", async () => {
    // Images and the web font land after the first paint and push the last
    // message below the fold. A pin written once ends up that far short of the
    // end, which is what "it never shows me the last message" looked like.
    hookState.messages = Array.from({ length: 20 }, (_, i) =>
      message(`m-${i}`),
    );
    const { container } = renderThread();
    const box = scrollBox(container);
    const geometry = giveContainerGeometry(box, {
      scrollHeight: 2000,
      clientHeight: 400,
    });
    await waitFor(() => expect(box.scrollTop).toBe(1600));

    // An image finishes decoding and the thread grows underneath the viewport.
    geometry.grow(3000);
    await waitFor(() => expect(box.scrollTop).toBe(2600));
  });

  it("does not read its own late scroll events as a reader scrolling up", async () => {
    // The regression behind all three reports. A smooth scroll keeps emitting
    // events well past any fixed guard window; once the guess expired those
    // events read as "the reader is at the top", which dropped stick-to-bottom
    // AND loaded older history — and the position restore that followed
    // cancelled the scroll still travelling towards the end.
    hookState.messages = Array.from({ length: 50 }, (_, i) =>
      message(`m-${i}`),
    );
    hookState.hasMoreHistory = true;
    const { container, rerender } = renderThread();
    const box = scrollBox(container);
    giveContainerGeometry(box, { scrollHeight: 4000, clientHeight: 400 });
    await waitFor(() => expect(box.scrollTop).toBe(3600));

    // Well past the 400ms the old implementation allowed itself, and past the
    // pin's own settle window, so nothing is holding the position any more.
    await act(async () => {
      await sleep(900);
    });

    // An event reported near the top that no input event preceded: only this
    // component could have caused it.
    await act(async () => {
      box.scrollTop = 40;
      box.dispatchEvent(new Event("scroll"));
    });
    expect(loadMoreHistory).not.toHaveBeenCalled();

    // …and the thread is still following, so the next message lands instead of
    // raising the pill.
    hookState.messages = [...hookState.messages, message("next", "them")];
    const queryClient = new QueryClient();
    await act(async () => {
      rerender(
        <QueryClientProvider client={queryClient}>
          <MessageList channelId="chan-1" currentUserId="me" />
        </QueryClientProvider>,
      );
    });
    expect(screen.queryByText("New messages")).toBeNull();
    await waitFor(() => expect(box.scrollTop).toBe(3600));
  });

  it("treats a scrollbar drag as the reader, with no wheel or touch involved", async () => {
    // Dragging the scrollbar produces a pointer press and scroll events, and
    // nothing else. Requiring a wheel or a touch would leave desktop readers
    // unable to scroll away from the end at all.
    hookState.messages = Array.from({ length: 20 }, (_, i) =>
      message(`m-${i}`),
    );
    const { container, rerender } = renderThread();
    const box = scrollBox(container);
    giveContainerGeometry(box, { scrollHeight: 2000, clientHeight: 400 });
    await waitFor(() => expect(box.scrollTop).toBe(1600));

    await act(async () => {
      box.dispatchEvent(new Event("pointerdown"));
      box.scrollTop = 0;
      box.dispatchEvent(new Event("scroll"));
    });
    expect(box.scrollTop).toBe(0);

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
    await act(async () => {
      window.dispatchEvent(new Event("pointerup"));
    });
  });

  it("a jump to a message does not trip the load-older-history branch", async () => {
    // What broke notification deep links: the jump scrolls a long way, its own
    // mid-flight events arrive near the top, and loading history there yanked
    // the reader off the message they had clicked through to see.
    hookState.messages = Array.from({ length: 50 }, (_, i) =>
      message(`m-${i}`),
    );
    hookState.hasMoreHistory = true;
    const { container, rerender } = renderThread();
    const box = scrollBox(container);
    giveContainerGeometry(box, { scrollHeight: 4000, clientHeight: 400 });
    await waitFor(() => expect(box.scrollTop).toBe(3600));

    const queryClient = new QueryClient();
    await act(async () => {
      rerender(
        <QueryClientProvider client={queryClient}>
          <MessageList
            channelId="chan-1"
            currentUserId="me"
            jumpRequest={{ messageId: "m-3", nonce: 7 }}
          />
        </QueryClientProvider>,
      );
    });

    // Long enough that the old fixed guard window would have lapsed while the
    // jump was still travelling — the exact moment the bug used to strike.
    await act(async () => {
      await sleep(900);
    });

    // The animation travelling past the top of the thread.
    await act(async () => {
      box.scrollTop = 20;
      box.dispatchEvent(new Event("scroll"));
      box.scrollTop = 10;
      box.dispatchEvent(new Event("scroll"));
    });

    expect(loadMoreHistory).not.toHaveBeenCalled();
  });
});

describe("staying at the end when the box changes shape", () => {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  it("keeps the last message above the composer when the composer grows", async () => {
    // The composer is shrink-0, so every line the textarea gains, every
    // attachment chip and every reply banner takes its height straight out of
    // the thread beneath it. The content is anchored at scrollTop, so the last
    // message slides out of sight behind the input — "the message I just sent
    // stays under the input field". Nothing about the CONTENT changed, which
    // is why watching only the rows never noticed.
    hookState.messages = Array.from({ length: 20 }, (_, i) =>
      message(`m-${i}`),
    );
    const { container } = renderThread();
    const box = scrollBox(container);
    const geometry = giveContainerGeometry(box, {
      scrollHeight: 2000,
      clientHeight: 400,
    });
    await waitFor(() => expect(box.scrollTop).toBe(1600));
    await act(async () => {
      await sleep(900); // let the opening pin finish
    });

    // The textarea grows by 100px; the thread gets 100px shorter.
    geometry.shrinkViewportTo(300);
    await act(async () => {
      globalThis.fireResize(box);
    });

    // Still showing the end, not 100px short of it.
    expect(box.scrollTop).toBe(1700);
  });

  it("pins again once a pane that was hidden finally has a size", async () => {
    // The phone layout opens on the channel list with the conversation
    // display:none beside it. A box with no height cannot be scrolled, so the
    // opening pin did nothing at all and nothing tried a second time.
    hookState.messages = Array.from({ length: 20 }, (_, i) =>
      message(`m-${i}`),
    );
    const { container } = renderThread();
    const box = scrollBox(container);
    const geometry = giveContainerGeometry(box, {
      scrollHeight: 2000,
      clientHeight: 0,
    });
    await act(async () => {
      await sleep(900);
    });
    expect(box.scrollTop).toBe(0); // nothing to scroll while hidden

    // The reader taps the channel and the pane is laid out for the first time.
    geometry.shrinkViewportTo(400);
    await act(async () => {
      globalThis.fireResize(box);
    });

    await waitFor(() => expect(box.scrollTop).toBe(1600));
  });

  it("does not treat a tap on Send as the reader scrolling away", async () => {
    // The pointer release is watched on the window so a scrollbar drag that
    // ends off-target still counts as the reader. Taken unconditionally it
    // also counted every tap anywhere in the app — the Send button above all —
    // as a reader gesture, and a reader gesture stops the thread from pinning:
    // the tap called off the very scroll it had just asked for.
    hookState.messages = Array.from({ length: 20 }, (_, i) =>
      message(`m-${i}`),
    );
    const { container } = renderThread();
    const box = scrollBox(container);
    const content = box.firstElementChild;
    const geometry = giveContainerGeometry(box, {
      scrollHeight: 2000,
      clientHeight: 400,
    });
    await waitFor(() => expect(box.scrollTop).toBe(1600));
    await act(async () => {
      await sleep(900); // let the opening pin finish
    });

    // A tap that began and ended outside the thread — Send, a channel, a menu.
    await act(async () => {
      window.dispatchEvent(new Event("pointerup"));
    });

    // The sent message lands and the thread grows.
    geometry.grow(3000);
    await act(async () => {
      globalThis.fireResize(content);
    });

    expect(box.scrollTop).toBe(2600);
  });
});
