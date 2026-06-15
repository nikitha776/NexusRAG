"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { BookOpen, Sparkles, FileText, MessageSquare } from "lucide-react";

export default function LoginPage() {
  const supabase = createClient();

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      {/* Subtle background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 -left-32 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 rounded-full bg-accent/5 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-primary/3 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-sm px-6">
        {/* Logo and branding */}
        <div className="text-center mb-10">
          <div className="relative inline-block mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/25">
              <BookOpen className="h-8 w-8 text-primary-foreground" />
            </div>
            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-accent flex items-center justify-center">
              <Sparkles className="h-3 w-3 text-accent-foreground" />
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight mb-2">NexusRAG</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            AI-powered document analysis and knowledge retrieval
          </p>
        </div>

        {/* Login card */}
        <div className="bg-card border border-border/60 rounded-2xl p-6 shadow-sm mb-8">
          <Button
            onClick={handleGoogleLogin}
            className="w-full h-11 font-medium rounded-xl gap-2.5 bg-foreground text-background hover:bg-foreground/90 shadow-sm"
          >
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
            Continue with Google
          </Button>
        </div>

        {/* Features preview */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { icon: FileText, label: "Upload docs" },
            { icon: MessageSquare, label: "Ask questions" },
            { icon: Sparkles, label: "Get answers" },
          ].map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex flex-col items-center gap-2 p-3 rounded-xl bg-muted/50 border border-border/40"
            >
              <Icon className="h-4 w-4 text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground font-medium">{label}</span>
            </div>
          ))}
        </div>

        <p className="text-[11px] text-center text-muted-foreground/70">
          By continuing, you agree to our Terms of Service
        </p>
      </div>
    </div>
  );
}
