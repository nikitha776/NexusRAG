"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Brain } from "lucide-react";

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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 relative overflow-hidden">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,_rgba(0,0,0,0.03)_1px,_transparent_0)] bg-[size:24px_24px] dark:bg-[radial-gradient(circle_at_1px_1px,_rgba(255,255,255,0.03)_1px,_transparent_0)]" />

      <Card className="w-full max-w-md shadow-lg border-0 ring-1 ring-black/5 dark:ring-white/10 relative z-10">
        <CardHeader className="text-center pt-10 pb-6">
          <div className="flex justify-center mb-5">
            <div className="p-4 rounded-2xl bg-primary/10">
              <Brain className="h-12 w-12 text-primary" />
            </div>
          </div>
          <CardTitle className="text-3xl tracking-tight">NexusRAG</CardTitle>
          <CardDescription className="text-base mt-2">
            Multi-Workspace AI Knowledge Platform
          </CardDescription>
          <p className="text-sm text-muted-foreground/70 mt-3">
            Organize, explore, and chat with your documents using AI
          </p>
        </CardHeader>
        <CardContent className="space-y-5 px-10 pb-10">
          <Button
            onClick={handleGoogleLogin}
            className="w-full h-11 font-medium shadow-sm"
            size="lg"
            variant="outline"
          >
            <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
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
            Sign in with Google
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            Sign in to create workspaces and interact with your documents
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
