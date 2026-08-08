/* DMDevelon service worker — push notifications only (no offline caching). */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "DMDevelon", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "DMDevelon";
  const url = data.url || "/dashboard";
  const options = {
    body: data.body || "",
    icon: data.icon || "/icons/dmdevelon_logo-notifications.png",
    badge: data.badge || "/icons/badge-72.png",
    // `url` is duplicated onto data so notificationclick can read it back.
    data: { url },
    tag: data.tag || undefined,
    renotify: !!data.tag,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/dashboard";
  // Same-origin absolute URL: `client.navigate()` and the URL comparison below
  // both need one, and a relative string would compare against nothing.
  const targetUrl = new URL(target, self.location.origin);

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      // Prefer a tab that is already on the destination — clicking a chat
      // notification while that channel is open should just focus the tab, not
      // re-navigate it (which would remount the thread and lose scroll).
      const sameOrigin = clientList.filter(
        (c) => new URL(c.url).origin === self.location.origin,
      );
      const exact = sameOrigin.find(
        (c) =>
          new URL(c.url).pathname + new URL(c.url).search === targetUrl.pathname + targetUrl.search,
      );
      if (exact) {
        await exact.focus();
        return;
      }

      // Otherwise reuse any open tab of ours: focus it, then navigate.
      // Both are awaited — the previous version fired `navigate()` without
      // awaiting inside waitUntil, so the worker could be killed mid-navigation
      // and the click did nothing but focus a stale page.
      const reusable = sameOrigin.find((c) => "focus" in c);
      if (reusable) {
        await reusable.focus();
        if ("navigate" in reusable) {
          try {
            await reusable.navigate(targetUrl.href);
            return;
          } catch (e) {
            // navigate() can reject (e.g. the client is not controlled yet);
            // fall through to opening a fresh window rather than swallowing
            // the user's click.
          }
        } else {
          return;
        }
      }

      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl.href);
      }
    })(),
  );
});
