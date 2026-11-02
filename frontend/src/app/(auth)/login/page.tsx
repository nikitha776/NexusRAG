"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { BookOpen, Sparkles, FileText, MessageSquare } from "lucide-react";

export default function LoginPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Back from Google can restore this page from the browser's cache,
    // including its previous "Connecting" state, without mounting it again.
    const resetConnecting = () => setLoading(false);
    window.addEventListener("pageshow", resetConnecting);
    window.addEventListener("popstate", resetConnecting);
    return () => {
      window.removeEventListener("pageshow", resetConnecting);
      window.removeEventListener("popstate", resetConnecting);
    };
  }, []);

  const handleGoogleLogin = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in is unavailable. Please retry.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="workspace-shell welcome-page min-h-dvh flex flex-col px-5 py-6 sm:px-10">
      <header className="flex items-center gap-2.5 text-sm font-semibold">
        <span className="welcome-brand"><BookOpen className="size-4" /></span>
        NexusRAG
      </header>
      <main className="flex flex-1 items-center justify-center py-12">
        <section className="welcome-card w-full max-w-[380px] p-7 sm:p-9" aria-labelledby="login-title">
          <div className="welcome-brand mb-6 size-11"><Sparkles className="size-5" /></div>
          <p className="text-xs text-muted-foreground">A space for your knowledge</p>
          <h1 id="login-title" className="mt-2 text-2xl font-medium tracking-tight">Welcome to NexusRAG</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Bring your documents together and find a little clarity, one question at a time.</p>
          {error && <p role="alert" className="mt-5 rounded-xl border border-destructive/30 p-3 text-sm text-destructive">{error}</p>}
          <Button onClick={handleGoogleLogin} disabled={loading} className="mt-7 h-11 w-full rounded-full gap-2.5 text-sm shadow-none">
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            {loading ? "Connecting…" : "Continue with Google"}
          </Button>
          <div className="mt-7 border-t border-border/50 pt-5 space-y-3">
            {[
              { icon: FileText, label: "Keep your documents in one place" },
              { icon: MessageSquare, label: "Ask questions in your own words" },
              { icon: Sparkles, label: "Explore answers with clear sources" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3 text-xs text-muted-foreground">
                <Icon className="size-3.5 shrink-0" /><span>{label}</span>
              </div>
            ))}
          </div>
        </section>
      </main>
      <footer className="text-center text-xs text-muted-foreground">Your documents. A clearer perspective.</footer>
    </div>
  );
}
