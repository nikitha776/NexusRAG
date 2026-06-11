"use client";

import { useState, useRef, useEffect } from "react";
import { api } from "@/lib/api";
import { useAppStore } from "@/store";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Loader2, FileText, Sparkles } from "lucide-react";
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
      <ScrollArea className="flex-1 px-6 py-8" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Ask anything about your documents</h3>
            <p className="text-sm text-muted-foreground max-w-md mb-8">
              Select documents from the sidebar and type your question. The AI will search
              through your selected files and provide context-aware answers with citations.
            </p>
            <div className="flex flex-wrap gap-2 justify-center max-w-lg">
              {[
                "What are the main topics covered?",
                "Summarize the key findings",
                "What methods were used?",
              ].map((question) => (
                <button
                  key={question}
                  onClick={() => setQuery(question)}
                  className="px-4 py-2 text-sm rounded-full border bg-muted/30 hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground"
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-8 max-w-3xl mx-auto">
            {messages.map((msg) => (
              <div key={msg.id} className="space-y-3">
                {msg.role === "user" ? (
                  <div className="flex justify-end">
                    <div className="max-w-[80%] bg-primary/10 text-foreground rounded-2xl rounded-tr-md px-4 py-3">
                      <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-muted flex items-center justify-center mt-0.5">
                      <Sparkles className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 space-y-3 border-l-2 border-muted pl-4">
                      <p className="text-sm font-medium text-muted-foreground">NexusRAG</p>
                      <div className="prose prose-sm max-w-none">
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
                      </div>

                      {msg.citations && msg.citations.length > 0 && (
                        <div className="mt-4 space-y-2">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Sources
                          </p>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {msg.citations.map(
                              (citation: { document_id: string; filename: string; score: number; chunk_content: string }, i: number) => (
                                <div
                                  key={i}
                                  className="group/cite relative flex items-start gap-2.5 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors cursor-help"
                                  title={citation.chunk_content}
                                >
                                  <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{citation.filename}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                      Relevance: {Math.round(citation.score * 100)}%
                                    </p>
                                  </div>
                                  <div className="absolute bottom-full left-4 mb-2 hidden group-hover/cite:block z-50 w-72 p-3 rounded-lg border bg-popover text-popover-foreground shadow-md">
                                    <p className="text-xs text-muted-foreground line-clamp-4">
                                      {citation.chunk_content}
                                    </p>
                                  </div>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-muted flex items-center justify-center mt-0.5">
                  <Sparkles className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 border-l-2 border-muted pl-4">
                  <p className="text-sm font-medium text-muted-foreground">NexusRAG</p>
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className="text-sm text-muted-foreground">Thinking</span>
                    <span className="flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0ms]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:150ms]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:300ms]" />
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      <div className="border-t bg-background/80 backdrop-blur-sm px-6 py-4">
        <div className="flex gap-3 items-end">
          <Textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about your selected documents..."
            rows={3}
            className="resize-none"
            disabled={isLoading}
          />
          <Button
            onClick={handleSend}
            disabled={!query.trim() || isLoading || selectedDocIds.size === 0}
            className="flex-shrink-0 h-10"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        {selectedDocIds.size === 0 && (
          <p className="text-xs text-destructive mt-2">
            Select at least one document to enable querying
          </p>
        )}
      </div>
    </div>
  );
}
