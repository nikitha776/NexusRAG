"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAppStore } from "@/store";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  MessageSquare,
  Home,
  MoreHorizontal,
  Pin,
  Pencil,
  Trash2,
  Check,
  X,
} from "lucide-react";

interface ChatSidebarProps {
  workspaceId: string;
  activeSessionId: string | null;
  onSessionSelect?: (sessionId: string) => void;
}

export function ChatSidebar({
  workspaceId,
  activeSessionId,
  onSessionSelect,
}: ChatSidebarProps) {
  const {
    chatSessions,
    setChatSessions,
    removeChatSession,
    updateChatSession,
  } = useAppStore();

  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  const loadSessions = async () => {
    try {
      const sessions = await api.chat.listSessions(workspaceId);
      setChatSessions(sessions);
    } catch {
      // Backend may be offline
    }
  };

  useEffect(() => {
    loadSessions();
  }, [workspaceId]);

  useEffect(() => {
    if (editingSessionId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingSessionId]);

  const handleNewChat = () => {
    onSessionSelect?.("__new__");
  };

  const handleTogglePin = async (
    sessionId: string,
    currentPinned: boolean | undefined,
  ) => {
    const newPinned = !currentPinned;
    updateChatSession(sessionId, { pinned: newPinned });
    try {
      await api.chat.updateSession(workspaceId, sessionId, {
        pinned: newPinned,
      });
    } catch {
      updateChatSession(sessionId, { pinned: currentPinned });
    }
  };

  const startRename = (sessionId: string, currentTitle: string) => {
    setEditingSessionId(sessionId);
    setEditTitle(currentTitle);
  };

  const commitRename = useCallback(
    async (sessionId: string) => {
      const newTitle = editTitle.trim();
      setEditingSessionId(null);
      if (!newTitle) return;

      const session = chatSessions.find((s) => s.id === sessionId);
      if (!session || session.title === newTitle) return;

      updateChatSession(sessionId, { title: newTitle });
      try {
        await api.chat.updateSession(workspaceId, sessionId, {
          title: newTitle,
        });
      } catch {
        updateChatSession(sessionId, { title: session.title });
      }
    },
    [editTitle, chatSessions, workspaceId, updateChatSession],
  );

  const cancelRename = useCallback(() => {
    setEditingSessionId(null);
    setEditTitle("");
  }, []);

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm("Delete this chat session?")) return;
    const isTemp = chatSessions.find((s) => s.id === sessionId)?.isTemporary;
    removeChatSession(sessionId);
    if (activeSessionId === sessionId) {
      onSessionSelect?.(null as unknown as string);
    }
    if (!isTemp) {
      try {
        await api.chat.deleteSession(workspaceId, sessionId);
      } catch {
        loadSessions();
      }
    }
  };

  const sortedSessions = [...chatSessions].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });

  return (
    <div className="flex flex-col h-full">
      {/* Home Button */}
      <div className="p-2">
        <Link href="/">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start h-9 text-xs text-muted-foreground hover:text-foreground rounded-xl"
          >
            <Home className="mr-2 h-3.5 w-3.5" />
            Home
          </Button>
        </Link>
      </div>

      {/* New Chat Button */}
      <div className="px-2 pb-3">
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2 h-10 rounded-xl text-sm font-medium border-border/60 shadow-sm hover:shadow-md transition-shadow"
          onClick={handleNewChat}
        >
          <Plus className="h-4 w-4" />
          New Chat
        </Button>
      </div>

      {/* Sessions List */}
      <ScrollArea className="flex-1">
        <div className="px-2 pb-2 space-y-1">
          {sortedSessions.map((session) => (
            <div
              key={session.id}
              className={`group relative flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 ${
                activeSessionId === session.id
                  ? "bg-primary/10 text-primary shadow-sm"
                  : "hover:bg-muted/60 text-foreground"
              }`}
              onClick={() => {
                if (editingSessionId !== session.id) {
                  onSessionSelect?.(session.id);
                }
              }}
              title={session.title}
            >
              {/* Active indicator */}
              {activeSessionId === session.id && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-full" />
              )}

              <div className={`p-1.5 rounded-lg ${
                activeSessionId === session.id
                  ? "bg-primary/20"
                  : "bg-muted/50 group-hover:bg-muted"
              } transition-colors`}>
                <MessageSquare
                  className={`h-3.5 w-3.5 flex-shrink-0 ${
                    activeSessionId === session.id
                      ? "text-primary"
                      : "text-muted-foreground"
                  }`}
                />
              </div>

              {editingSessionId === session.id ? (
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <input
                    ref={editInputRef}
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        commitRename(session.id);
                      } else if (e.key === "Escape") {
                        cancelRename();
                      }
                    }}
                    onBlur={() => commitRename(session.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs truncate flex-1 min-w-0 bg-transparent border border-border rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      commitRename(session.id);
                    }}
                    className="h-6 w-6 flex items-center justify-center rounded-lg hover:bg-emerald-100 flex-shrink-0"
                  >
                    <Check className="h-3 w-3 text-emerald-600" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      cancelRename();
                    }}
                    className="h-6 w-6 flex items-center justify-center rounded-lg hover:bg-red-100 flex-shrink-0"
                  >
                    <X className="h-3 w-3 text-red-500" />
                  </button>
                </div>
              ) : (
                <span className="text-xs truncate flex-1 flex items-center gap-1.5 font-medium">
                  {session.pinned && (
                    <Pin className="h-3 w-3 flex-shrink-0 text-primary fill-primary" />
                  )}
                  {session.title}
                </span>
              )}

              {editingSessionId !== session.id && (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className="h-7 w-7 inline-flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted focus:outline-none flex-shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-44 rounded-xl">
                    <DropdownMenuItem
                      onClick={() =>
                        handleTogglePin(session.id, session.pinned)
                      }
                      className="rounded-lg"
                    >
                      <Pin className="h-4 w-4 mr-2" />
                      {session.pinned ? "Unpin" : "Pin to top"}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => startRename(session.id, session.title)}
                      className="rounded-lg"
                    >
                      <Pencil className="h-4 w-4 mr-2" />
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => handleDeleteSession(session.id)}
                      className="rounded-lg"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
