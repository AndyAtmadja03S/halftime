import { getSessionToken } from "./auth";
import { apiUrl } from "./apiUrl";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string;

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; i++) {
    bytes[i] = rawData.charCodeAt(i);
  }
  return bytes;
}

async function sendSubscriptionToServer(sub: PushSubscription): Promise<void> {
  const token = getSessionToken();
  if (!token) return;
  const json = sub.toJSON();
  const keys = json.keys ?? {};
  await fetch(apiUrl("/api/push/subscribe"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      endpoint: sub.endpoint,
      p256dh: keys.p256dh ?? "",
      auth: keys.auth ?? "",
      tzOffset: new Date().getTimezoneOffset(),
    }),
  });
}

/** Returns the current notification permission state */
export function notificationPermission(): NotificationPermission | "unsupported" {
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission;
}

/** Register SW, request permission, subscribe, and send sub to server.
 *  Returns the new permission state. */
export async function enablePushNotifications(): Promise<NotificationPermission> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return "denied";
  }
  if (!VAPID_PUBLIC_KEY) {
    console.warn("[push] VITE_VAPID_PUBLIC_KEY not set");
    return "denied";
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission;

  const reg = await navigator.serviceWorker.ready;

  // Reuse existing subscription if present (endpoint stable)
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  await sendSubscriptionToServer(sub);
  return "granted";
}

/** Remove push subscription from browser and server */
export async function disablePushNotifications(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;

  const token = getSessionToken();
  if (token) {
    await fetch(apiUrl("/api/push/subscribe"), {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    });
  }

  await sub.unsubscribe();
}
