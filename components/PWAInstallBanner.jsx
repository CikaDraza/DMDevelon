"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { isIOS } from "@/hooks/usePush";

const DISMISS_KEY = "pwa-banner-dismissed";

// Mobile-only "Install app" banner. Fully disabled on iOS (Apple's PWA/push
// handling breaks the dashboard), and hidden once installed or dismissed.
export default function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || isIOS()) return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;

    // Already installed / running standalone → nothing to prompt.
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;
    if (standalone) return;

    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    if (!isMobile) return;

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    const installed = () => setVisible(false);
    window.addEventListener("appinstalled", installed);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  const dismiss = () => {
    setVisible(false);
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
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 md:hidden p-3">
      <div className="mx-auto max-w-md flex items-center gap-3 bg-[#1a1a1b] border border-[#FFB633]/30 rounded-xl px-4 py-3 shadow-lg">
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-medium">Instaliraj aplikaciju</p>
          <p className="text-gray-400 text-xs">
            Dodaj DMDevelon na početni ekran i primaj notifikacije.
          </p>
        </div>
        <button
          onClick={install}
          className="flex items-center gap-1.5 bg-[#FFB633] text-black text-sm font-semibold px-3 py-2 rounded-lg shrink-0"
        >
          <Download className="w-4 h-4" />
          Instaliraj
        </button>
        <button
          onClick={dismiss}
          aria-label="Zatvori"
          className="text-gray-400 hover:text-white shrink-0"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
