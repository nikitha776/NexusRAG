"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAppStore } from "@/store";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Plus, MessageSquare, Trash2 } from "lucide-react";
import type { ChatSession } from "@/types";

interface ChatSidebarProps {
  workspaceId: string;
  activeSessionId: string | null;
}

export function ChatSidebar({ workspaceId, activeSessionId }: ChatSidebarProps) {
  const router = useRouter();
  const { chatSessions, setChatSessions, addChatSession, removeChatSession } = useAppStore();
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadSessions();
  }, [workspaceId]);

  const loadSessions = async () => {
    try {
      const sessions = await api.chat.listSessions(workspaceId);
      setChatSessions(sessions);
    } catch (e) {
      console.error("Failed to load sessions:", e);
    }
  };

  const handleCreateSession = async () => {
    setCreating(true);
    try {
      const session = await api.chat.createSession(workspaceId);
      addChatSession(session);
      router.push(`/workspace/${workspaceId}/chat/${session.id}`);
    } catch (e) {
      console.error("Failed to create session:", e);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm("Delete this chat session?")) return;
    try {
      await api.chat.deleteSession(workspaceId, sessionId);
      removeChatSession(sessionId);
      if (activeSessionId === sessionId) {
        router.push(`/workspace/${workspaceId}`);
      }
    } catch (e) {
      console.error("Failed to delete session:", e);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4">
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2 h-9 font-medium"
          onClick={handleCreateSession}
          disabled={creating}
        >
          <Plus className="h-4 w-4" />
          New Chat
        </Button>
      </div>

      <Separator />

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-0.5">
          {chatSessions.map((session) => (
            <div
              key={session.id}
              className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                activeSessionId === session.id
                  ? "bg-primary/10 text-primary"
                  : "hover:bg-muted/60 text-foreground"
              }`}
              onClick={() => router.push(`/workspace/${workspaceId}/chat/${session.id}`)}
              title={session.title}
            >
              {activeSessionId === session.id && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-full" />
              )}
              <MessageSquare
                className={`h-4 w-4 flex-shrink-0 ${
                  activeSessionId === session.id
                    ? "text-primary"
                    : "text-muted-foreground"
                }`}
              />
              <span className="text-sm truncate flex-1">{session.title}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteSession(session.id);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
