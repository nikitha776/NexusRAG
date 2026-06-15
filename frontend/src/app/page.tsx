"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAppStore } from "@/store";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowRight,
  BarChart3,
  Plus,
  LogOut,
  FileText,
  Calendar,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const { workspaces, setWorkspaces } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);

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
      
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWorkspace = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const ws = await api.workspaces.create({
        name: newName.trim(),
        description: newDesc.trim() || undefined,
      });
      setWorkspaces([ws, ...workspaces]);
      setShowCreateDialog(false);
      setNewName("");
      setNewDesc("");
      router.push(`/workspace/${ws.id}`);
    } catch (e) {
      
    } finally {
      setCreating(false);
    }
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  const initials = user?.user_metadata?.name
    ? user.user_metadata.name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
    : user?.email?.[0]?.toUpperCase() || "U";

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="h-14 border-b border-border/50 bg-card/80 backdrop-blur-sm flex items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-white font-bold text-sm">
              N
            </div>
            <span className="font-bold text-foreground">NexusRAG</span>
          </div>
        </header>
        <main className="p-6 max-w-7xl mx-auto">
          <div className="space-y-6 animate-pulse">
            <div className="h-8 w-40 bg-muted rounded" />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-40 bg-muted rounded-lg" />
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar */}
      <header className="h-14 border-b border-border/50 bg-card/80 backdrop-blur-sm flex items-center justify-between px-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-white font-bold text-sm">
            N
          </div>
          <span className="font-bold text-foreground">NexusRAG</span>
        </div>

        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 hover:bg-muted/50 rounded-lg px-2 py-1 transition-colors cursor-pointer">
              <Avatar className="h-7 w-7">
                <AvatarImage src={user.user_metadata?.avatar_url} />
                <AvatarFallback className="text-[10px] bg-primary/20 text-primary font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm text-foreground hidden sm:inline">
                {user.user_metadata?.name || user.email}
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem className="text-destructive" onClick={handleSignOut}>
                <LogOut className="w-3 h-3 mr-2" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </header>

      <main className="p-6 max-w-7xl mx-auto space-y-8">
        {/* Welcome */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">
            Welcome{user?.user_metadata?.name ? `, ${user.user_metadata.name.split(" ")[0]}` : ""}
          </h1>
          <p className="text-foreground/60">
            Select a workspace to get started, or create a new one.
          </p>
        </div>

        {/* Workspaces */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-foreground">Your Workspaces</h2>
            <Button
              className="gap-2"
              onClick={() => setShowCreateDialog(true)}
            >
              <Plus className="w-4 h-4" />
              New Workspace
            </Button>
          </div>

          {workspaces.length === 0 ? (
            <Card className="p-12 text-center">
              <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-1">
                No workspaces yet
              </h3>
              <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                Create your first workspace to start organizing documents and having conversations.
              </p>
              <Button
                className="gap-2"
                onClick={() => setShowCreateDialog(true)}
              >
                <Plus className="w-4 h-4" />
                Create Workspace
              </Button>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {workspaces.map((workspace) => (
                <Card
                  key={workspace.id}
                  className="p-6 cursor-pointer group hover:shadow-lg hover:border-primary/30 transition-all h-full"
                  onClick={() => router.push(`/workspace/${workspace.id}`)}
                >
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors text-lg mb-1">
                        {workspace.name}
                      </h3>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {workspace.description || "No description"}
                      </p>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        {workspace.document_count} documents
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(workspace.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    <Button
                      className="w-full gap-2 group"
                      variant="outline"
                    >
                      Open
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Create Workspace Dialog */}
      {showCreateDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-lg shadow-xl border border-border p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-semibold text-foreground mb-4">
              Create Workspace
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">
                  Name
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g., Marketing Strategy"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateWorkspace();
                  }}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">
                  Description <span className="text-muted-foreground">(optional)</span>
                </label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="What is this workspace about?"
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateDialog(false);
                  setNewName("");
                  setNewDesc("");
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateWorkspace}
                disabled={!newName.trim() || creating}
              >
                {creating ? "Creating..." : "Create"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
