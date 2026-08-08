// Clicking a notification has to land somewhere useful. That is the whole
// point of the bell, and it was the reported gap: rows that went nowhere, and
// chat rows that dropped you at the bottom of a thread with no idea which
// message they were about.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const push = vi.fn();
const markReadMutate = vi.fn();
const notificationState = { items: [], unreadCount: 0 };
const routeState = { pathname: "/dashboard", search: "" };

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => routeState.pathname,
  useSearchParams: () => new URLSearchParams(routeState.search),
}));

vi.mock("@/hooks/useNotifications", () => ({
  useNotifications: () => ({
    items: notificationState.items,
    unreadCount: notificationState.unreadCount,
    markRead: { mutate: markReadMutate },
  }),
}));

vi.mock("@/hooks/usePush", () => ({
  usePush: () => ({
    supported: false,
    permission: "default",
    isSubscribed: false,
    busy: false,
    subscribe: vi.fn(),
    iosNeedsInstall: false,
  }),
}));

const bellModule = await import("@/components/NotificationBell");
const NotificationBell = bellModule.default;
const { fallbackLinkFor } = bellModule;

const notification = (overrides = {}) => ({
  _id: "n-1",
  title: "New message in Redesign",
  body: "Anja: any update?",
  read: false,
  entityType: "project",
  entityId: "proj-1",
  createdAt: new Date().toISOString(),
  ...overrides,
});

async function openBellAndClickFirst() {
  await userEvent.click(screen.getByRole("button", { name: "Notifications" }));
  const row = await screen.findByText(notificationState.items[0].title);
  await userEvent.click(row);
}

beforeEach(() => {
  push.mockClear();
  markReadMutate.mockClear();
  notificationState.items = [];
  notificationState.unreadCount = 0;
  routeState.pathname = "/dashboard";
  routeState.search = "";
});

describe("clicking a notification", () => {
  it("navigates to the message the notification is about", async () => {
    const link = "/dashboard/chat?channel=chan-1&m=msg-9";
    notificationState.items = [notification({ channelId: "chan-1", link })];
    notificationState.unreadCount = 1;

    render(<NotificationBell />);
    await openBellAndClickFirst();

    expect(push).toHaveBeenCalledWith(link);
  });

  it("marks the whole channel read, not just the one row", async () => {
    notificationState.items = [
      notification({
        channelId: "chan-1",
        link: "/dashboard/chat?channel=chan-1&m=msg-9",
      }),
    ];
    notificationState.unreadCount = 1;

    render(<NotificationBell />);
    await openBellAndClickFirst();

    expect(markReadMutate).toHaveBeenCalledWith({ channelId: "chan-1" });
  });

  it("still goes somewhere when the row carries no link", async () => {
    // Older rows predate the deep links. A dead click reads as a broken bell,
    // so the entity's natural home stands in.
    notificationState.items = [notification({ link: "" })];
    notificationState.unreadCount = 1;

    render(<NotificationBell />);
    await openBellAndClickFirst();

    expect(push).toHaveBeenCalledWith("/dashboard/projects/proj-1");
  });

  it("does not push a duplicate history entry for the page you are on", async () => {
    routeState.pathname = "/dashboard/chat";
    routeState.search = "channel=chan-1";
    notificationState.items = [
      notification({
        channelId: "chan-1",
        link: "/dashboard/chat?channel=chan-1",
        read: true,
      }),
    ];

    render(<NotificationBell />);
    await openBellAndClickFirst();

    expect(push).not.toHaveBeenCalled();
  });

  it("treats a different channel on the same page as a real navigation", async () => {
    routeState.pathname = "/dashboard/chat";
    routeState.search = "channel=chan-1";
    notificationState.items = [
      notification({
        channelId: "chan-2",
        link: "/dashboard/chat?channel=chan-2&m=msg-3",
      }),
    ];
    notificationState.unreadCount = 1;

    render(<NotificationBell />);
    await openBellAndClickFirst();

    expect(push).toHaveBeenCalledWith("/dashboard/chat?channel=chan-2&m=msg-3");
  });
});

describe("fallbackLinkFor", () => {
  it("sends an operator to the admin panel and a client to their dashboard", () => {
    const chat = { channelId: "chan-7" };
    expect(fallbackLinkFor(chat, "admin")).toBe(
      "/admin?tab=chat&channel=chan-7",
    );
    expect(fallbackLinkFor(chat, "client")).toBe(
      "/dashboard/chat?channel=chan-7",
    );
  });

  it("routes each entity type to the surface that shows it", () => {
    expect(
      fallbackLinkFor({ entityType: "request", entityId: "r-1" }, "admin"),
    ).toBe("/admin?tab=project-requests&id=r-1");
    expect(
      fallbackLinkFor({ entityType: "request", entityId: "r-1" }, "client"),
    ).toBe("/dashboard/requests/r-1");
    expect(fallbackLinkFor({ entityType: "contact" }, "admin")).toBe(
      "/admin?tab=messages",
    );
    expect(fallbackLinkFor({ entityType: "testimonial" }, "client")).toBe(
      "/dashboard?tab=testimonials",
    );
  });

  it("never returns an empty destination for a row with nothing on it", () => {
    expect(fallbackLinkFor({}, "client")).toBe("/dashboard");
    expect(fallbackLinkFor({}, "admin")).toBe("/admin?tab=client-projects");
  });
});
