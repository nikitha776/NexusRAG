"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { api } from "@/lib/api";
import { useAppStore } from "@/store";
import { Header } from "@/components/layout/header";
import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { ChatInterface } from "@/components/chat/chat-interface";
import { DocumentManager } from "@/components/documents/document-manager";
import { FileSelector } from "@/components/documents/file-selector";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft } from "lucide-react";
import type { User } from "@supabase/supabase-js";

export default function ChatSessionPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.workspaceId as string;
  const sessionId = params.sessionId as string;

  const [user, setUser] = useState<User | null>(null);
  const { setActiveWorkspace, setDocuments, setChatSessions } = useAppStore();
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const [workspace, docs, sessions] = await Promise.all([
        api.workspaces.get(workspaceId),
        api.documents.list(workspaceId),
        api.chat.listSessions(workspaceId),
      ]);
      setActiveWorkspace(workspace);
      setDocuments(docs);
      const currentTemps = useAppStore.getState().chatSessions.filter((s) => s.isTemporary);
      setChatSessions([...currentTemps, ...sessions]);
    } catch (e) {
      console.error("Failed to load data:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    loadData();
  }, [workspaceId]);

  if (loading) {
    return (
      <div className="h-screen flex flex-col bg-background">
        <Header user={user} />
        <div className="flex-1 flex overflow-hidden">
          <aside className="w-56 border-r border-border/60 bg-card flex flex-col">
            <div className="p-3 space-y-2">
              <div className="h-7 w-full bg-muted rounded animate-pulse" />
              <div className="h-7 w-full bg-muted rounded animate-pulse" />
            </div>
          </aside>
          <main className="flex-1 flex flex-col items-center justify-center">
            <div className="space-y-2 text-center">
              <div className="h-5 w-40 bg-muted rounded animate-pulse mx-auto" />
              <div className="h-4 w-56 bg-muted rounded animate-pulse mx-auto" />
            </div>
          </main>
          <aside className="w-64 border-l border-border/60 bg-card flex flex-col">
            <div className="p-4 space-y-3">
              <div className="h-8 w-full bg-muted rounded animate-pulse" />
              <div className="h-16 w-full bg-muted rounded animate-pulse" />
            </div>
          </aside>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      <Header user={user} />
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Chat Sessions Sidebar */}
        <aside className="w-56 border-r border-border/60 bg-card flex flex-col shrink-0">
          <div className="p-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/workspace/${workspaceId}`)}
              className="w-full justify-start h-7 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
              Workspace
            </Button>
          </div>
          <Separator className="opacity-40" />
          <ChatSidebar workspaceId={workspaceId} activeSessionId={sessionId} />
        </aside>

        {/* Chat Interface */}
        <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
          <ChatInterface workspaceId={workspaceId} sessionId={sessionId} />
        </main>

        {/* Sources Panel */}
        <aside className="w-64 border-l border-border/60 bg-card flex flex-col shrink-0">
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-5">
              <DocumentManager workspaceId={workspaceId} />
              <Separator className="opacity-40" />
              <FileSelector workspaceId={workspaceId} />
            </div>
          </ScrollArea>
        </aside>
      </div>
    </div>
  );
}
