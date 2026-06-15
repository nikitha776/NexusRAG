"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { useAppStore } from "@/store";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2, FileText, Sparkles, Copy, Check } from "lucide-react";
import type { ChatMessage, ChatSession } from "@/types";

interface ChatInterfaceProps {
  workspaceId: string;
  sessionId: string | null;
  onSessionCreated?: (session: ChatSession) => void;
}

export function ChatInterface({
  workspaceId,
  sessionId,
  onSessionCreated,
}: ChatInterfaceProps) {
  const {
    messages,
    setMessages,
    addMessage,
    selectedDocIds,
    isLoading,
    setIsLoading,
  } = useAppStore();
  const [query, setQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isNewUnsaved = sessionId === "__new__";
  const hasRealSession = sessionId && sessionId !== "__new__";

  const loadMessages = useCallback(async () => {
    if (!hasRealSession) {
      setMessages([]);
      return;
    }
    try {
      const msgs = await api.chat.listMessages(workspaceId, sessionId!);
      setMessages(msgs);
    } catch {
      // Backend may be offline
    }
  }, [workspaceId, hasRealSession, sessionId, setMessages]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!query.trim() || isLoading) return;
    if (selectedDocIds.size === 0) {
      alert("Please select at least one document for retrieval.");
      return;
    }

    const userQuery = query.trim();
    setQuery("");

    let activeSessionId = sessionId;

    if (isNewUnsaved || !hasRealSession) {
      try {
        const session = await api.chat.createSession(
          workspaceId,
          userQuery.slice(0, 100)
        );
        activeSessionId = session.id;
        onSessionCreated?.(session);
      } catch {
        return;
      }
    }

    if (!activeSessionId) return;

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
        session_id: activeSessionId,
        selected_doc_ids: Array.from(selectedDocIds),
      });
      addMessage(response);
    } catch {
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content:
          "Sorry, I encountered an error processing your query. Please try again.",
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

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      <div className="flex-1 overflow-y-auto" ref={scrollRef}>
        {!hasRealSession || messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[60vh] px-6">
            {/* Animated icon */}
            <div className="relative mb-8">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                <Sparkles className="h-10 w-10 text-primary" />
              </div>
              <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center animate-bounce">
                <FileText className="h-4 w-4 text-accent" />
              </div>
            </div>

            <h2 className="text-2xl font-bold text-foreground mb-3 tracking-tight">
              Start a conversation
            </h2>
            <p className="text-sm text-muted-foreground max-w-md text-center mb-10 leading-relaxed">
              Add sources from the right panel, then ask questions to get grounded, cited answers from your documents.
            </p>

            {/* Suggestion cards */}
            <div className="grid gap-3 w-full max-w-lg">
              {[
                {
                  question: "What are the main topics covered?",
                  icon: "📋",
                  desc: "Get an overview of your documents"
                },
                {
                  question: "Summarize the key findings",
                  icon: "📝",
                  desc: "Extract important insights"
                },
                {
                  question: "What methods were used?",
                  icon: "🔬",
                  desc: "Understand methodologies"
                },
              ].map(({ question, icon, desc }) => (
                <button
                  key={question}
                  onClick={() => setQuery(question)}
                  className="group w-full text-left px-5 py-4 rounded-2xl border border-border/60 bg-card hover:bg-muted/50 hover:border-border hover:shadow-sm transition-all duration-200"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-lg">{icon}</span>
                    <div>
                      <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                        {question}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-8 max-w-3xl mx-auto px-6 py-8">
            {messages.map((msg) => (
              <div key={msg.id} className="group/msg">
                {msg.role === "user" ? (
                  <div className="flex justify-end mb-2">
                    <div className="max-w-[85%] bg-primary text-primary-foreground rounded-2xl rounded-br-md px-5 py-3 shadow-sm">
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">
                        {msg.content}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center mt-0.5">
                        <Sparkles className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm font-semibold text-foreground">NexusRAG</span>
                          <button
                            onClick={() => copyToClipboard(msg.content, msg.id)}
                            className="opacity-0 group-hover/msg:opacity-100 transition-opacity p-1 rounded-md hover:bg-muted"
                            title="Copy response"
                          >
                            {copiedId === msg.id ? (
                              <Check className="h-3.5 w-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                          </button>
                        </div>
                        <div className="prose prose-sm max-w-none">
                          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                            {msg.content}
                          </p>
                        </div>
                      </div>
                    </div>

                    {msg.citations && msg.citations.length > 0 && (
                      <div className="ml-11 space-y-2">
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                          Sources
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {msg.citations.map(
                            (citation: {
                              document_id: string;
                              filename: string;
                              score: number;
                              chunk_content: string;
                            }, i: number) => (
                              <div
                                key={i}
                                className="group/cite relative inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-border/60 bg-card hover:bg-muted/50 hover:border-border hover:shadow-sm transition-all duration-200 cursor-help text-xs"
                                title={citation.chunk_content}
                              >
                                <div className="p-1 rounded-md bg-primary/10">
                                  <FileText className="h-3 w-3 text-primary" />
                                </div>
                                <div className="flex flex-col">
                                  <span className="font-medium text-foreground truncate max-w-[120px]">
                                    {citation.filename}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground">
                                    {Math.round(citation.score * 100)}% match
                                  </span>
                                </div>
                                {/* Hover preview */}
                                <div className="absolute bottom-full left-0 mb-3 hidden group-hover/cite:block z-50 w-80 p-4 rounded-2xl border bg-popover text-popover-foreground shadow-xl">
                                  <div className="flex items-center gap-2 mb-2">
                                    <FileText className="h-3.5 w-3.5 text-primary" />
                                    <span className="text-xs font-semibold">{citation.filename}</span>
                                  </div>
                                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4">
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
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center mt-0.5">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1">
                  <span className="text-sm font-semibold text-foreground block mb-2">NexusRAG</span>
                  <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-muted/50 w-fit">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">Thinking...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="shrink-0 border-t border-border/60 bg-card/80 backdrop-blur-sm px-6 py-4">
        <div className="flex gap-3 items-end max-w-3xl mx-auto">
          <div className="flex-1 relative">
            <Textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question about your sources..."
              rows={1}
              className="resize-none min-h-[44px] max-h-[120px] rounded-2xl border-border/60 bg-background text-sm pr-12 py-3"
              disabled={isLoading}
            />
          </div>
          <Button
            onClick={handleSend}
            disabled={!query.trim() || isLoading || selectedDocIds.size === 0}
            className="flex-shrink-0 h-11 w-11 rounded-2xl shadow-sm"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        {selectedDocIds.size === 0 && (
          <p className="text-[11px] text-muted-foreground mt-2.5 text-center flex items-center justify-center gap-1.5">
            <FileText className="h-3 w-3" />
            Select at least one document to enable querying
          </p>
        )}
      </div>
    </div>
  );
}
