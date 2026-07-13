"use client";

import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "./useAuth";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

// iOS (iPhone/iPad) supports Web Push only from iOS 16.4+ AND only when the site
// is installed as a PWA (running in standalone mode). In a normal Safari/Chrome
// tab, PushManager/Notification are missing or throw — so we never call them
// there. Instead the install banner guides the user to "Add to Home Screen",
// and once launched standalone the Notification Bell exposes the enable button.
export function isIOS() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const iOSDevice = /iPad|iPhone|iPod/.test(ua);
  // iPadOS 13+ reports as Mac; detect via touch points.
  const iPadOS =
    navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return iOSDevice || iPadOS;
}

// Is the app running as an installed PWA (home-screen / standalone)?
export function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
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
  const [ios, setIos] = useState(false);
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    const onIOS = isIOS();
    const inStandalone = isStandalone();
    setIos(onIOS);
    setStandalone(inStandalone);

    const hasApis =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window &&
      !!VAPID_PUBLIC_KEY;

    // On iOS, push is only usable once installed as a PWA (standalone).
    const ok = hasApis && (!onIOS || inStandalone);
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

      const reg =
        (await registerServiceWorker()) || (await navigator.serviceWorker.ready);
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
      const reg =
        (await registerServiceWorker()) || (await navigator.serviceWorker.ready);
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
    isIOS: ios,
    isStandalone: standalone,
    // iOS user in a browser tab who must install the PWA before push works.
    iosNeedsInstall: ios && !standalone,
    subscribe,
    unsubscribe,
    ensureSubscribed,
  };
}
