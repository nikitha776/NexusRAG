"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { api } from "@/lib/api";
import { useAppStore } from "@/store";
import { Header } from "@/components/layout/header";
import { DocumentManager } from "@/components/documents/document-manager";
import { FileSelector } from "@/components/documents/file-selector";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Plus, MessageSquare } from "lucide-react";
import type { User } from "@supabase/supabase-js";

export default function WorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.workspaceId as string;

  const [user, setUser] = useState<User | null>(null);
  const { activeWorkspace, setActiveWorkspace, setDocuments, chatSessions, setChatSessions, addChatSession } =
    useAppStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    loadData();
  }, [workspaceId]);

  const loadData = async () => {
    try {
      const [workspace, docs, sessions] = await Promise.all([
        api.workspaces.get(workspaceId),
        api.documents.list(workspaceId),
        api.chat.listSessions(workspaceId),
      ]);
      setActiveWorkspace(workspace);
      setDocuments(docs);
      setChatSessions(sessions);
    } catch (e) {
      console.error("Failed to load workspace:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleNewChat = async () => {
    try {
      const session = await api.chat.createSession(workspaceId);
      addChatSession(session);
      router.push(`/workspace/${workspaceId}/chat/${session.id}`);
    } catch (e) {
      console.error("Failed to create chat:", e);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header user={user} />
        <div className="flex-1 flex">
          {/* Sidebar skeleton */}
          <aside className="w-80 border-r border-border/50 bg-muted/20 flex flex-col">
            <div className="p-5 space-y-4">
              <div className="h-8 w-24 bg-muted rounded animate-pulse" />
              <div className="h-6 w-48 bg-muted rounded animate-pulse" />
              <div className="h-4 w-36 bg-muted rounded animate-pulse" />
            </div>
            <div className="flex-1 p-5 space-y-4">
              <div className="h-10 w-full bg-muted rounded animate-pulse" />
              <div className="h-20 w-full bg-muted rounded animate-pulse" />
            </div>
          </aside>
          {/* Main skeleton */}
          <main className="flex-1 p-6">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-5 border rounded-xl space-y-3">
                  <div className="h-5 w-32 bg-muted rounded animate-pulse" />
                  <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                </div>
              ))}
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header user={user} />
      <div className="flex-1 flex">
        {/* Left Sidebar - Documents & File Selector */}
        <aside className="w-80 border-r border-border/50 bg-muted/20 flex flex-col">
          <div className="p-5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/dashboard")}
              className="mb-4 -ml-1 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
            <h2 className="text-lg font-semibold tracking-tight">{activeWorkspace?.name}</h2>
            {activeWorkspace?.description && (
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                {activeWorkspace.description}
              </p>
            )}
          </div>

          <Separator className="opacity-50" />

          <div className="flex-1 overflow-auto p-5 space-y-6">
            <DocumentManager workspaceId={workspaceId} />
            <Separator className="opacity-50" />
            <FileSelector workspaceId={workspaceId} />
          </div>
        </aside>

        {/* Main Content - Chat Sessions */}
        <main className="flex-1 flex flex-col">
          <div className="p-5 border-b border-border/50 flex items-center justify-between">
            <h3 className="font-semibold tracking-tight">Chat Sessions</h3>
            <Button size="sm" onClick={handleNewChat} className="shadow-sm">
              <Plus className="mr-2 h-4 w-4" />
              New Chat
            </Button>
          </div>

          <div className="flex-1 overflow-auto p-6">
            {chatSessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-16">
                <div className="p-4 rounded-2xl bg-muted/50 mb-5">
                  <MessageSquare className="h-10 w-10 text-muted-foreground/60" />
                </div>
                <h3 className="text-lg font-medium mb-2">No chat sessions yet</h3>
                <p className="text-sm text-muted-foreground mb-5 max-w-sm">
                  Upload documents, select files, and start asking questions about your knowledge base
                </p>
                <Button onClick={handleNewChat} className="shadow-sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Start a Chat
                </Button>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {chatSessions.map((session) => (
                  <div
                    key={session.id}
                    className="p-5 border border-border/60 rounded-xl cursor-pointer hover:shadow-md hover:border-border transition-all duration-200 group"
                    onClick={() =>
                      router.push(`/workspace/${workspaceId}/chat/${session.id}`)
                    }
                  >
                    <div className="flex items-center gap-2.5 mb-2.5">
                      <div className="p-1.5 rounded-lg bg-primary/10 group-hover:bg-primary/15 transition-colors">
                        <MessageSquare className="h-4 w-4 text-primary" />
                      </div>
                      <span className="font-medium text-sm truncate">
                        {session.title}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(session.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
