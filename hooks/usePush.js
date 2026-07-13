"use client";

import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "./useAuth";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

// iOS (iPhone/iPad) is deliberately excluded: Safari only supports web push in
// an installed PWA and prompting there tends to break the dashboard, so we skip
// service worker + push entirely on iOS.
export function isIOS() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const iOSDevice = /iPad|iPhone|iPod/.test(ua);
  // iPadOS 13+ reports as Mac; detect via touch points.
  const iPadOS =
    navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return iOSDevice || iPadOS;
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;
  return navigator.serviceWorker.register("/sw.js");
}

export function usePush() {
  const { getAuthHeaders } = useAuth();
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const ok =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window &&
      !isIOS() &&
      !!VAPID_PUBLIC_KEY;
    setSupported(ok);
    if (!ok) return;
    setPermission(Notification.permission);
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setIsSubscribed(!!sub))
      .catch(() => {});
  }, []);

  const subscribe = useCallback(async () => {
    if (!supported || busy) return false;
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") return false;

      const reg = (await registerServiceWorker()) || (await navigator.serviceWorker.ready);
      await navigator.serviceWorker.ready;

      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }
      await axios.post(
        "/api/push/subscribe",
        { subscription: sub.toJSON() },
        { headers: getAuthHeaders() },
      );
      setIsSubscribed(true);
      return true;
    } catch (e) {
      console.error("push subscribe failed:", e);
      return false;
    } finally {
      setBusy(false);
    }
  }, [supported, busy, getAuthHeaders]);

  const unsubscribe = useCallback(async () => {
    if (!supported || busy) return false;
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await axios.post(
          "/api/push/unsubscribe",
          { endpoint: sub.endpoint },
          { headers: getAuthHeaders() },
        );
        await sub.unsubscribe();
      }
      setIsSubscribed(false);
      return true;
    } catch (e) {
      console.error("push unsubscribe failed:", e);
      return false;
    } finally {
      setBusy(false);
    }
  }, [supported, busy, getAuthHeaders]);

  // Silently re-register the SW and refresh the subscription when permission is
  // already granted (keeps the server copy in sync after reinstalls/expiry).
  const ensureSubscribed = useCallback(async () => {
    if (!supported || Notification.permission !== "granted") return;
    try {
      const reg = (await registerServiceWorker()) || (await navigator.serviceWorker.ready);
      await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }
      await axios.post(
        "/api/push/subscribe",
        { subscription: sub.toJSON() },
        { headers: getAuthHeaders() },
      );
      setIsSubscribed(true);
    } catch (e) {
      console.error("push ensureSubscribed failed:", e);
    }
  }, [supported, getAuthHeaders]);

  return {
    supported,
    permission,
    isSubscribed,
    busy,
    subscribe,
    unsubscribe,
    ensureSubscribed,
  };
}
