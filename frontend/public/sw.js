// FREQUENCIES — push notification service worker

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "FREQUENCIES", body: event.data?.text() ?? "" };
  }

  const title = data.title ?? "FREQUENCIES";
  const options = {
    body: data.body ?? "Time to capture today's frequency.",
    icon: "/favicon.png",
    badge: "/favicon.png",
    tag: "daily-reminder",       // replace previous reminder with newest
    renotify: true,
    data: { url: data.url ?? "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        // Focus existing open window if possible
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            return client.focus();
          }
        }
        return clients.openWindow(url);
      }),
  );
});
