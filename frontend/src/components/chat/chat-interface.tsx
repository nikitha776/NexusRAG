"use client";

import { useState, useRef, useEffect } from "react";
import { api } from "@/lib/api";
import { useAppStore } from "@/store";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Send, Loader2, FileText, Sparkles, User } from "lucide-react";
import type { ChatMessage } from "@/types";

interface ChatInterfaceProps {
  workspaceId: string;
  sessionId: string;
}

export function ChatInterface({ workspaceId, sessionId }: ChatInterfaceProps) {
  const { messages, setMessages, addMessage, selectedDocIds, isLoading, setIsLoading } =
    useAppStore();
  const [query, setQuery] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMessages();
  }, [sessionId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const loadMessages = async () => {
    try {
      const msgs = await api.chat.listMessages(workspaceId, sessionId);
      setMessages(msgs);
    } catch (e) {
      console.error("Failed to load messages:", e);
    }
  };

  const handleSend = async () => {
    if (!query.trim() || isLoading) return;
    if (selectedDocIds.size === 0) {
      alert("Please select at least one document for retrieval.");
      return;
    }

    const userQuery = query.trim();
    setQuery("");

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: userQuery,
      citations: null,
      selected_doc_ids: Array.from(selectedDocIds),
      created_at: new Date().toISOString(),
    };
    addMessage(userMsg);
    setIsLoading(true);

    try {
      const response = await api.rag.query(workspaceId, {
        query: userQuery,
        session_id: sessionId,
        selected_doc_ids: Array.from(selectedDocIds),
      });
      addMessage(response);
    } catch (e) {
      console.error("RAG query failed:", e);
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Sorry, I encountered an error processing your query. Please try again.",
        citations: null,
        selected_doc_ids: null,
        created_at: new Date().toISOString(),
      };
      addMessage(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Ask anything about your documents</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Select documents from the sidebar and type your question. The AI will search
              through your selected files and provide context-aware answers with citations.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {messages.map((msg) => (
              <div key={msg.id} className="space-y-3">
                <div className="flex items-start gap-3">
                  <div
                    className={`flex-shrink-0 p-2 rounded-full ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    {msg.role === "user" ? (
                      <User className="h-4 w-4" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <p className="text-sm font-medium">
                      {msg.role === "user" ? "You" : "NexusRAG"}
                    </p>
                    <div className="prose prose-sm max-w-none">
                      <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                    </div>

                    {msg.citations && msg.citations.length > 0 && (
                      <div className="mt-3 space-y-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Sources
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {msg.citations.map(
                            (citation: { document_id: string; filename: string; score: number; chunk_content: string }, i: number) => (
                              <Badge
                                key={i}
                                variant="secondary"
                                className="text-xs cursor-help"
                                title={citation.chunk_content}
                              >
                                <FileText className="mr-1 h-3 w-3" />
                                {citation.filename}
                                <span className="ml-1 opacity-60">
                                  ({Math.round(citation.score * 100)}%)
                                </span>
                              </Badge>
                            )
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 p-2 rounded-full bg-muted">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
                <div>
                  <p className="text-sm font-medium">NexusRAG</p>
                  <p className="text-sm text-muted-foreground">
                    Searching documents and generating response...
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      <div className="border-t p-4">
        <div className="flex gap-2">
          <Textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about your selected documents..."
            rows={2}
            className="resize-none"
            disabled={isLoading}
          />
          <Button
            onClick={handleSend}
            disabled={!query.trim() || isLoading || selectedDocIds.size === 0}
            className="self-end"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        {selectedDocIds.size === 0 && (
          <p className="text-xs text-destructive mt-1">
            Select at least one document to enable querying
          </p>
        )}
      </div>
    </div>
  );
}
