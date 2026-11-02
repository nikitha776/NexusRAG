"use client";
import { Header } from "@/components/layout/header";
import type { User } from "@supabase/supabase-js";

export function MainLayout({ children, user }: { children: React.ReactNode; user?: User | null }) {
  return <div className="min-h-dvh bg-background"><Header user={user ?? null} /><main>{children}</main></div>;
}
