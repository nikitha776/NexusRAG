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
      <div className="flex-1 flex">
        {/* Left Sidebar - Documents & File Selector */}
        <aside className="w-80 border-r bg-muted/30 flex flex-col">
          <div className="p-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/dashboard")}
              className="mb-3"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
            <h2 className="text-lg font-bold">{activeWorkspace?.name}</h2>
            {activeWorkspace?.description && (
              <p className="text-sm text-muted-foreground mt-1">
                {activeWorkspace.description}
              </p>
            )}
          </div>

          <Separator />

          <div className="flex-1 overflow-auto p-4 space-y-6">
            <DocumentManager workspaceId={workspaceId} />
            <Separator />
            <FileSelector workspaceId={workspaceId} />
          </div>
        </aside>

        {/* Main Content - Chat Sessions */}
        <main className="flex-1 flex flex-col">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="font-semibold">Chat Sessions</h3>
            <Button size="sm" onClick={handleNewChat}>
              <Plus className="mr-2 h-4 w-4" />
              New Chat
            </Button>
          </div>

          <div className="flex-1 overflow-auto p-4">
            {chatSessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No chat sessions yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Upload documents, select files, and start asking questions
                </p>
                <Button onClick={handleNewChat}>
                  <Plus className="mr-2 h-4 w-4" />
                  Start a Chat
                </Button>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {chatSessions.map((session) => (
                  <div
                    key={session.id}
                    className="p-4 border rounded-lg cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() =>
                      router.push(`/workspace/${workspaceId}/chat/${session.id}`)
                    }
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <MessageSquare className="h-4 w-4 text-primary" />
                      <span className="font-medium text-sm truncate">
                        {session.title}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(session.updated_at).toLocaleDateString()}
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
