"use client";

import { useEffect } from "react";
import { usePush } from "@/hooks/usePush";

// Mount once inside the dashboard/admin. When the user has already granted
// notification permission, it silently registers the service worker and keeps
// the push subscription in sync. Renders nothing. No-op on iOS/unsupported.
export default function PushManager() {
  const { supported, permission, ensureSubscribed } = usePush();

  useEffect(() => {
    if (supported && permission === "granted") {
      ensureSubscribed();
    }
  }, [supported, permission, ensureSubscribed]);

  return null;
}
