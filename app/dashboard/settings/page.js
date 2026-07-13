"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import axios from "axios";
import toast from "react-hot-toast";
import { ArrowLeft, Mail, BellRing } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { usePush } from "@/hooks/usePush";
import { Switch } from "@/components/ui/switch";

export default function SettingsPage() {
  const router = useRouter();
  const { user, loading, getAuthHeaders } = useAuth();
  const push = usePush();

  const [emailOn, setEmailOn] = useState(true);
  const [pushOn, setPushOn] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await axios.get("/api/auth/me", {
          headers: getAuthHeaders(),
        });
        if (!active) return;
        setEmailOn(res.data?.emailNotifications !== false);
        setPushOn(res.data?.pushNotifications !== false);
      } catch (e) {
        // keep defaults
      } finally {
        if (active) setReady(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [getAuthHeaders]);

  const save = async (patch) => {
    setSaving(true);
    try {
      await axios.put("/api/user/settings", patch, {
        headers: getAuthHeaders(),
      });
    } catch (e) {
      toast.error("Greška pri čuvanju");
      throw e;
    } finally {
      setSaving(false);
    }
  };

  const handleEmail = async (checked) => {
    const prev = emailOn;
    setEmailOn(checked);
    try {
      await save({ emailNotifications: checked });
      toast.success(checked ? "Email obaveštenja uključena" : "Email obaveštenja isključena");
    } catch {
      setEmailOn(prev);
    }
  };

  const handlePush = async (checked) => {
    const prev = pushOn;
    setPushOn(checked);
    try {
      if (checked) {
        const ok = await push.subscribe();
        if (!ok) {
          setPushOn(prev);
          toast.error(
            push.permission === "denied"
              ? "Notifikacije su blokirane u browseru."
              : "Nije moguće uključiti push na ovom uređaju.",
          );
          return;
        }
      } else {
        await push.unsubscribe();
      }
      await save({ pushNotifications: checked });
      toast.success(checked ? "Push notifikacije uključene" : "Push notifikacije isključene");
    } catch {
      setPushOn(prev);
    }
  };

  if (loading || !user) return null;

  return (
    <div className="min-h-screen bg-[#0f0f10] text-white">
      <header className="bg-[#1a1a1b] border-b border-white/10 px-3 lg:px-6 py-4">
        <div className="container mx-auto flex items-center gap-3 px-1 lg:px-3">
          <Link
            href="/dashboard"
            className="text-gray-400 hover:text-white flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Dashboard</span>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <h1 className="text-2xl font-bold mb-1">Podešavanja obaveštenja</h1>
        <p className="text-gray-400 text-sm mb-8">
          Izaberi kako želiš da te obaveštavamo o porukama i aktivnostima.
        </p>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 bg-[#1a1a1b] border border-white/10 rounded-xl p-4">
            <div className="flex gap-3">
              <Mail className="w-5 h-5 text-[#FFB633] shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Email obaveštenja</p>
                <p className="text-sm text-gray-400">
                  Zbirni email o novim porukama (šalje se povremeno, ne za svaku poruku).
                </p>
              </div>
            </div>
            <Switch
              checked={emailOn}
              onCheckedChange={handleEmail}
              disabled={!ready || saving}
            />
          </div>

          <div className="flex items-center justify-between gap-4 bg-[#1a1a1b] border border-white/10 rounded-xl p-4">
            <div className="flex gap-3">
              <BellRing className="w-5 h-5 text-[#FFB633] shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Push notifikacije</p>
                <p className="text-sm text-gray-400">
                  {push.supported
                    ? "Obaveštenja na ovom uređaju, i kada aplikacija nije otvorena."
                    : push.iosNeedsInstall
                      ? "Na iPhone-u: dodaj app na početni ekran (Share → „Add to Home Screen”) pa je otvori odatle da uključiš push."
                      : "Nije podržano na ovom uređaju/browseru."}
                </p>
              </div>
            </div>
            <Switch
              checked={pushOn && push.supported}
              onCheckedChange={handlePush}
              disabled={!ready || saving || !push.supported || push.busy}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
