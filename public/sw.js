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
  const options = {
    body: data.body || "",
    icon: data.icon || "/icons/dmdevelon_logo-notifications.png",
    badge: data.badge || "/icons/badge-72.png",
    data: { url: data.url || "/dashboard" },
    tag: data.tag || undefined,
    renotify: !!data.tag,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Focus an existing tab if one is open, otherwise open a new one.
        for (const client of clientList) {
          if ("focus" in client) {
            client.focus();
            if ("navigate" in client) client.navigate(url);
            return;
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(url);
      }),
  );
});
