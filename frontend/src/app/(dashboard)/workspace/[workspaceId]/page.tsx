"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAppStore } from "@/store";
import { api } from "@/lib/api";
import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { ChatInterface } from "@/components/chat/chat-interface";
import { DocumentManager } from "@/components/documents/document-manager";
import { FileSelector } from "@/components/documents/file-selector";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { BookOpen } from "lucide-react";
import type { ChatSession } from "@/types";
import type { User } from "@supabase/supabase-js";

export default function WorkspacePage() {
  const params = useParams();
  const workspaceId = params.workspaceId as string;

  const [user, setUser] = useState<User | null>(null);
  const {
    activeWorkspace,
    setActiveWorkspace,
    setDocuments,
    setMessages,
    setChatSessions,
    addChatSession,
    activeSessionId,
    setActiveSessionId,
  } = useAppStore();

  const [loading, setLoading] = useState(true);

  const loadWorkspaceData = useCallback(async () => {
    try {
      setLoading(true);
      // Reset chat state when switching workspaces
      setActiveSessionId(null);
      setMessages([]);
      const [workspaceData, docsData, sessionsData] = await Promise.all([
        api.workspaces.get(workspaceId),
        api.documents.list(workspaceId),
        api.chat.listSessions(workspaceId),
      ]);
      setActiveWorkspace(workspaceData);
      setDocuments(docsData);
      setChatSessions(sessionsData);
    } catch {
      // Backend may be offline
    } finally {
      setLoading(false);
    }
  }, [workspaceId, setActiveWorkspace, setDocuments, setMessages, setChatSessions, setActiveSessionId]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });
    loadWorkspaceData();
  }, [loadWorkspaceData]);

  const handleSessionSelect = (sessionId: string) => {
    setActiveSessionId(sessionId);
  };

  // Called when the first message is sent and the real session is created via API
  const handleSessionCreated = (session: ChatSession) => {
    addChatSession(session);
    setActiveSessionId(session.id);
  };

  if (loading) {
    return (
      <div className="h-screen flex flex-col bg-background">
        <div className="flex-1 flex overflow-hidden">
          {/* Left sidebar skeleton */}
          <aside className="w-60 border-r border-border/60 bg-card flex flex-col shrink-0">
            <div className="p-3 space-y-2">
              <div className="h-8 w-full bg-muted rounded animate-pulse" />
              <div className="h-8 w-full bg-muted rounded animate-pulse" />
              <div className="h-7 w-full bg-muted rounded animate-pulse" />
              <div className="h-7 w-full bg-muted rounded animate-pulse" />
            </div>
          </aside>

          {/* Center skeleton */}
          <main className="flex-1 flex flex-col items-center justify-center">
            <div className="space-y-2 text-center">
              <div className="h-5 w-40 bg-muted rounded animate-pulse mx-auto" />
              <div className="h-4 w-56 bg-muted rounded animate-pulse mx-auto" />
            </div>
          </main>

          {/* Right panel skeleton */}
          <aside className="w-72 border-l border-border/60 bg-card flex flex-col shrink-0">
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
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Left Sidebar — Chat Sessions */}
        <aside className="w-64 border-r border-border/60 bg-card/50 flex flex-col shrink-0">
          <div className="p-3 border-b border-border/40">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <BookOpen className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-semibold text-foreground truncate">
                  {activeWorkspace?.name || "Workspace"}
                </h2>
                {activeWorkspace?.description && (
                  <p className="text-[11px] text-muted-foreground truncate">
                    {activeWorkspace.description}
                  </p>
                )}
              </div>
            </div>
          </div>
          <ChatSidebar
            workspaceId={workspaceId}
            activeSessionId={activeSessionId}
            onSessionSelect={handleSessionSelect}
          />
        </aside>

        {/* Center — Chat Interface */}
        <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
          <ChatInterface
            workspaceId={workspaceId}
            sessionId={activeSessionId}
            onSessionCreated={handleSessionCreated}
          />
        </main>

        {/* Right Panel — Documents */}
        <aside className="w-80 border-l border-border/60 bg-card/50 flex flex-col shrink-0">
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-6">
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
