"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/header";
import { WorkspaceList } from "@/components/workspace/workspace-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useAppStore } from "@/store";
import type { User } from "@supabase/supabase-js";

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const { workspaces, setWorkspaces } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    createClient().auth.getUser().then(({ data }) => { if (!cancelled) setUser(data.user); });
    api.workspaces.list().then((data) => { if (!cancelled) { setWorkspaces(data); setError(null); } })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Could not load workspaces."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [reload, setWorkspaces]);

  const visible = workspaces.filter((ws) => `${ws.name} ${ws.description || ""}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="workspace-shell welcome-page min-h-dvh"><Header user={user} /><main className="max-w-5xl mx-auto px-5 py-6 sm:px-8 sm:py-9 space-y-6">
    <section className="welcome-card p-6 sm:p-7">
      <p className="text-xs font-medium text-muted-foreground">Your knowledge, connected</p>
      <h1 className="mt-2 text-2xl font-medium tracking-tight">Welcome back{user?.user_metadata?.full_name ? `, ${user.user_metadata.full_name.split(" ")[0]}` : ""}</h1>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">Bring your documents together. Ask questions, compare ideas, and trace answers back to their sources.</p>
      {!loading && !error && <p className="mt-5 text-xs text-muted-foreground">{workspaces.length} workspace{workspaces.length === 1 ? "" : "s"} · {workspaces.reduce((sum, ws) => sum + ws.document_count, 0)} documents</p>}
    </section>
    {error && <div role="alert" className="rounded-xl border border-destructive/30 p-4 text-sm flex flex-wrap items-center gap-3"><span className="flex-1">{error}</span><Button variant="outline" onClick={() => { setLoading(true); setReload((n) => n + 1); }}>Retry</Button></div>}
    {loading ? <div role="status" aria-label="Loading workspaces" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[1, 2, 3].map((n) => <div key={n} className="h-40 rounded-2xl bg-muted animate-pulse" />)}</div> : !error && <>
      {workspaces.length > 0 && <Input aria-label="Search workspaces" placeholder="Search workspaces…" value={search} onChange={(e) => setSearch(e.target.value)} className="welcome-search max-w-xs rounded-full shadow-none" />}
      <WorkspaceList workspaces={visible} isFiltered={Boolean(search)} onRefresh={() => setReload((n) => n + 1)} />
    </>}
  </main></div>;
}
