"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAppStore } from "@/store";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Plus, MessageSquare, Trash2, ArrowLeft } from "lucide-react";
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
      <div className="p-3">
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start"
          onClick={handleCreateSession}
          disabled={creating}
        >
          <Plus className="mr-2 h-4 w-4" />
          New Chat
        </Button>
      </div>

      <Separator />

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {chatSessions.map((session) => (
            <div
              key={session.id}
              className={`group flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-muted/50 ${
                activeSessionId === session.id ? "bg-muted" : ""
              }`}
              onClick={() => router.push(`/workspace/${workspaceId}/chat/${session.id}`)}
            >
              <MessageSquare className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-sm truncate flex-1">{session.title}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteSession(session.id);
                }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
