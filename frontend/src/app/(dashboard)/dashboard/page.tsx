"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/header";
import { WorkspaceList } from "@/components/workspace/workspace-list";
import { api } from "@/lib/api";
import { useAppStore } from "@/store";
import type { User } from "@supabase/supabase-js";

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const { workspaces, setWorkspaces } = useAppStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });
    loadWorkspaces();
  }, []);

  const loadWorkspaces = async () => {
    try {
      const data = await api.workspaces.list();
      setWorkspaces(data);
    } catch (e) {
      console.error("Failed to load workspaces:", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header user={user} />
      <main className="flex-1 p-8 max-w-screen-2xl mx-auto w-full">
        {loading ? (
          <div className="space-y-8">
            {/* Welcome skeleton */}
            <div className="space-y-2">
              <div className="h-8 w-64 bg-muted rounded-md animate-pulse" />
              <div className="h-5 w-96 bg-muted rounded-md animate-pulse" />
            </div>
            {/* Cards skeleton */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-6 border rounded-xl space-y-3">
                  <div className="h-5 w-32 bg-muted rounded animate-pulse" />
                  <div className="h-4 w-48 bg-muted rounded animate-pulse" />
                  <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Welcome message area */}
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight">
                Welcome back{user?.user_metadata?.full_name ? `, ${user.user_metadata.full_name.split(' ')[0]}` : ''}
              </h1>
              <p className="text-muted-foreground">
                Manage your workspaces and explore your documents
              </p>
            </div>
            <WorkspaceList workspaces={workspaces} onRefresh={loadWorkspaces} />
          </div>
        )}
      </main>
    </div>
  );
}
