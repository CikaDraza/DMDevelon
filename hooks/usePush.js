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

/**
 * Service workers, PushManager and Notification only exist in a SECURE
 * CONTEXT: https, or the localhost/127.0.0.1 exemption. A plain-http LAN
 * address — `http://192.168.1.x:3003`, exactly how this dev server is reached
 * from a phone — is NOT one, so the browser simply does not define those APIs.
 *
 * That single fact produces three symptoms at once, none of which mention it:
 * push cannot be enabled, the settings switch snaps back to off, and the
 * "Install app" banner never appears (`beforeinstallprompt` needs the same
 * secure context plus a service worker). Worth naming explicitly rather than
 * reporting "not supported on this device/browser", which sends people looking
 * at the wrong thing entirely.
 */
export const PUSH_UNAVAILABLE_REASONS = {
  "insecure-origin":
    "This page is not on HTTPS. Browsers only allow push and app install on a secure address — use the deployed site, or localhost on this machine.",
  "missing-key":
    "This build has no push key. NEXT_PUBLIC_VAPID_PUBLIC_KEY has to be set in the deployment's environment before the build, not after.",
  "unsupported-browser":
    "This browser does not support web push notifications.",
  "ios-needs-install":
    "On iPhone: add the app to your home screen (Share → “Add to Home Screen”), then open it from there to enable push.",
  blocked:
    "Notifications are blocked for this site. Turn them back on in the browser's site settings.",
};

// Where a subscribe attempt died. Named steps because "couldn't enable push"
// after the OS prompt was already accepted tells nobody anything: the browser,
// the push service and our own server can each refuse, for unrelated reasons.
const STAGE_LABELS = {
  permission: "Permission",
  "service-worker": "Service worker",
  subscribe: "Push service",
  save: "Saving to your account",
};

// Ordered most-specific-first: the first true reason is the one that actually
// has to be fixed, and fixing it may reveal the next.
function detectUnavailableReason({ onIOS, inStandalone, permission }) {
  if (typeof window === "undefined") return null;
  if (!window.isSecureContext) return "insecure-origin";
  if (!VAPID_PUBLIC_KEY) return "missing-key";
  if (
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window)
  ) {
    return "unsupported-browser";
  }
  if (onIOS && !inStandalone) return "ios-needs-install";
  if (permission === "denied") return "blocked";
  return null;
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

/**
 * Is this subscription still bound to the VAPID key the server signs with?
 *
 * A browser subscription is permanently tied to the applicationServerKey it
 * was created with. Rotate the server keys and every existing subscription
 * keeps working from the browser's point of view — `getSubscription()` still
 * returns it, the server still has the row — but the push service rejects
 * every send with 403. The symptom is exactly "push worked, then one day
 * stopped", with nothing anywhere reporting an error.
 *
 * Comparing the key stored on the subscription against the current one is the
 * only way to notice, so a stale subscription can be torn down and rebuilt
 * instead of silently failing forever.
 */
function subscriptionMatchesCurrentKey(sub) {
  const stored = sub?.options?.applicationServerKey;
  if (!stored || !VAPID_PUBLIC_KEY) return true; // nothing to compare against
  try {
    const current = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
    const existing = new Uint8Array(stored);
    if (existing.length !== current.length) return false;
    return existing.every((byte, i) => byte === current[i]);
  } catch {
    // Can't tell → assume it is fine rather than churning a working
    // subscription on a browser that reports options differently.
    return true;
  }
}

export function usePush() {
  const { getAuthHeaders } = useAuth();
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ios, setIos] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [unavailableReason, setUnavailableReason] = useState(null);
  const [secureContext, setSecureContext] = useState(true);
  // { stage, name, message } from the last failed subscribe, so the UI can
  // report what actually went wrong instead of a generic sentence.
  const [lastError, setLastError] = useState(null);

  useEffect(() => {
    const onIOS = isIOS();
    const inStandalone = isStandalone();
    setIos(onIOS);
    setStandalone(inStandalone);
    setSecureContext(
      typeof window === "undefined" ? true : !!window.isSecureContext,
    );

    const currentPermission =
      typeof window !== "undefined" && "Notification" in window
        ? Notification.permission
        : "default";
    const reason = detectUnavailableReason({
      onIOS,
      inStandalone,
      permission: currentPermission,
    });
    // "blocked" is a permission state, not a capability one: the plumbing all
    // works, the user just has to say yes. Keep `supported` true there so the
    // UI can explain rather than claim the device cannot do it.
    setUnavailableReason(reason);
    const ok = !reason || reason === "blocked";
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
    setLastError(null);
    // Which step we are on, so a failure can name it. "Couldn't enable push"
    // covers four very different problems and points at none of them; after
    // granting permission on Android there are still three ways to fail and
    // the previous code swallowed all of them into `console.error`.
    let stage = "permission";
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        setLastError({
          stage,
          name: "NotAllowedError",
          message:
            perm === "denied"
              ? "You declined the notification prompt. Re-allow it in the browser's site settings."
              : "The notification prompt was dismissed without an answer.",
        });
        return false;
      }

      stage = "service-worker";
      const reg =
        (await registerServiceWorker()) ||
        (await navigator.serviceWorker.ready);
      await navigator.serviceWorker.ready;

      stage = "subscribe";
      let sub = await reg.pushManager.getSubscription();
      // Same self-heal as ensureSubscribed: a subscription left over from an
      // older VAPID key is worse than none, because it looks healthy and fails
      // every send. Reusing it here was how a "successful" enable could still
      // deliver nothing.
      if (sub && !subscriptionMatchesCurrentKey(sub)) {
        try {
          await sub.unsubscribe();
        } catch {}
        sub = null;
      }
      if (!sub) {
        try {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
          });
        } catch (err) {
          // Android Chrome's classic refusal: the push service still holds a
          // subscription for this registration under a different key, and
          // `getSubscription()` did not surface it. Tear it down and retry
          // once — otherwise enabling push is impossible on that device
          // forever, with no way for the user to clear it.
          if (err?.name === "InvalidStateError") {
            const existing = await reg.pushManager.getSubscription();
            if (existing) {
              try {
                await existing.unsubscribe();
              } catch {}
            }
            sub = await reg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
            });
          } else {
            throw err;
          }
        }
      }

      stage = "save";
      await axios.post(
        "/api/push/subscribe",
        { subscription: sub.toJSON() },
        { headers: getAuthHeaders() },
      );
      setIsSubscribed(true);
      return true;
    } catch (e) {
      // Keep the real name/message: `AbortError: Registration failed - push
      // service error` (no Play Services / offline), `NotSupportedError`,
      // a 401 from our own save step — each needs a different fix, and the
      // only way anyone finds out which is if the app says so.
      const detail = {
        stage,
        name: e?.name || (e?.response ? `HTTP ${e.response.status}` : "Error"),
        message: e?.response?.data?.error || e?.message || "Unknown failure",
      };
      console.error("push subscribe failed:", detail, e);
      setLastError(detail);
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
  // already granted (keeps the server copy in sync after reinstalls/expiry, and
  // heals a subscription left behind by a VAPID key rotation).
  const ensureSubscribed = useCallback(async () => {
    if (!supported || Notification.permission !== "granted") return;
    try {
      const reg =
        (await registerServiceWorker()) ||
        (await navigator.serviceWorker.ready);
      await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (sub && !subscriptionMatchesCurrentKey(sub)) {
        // Bound to a key the server no longer signs with: every send would be
        // rejected with 403 while everything on this side looked healthy.
        // Tear it down so the subscribe below rebuilds it against the current
        // key — self-healing, because nobody would ever think to do it by hand.
        try {
          await sub.unsubscribe();
        } catch {
          // Even if the browser refuses, fall through and re-subscribe.
        }
        sub = null;
      }
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
    isSecureContext: secureContext,
    lastError,
    // Human-readable summary of the last failure, naming the step it died on.
    lastErrorMessage: lastError
      ? `${STAGE_LABELS[lastError.stage] || lastError.stage}: ${lastError.name} — ${lastError.message}`
      : null,
    // Machine-readable key plus the sentence to show. Null when push is
    // actually usable here.
    unavailableReason,
    unavailableMessage: unavailableReason
      ? PUSH_UNAVAILABLE_REASONS[unavailableReason]
      : null,
    // iOS user in a browser tab who must install the PWA before push works.
    iosNeedsInstall: ios && !standalone,
    subscribe,
    unsubscribe,
    ensureSubscribed,
  };
}
