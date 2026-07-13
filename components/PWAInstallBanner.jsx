"use client";

import { useEffect, useState } from "react";
import { Download, X, Share } from "lucide-react";
import { isIOS, isStandalone } from "@/hooks/usePush";

const DISMISS_KEY = "pwa-banner-dismissed";

// Mobile-only "Install app" banner, shown until installed or dismissed.
//   - Android/Chromium: uses the native `beforeinstallprompt` (one-tap install).
//   - iOS: no such event exists, so we show manual "Add to Home Screen"
//     instructions — this is the only way iOS users can later enable push.
export default function PWAInstallBanner() {
  const [mode, setMode] = useState(null); // null | "android" | "ios"
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;
    if (isStandalone()) return; // already installed → nothing to prompt

    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    if (!isMobile) return;

    if (isIOS()) {
      setMode("ios");
      return;
    }

    // Android/Chromium: wait for the installability event.
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setMode("android");
    };
    window.addEventListener("beforeinstallprompt", handler);
    const installed = () => setMode(null);
    window.addEventListener("appinstalled", installed);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  const dismiss = () => {
    setMode(null);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
  };

  const install = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    try {
      await deferredPrompt.userChoice;
    } catch {}
    setDeferredPrompt(null);
    setMode(null);
  };

  if (!mode) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 md:hidden p-3">
      <div className="mx-auto max-w-md flex items-start gap-3 bg-[#1a1a1b] border border-[#FFB633]/30 rounded-xl px-4 py-3 shadow-lg">
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-medium">Install the app</p>
          {mode === "android" ? (
            <p className="text-gray-400 text-xs">
              Add DMDevelon to your home screen and get notifications.
            </p>
          ) : (
            <p className="text-gray-400 text-xs leading-relaxed">
              For push notifications, add to your home screen: tap{" "}
              <Share className="inline w-3.5 h-3.5 -mt-0.5" />{" "}
              <strong className="text-gray-300">Share</strong>, then{" "}
              <strong className="text-gray-300">“Add to Home Screen”</strong>,
              and open the app from there.
            </p>
          )}
        </div>
        {mode === "android" && (
          <button
            onClick={install}
            className="flex items-center gap-1.5 bg-[#FFB633] text-black text-sm font-semibold px-3 py-2 rounded-lg shrink-0"
          >
            <Download className="w-4 h-4" />
            Install
          </button>
        )}
        <button
          onClick={dismiss}
          aria-label="Close"
          className="text-gray-400 hover:text-white shrink-0"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
