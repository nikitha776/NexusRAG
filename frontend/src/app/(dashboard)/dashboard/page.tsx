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
    <div className="min-h-screen flex flex-col">
      <Header user={user} />
      <main className="flex-1 p-6 max-w-screen-2xl mx-auto w-full">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <WorkspaceList workspaces={workspaces} onRefresh={loadWorkspaces} />
        )}
      </main>
    </div>
  );
}
