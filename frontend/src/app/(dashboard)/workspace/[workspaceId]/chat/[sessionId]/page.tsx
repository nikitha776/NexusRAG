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
  const [showDocs, setShowDocs] = useState(true);

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
      console.error("Failed to load data:", e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header user={user} />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header user={user} />
      <div className="flex-1 flex overflow-hidden">
        {/* Chat Sessions Sidebar */}
        <aside className="w-56 border-r bg-muted/20 flex flex-col">
          <div className="p-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/workspace/${workspaceId}`)}
              className="w-full justify-start"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Workspace
            </Button>
          </div>
          <Separator />
          <ChatSidebar workspaceId={workspaceId} activeSessionId={sessionId} />
        </aside>

        {/* Chat Interface */}
        <main className="flex-1 flex flex-col">
          <ChatInterface workspaceId={workspaceId} sessionId={sessionId} />
        </main>

        {/* Document Panel */}
        <aside className="w-72 border-l bg-muted/20 flex flex-col">
          <ScrollArea className="flex-1 p-4 space-y-6">
            <DocumentManager workspaceId={workspaceId} />
            <Separator className="my-4" />
            <FileSelector workspaceId={workspaceId} />
          </ScrollArea>
        </aside>
      </div>
    </div>
  );
}
