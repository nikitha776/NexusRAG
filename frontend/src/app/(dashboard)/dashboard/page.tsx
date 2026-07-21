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

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });
    loadWorkspaces();
  }, []);

  return (
    <div className="h-screen flex flex-col bg-background">
      <Header user={user} />
      <main className="flex-1 overflow-auto p-6 max-w-screen-xl mx-auto w-full">
        {loading ? (
          <div className="space-y-6">
            <div className="space-y-1.5">
              <div className="h-5 w-40 bg-muted rounded animate-pulse" />
              <div className="h-4 w-64 bg-muted rounded animate-pulse" />
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-4 border rounded-xl space-y-2.5">
                  <div className="h-4 w-28 bg-muted rounded animate-pulse" />
                  <div className="h-3 w-40 bg-muted rounded animate-pulse" />
                  <div className="h-3 w-20 bg-muted rounded animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-0.5">
              <h1 className="text-lg font-semibold tracking-tight">
                Welcome back{user?.user_metadata?.full_name ? `, ${user.user_metadata.full_name.split(' ')[0]}` : ''}
              </h1>
              <p className="text-sm text-muted-foreground">
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
