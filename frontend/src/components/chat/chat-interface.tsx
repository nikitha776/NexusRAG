"use client";

import { useState, useRef, useEffect } from "react";
import { api } from "@/lib/api";
import { useAppStore } from "@/store";
import { Button } from "@/components/ui/button";
import { ChatUploadButton } from "@/components/documents/chat-upload-button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2, Sparkles, Copy, Check, Square } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { remarkLineBreaks } from "@/lib/remark-line-breaks";
import { SourcePreview } from "@/components/chat/source-preview";
import { remarkCitations } from "@/lib/remark-citations";
import type { Citation, ChatMessage, ChatSession } from "@/types";

interface ChatInterfaceProps {
  workspaceId: string;
  sessionId: string | null;
  onSessionCreated?: (session: ChatSession) => void;
  onDocumentsUploaded?: () => void;
}

export function ChatInterface({
  workspaceId,
  sessionId,
  onSessionCreated,
  onDocumentsUploaded,
}: ChatInterfaceProps) {
  const { selectedDocIds, documents } = useAppStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [historyResult, setHistoryResult] = useState<{ sessionId: string; reload: number; failed: boolean } | null>(null);
  const [localSessionId, setLocalSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [query, setQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [preview, setPreview] = useState<Citation | null>(null);
  const [streamingText, setStreamingText] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sendingRef = useRef(false);
  const alive = useRef(true);
  const createdSession = useRef<ChatSession | null>(null);
  const sessionAnnounced = useRef(false);
  const needsHistory = Boolean(sessionId && sessionId !== localSessionId);
  const historyResolved = historyResult?.sessionId === sessionId && historyResult?.reload === reload;
  const historyLoading = needsHistory && !historyResolved;
  const historyFailed = needsHistory && historyResolved && Boolean(historyResult?.failed);

  useEffect(() => {
    alive.current = true;
    let cancelled = false;
    // The first answer is already rendered when the newly saved session is
    // reflected in the URL. Fetch history only when opening another session.
    if (sessionId && createdSession.current?.id !== sessionId) {
      api.chat.listMessages(workspaceId, sessionId)
        .then((msgs) => { if (!cancelled) { setMessages(msgs); setError(null); setHistoryResult({ sessionId, reload, failed: false }); } })
        .catch((e) => { if (!cancelled) { setHistoryResult({ sessionId, reload, failed: true }); setError(e instanceof Error ? e.message : "Could not load this conversation."); } });
    }
    return () => { cancelled = true; alive.current = false; };
  }, [workspaceId, sessionId, reload]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isLoading, streamingText]);

  const handleSend = async () => {
    if (!query.trim() || sendingRef.current || historyLoading || historyFailed) return;
    const sourceIds = [...selectedDocIds].filter((id) => documents.some((d) => d.id === id && d.status === "ready"));
    if (!sourceIds.length) { setError("Select at least one ready document first."); return; }
    const userQuery = query.trim();
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(), role: "user", content: userQuery, citations: null,
      selected_doc_ids: sourceIds, created_at: new Date().toISOString(),
    };
    const controller = new AbortController();
    abortRef.current = controller;
    setStreamingText("");
    sendingRef.current = true;
    setIsLoading(true);
    setError(null);
    setQuery("");
    setMessages((current) => [...current, userMsg]);
    try {
      let targetSession = sessionId || createdSession.current?.id;
      if (!targetSession) {
        const session = await api.chat.createSession(workspaceId, userQuery.slice(0, 100));
        createdSession.current = session;
        if (alive.current) setLocalSessionId(session.id);
        targetSession = session.id;
      }
      if (!alive.current) return;
      controller.signal.throwIfAborted();
      let saved: ChatMessage | undefined;
      await api.rag.stream(workspaceId, {
        query: userQuery, session_id: targetSession, selected_doc_ids: sourceIds,
      }, (event) => {
        if (!alive.current || controller.signal.aborted) return;
        if (event.type === "token") setStreamingText((text) => text + event.text);
        if (event.type === "done") saved = event.message;
      }, controller.signal);
      if (!alive.current) return;
      if (!saved) throw new Error("The answer was not saved. Please retry.");
      const response: ChatMessage = saved;
      setMessages((current) => [...current, response]);
      useAppStore.getState().updateChatSession(targetSession, { updated_at: response.created_at });
      if (createdSession.current && !sessionAnnounced.current) {
        sessionAnnounced.current = true;
        onSessionCreated?.({ ...createdSession.current, updated_at: response.created_at });
      }
    } catch (e) {
      if (!alive.current) return;
      setMessages((current) => current.filter((m) => m.id !== userMsg.id));
      setQuery(userQuery);
      setError(controller.signal.aborted ? "Generation stopped. Your question is ready to send again." : e instanceof Error ? e.message : "Could not send your question. Please retry.");
    } finally {
      abortRef.current = null;
      if (alive.current) setStreamingText("");
      sendingRef.current = false;
      if (alive.current) setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
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
    <div className="chat-layout relative flex h-full min-w-0 gap-3">
    <div className="chat-canvas min-w-0 flex-1 flex flex-col h-full overflow-hidden">
      <div className="flex-1 min-h-0 overflow-y-auto" ref={scrollRef}>
        {historyLoading ? <div role="status" className="p-8 text-center text-muted-foreground">Loading conversation…</div> : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[50vh] px-6">
            <div className="chat-empty-icon mb-6 flex size-16 items-center justify-center rounded-3xl">
              <Sparkles className="size-7 text-primary" />
            </div>

            <h2 className="text-2xl sm:text-3xl font-medium text-foreground mb-3 tracking-tight">
              A little clarity starts here
            </h2>
            <p className="text-sm text-muted-foreground max-w-md text-center mb-10 leading-relaxed">
              Open Sources and add documents, then ask questions to get grounded, cited answers from your documents.
            </p>

            {/* Suggestion cards */}
            <div className="grid gap-3 w-full max-w-3xl md:grid-cols-3">
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
                  className="chat-suggestion group w-full text-left px-5 py-5 transition-colors"
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
          <div className="chat-column space-y-4">
            {messages.map((msg) => (
              <div key={msg.id} className="group/msg">
                {msg.role === "user" ? (
                  <div className="flex justify-end mb-2">
                    <div className="chat-user-card">
                      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                        {msg.content}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="chat-answer-card space-y-4">
                    <div className="min-w-0">
                      <div className="min-w-0">
                        <div className="chat-answer-heading">
                          <Sparkles className="size-4 text-primary" />
                          <span className="text-sm font-semibold text-foreground">NexusRAG</span>
                          <button
                            onClick={() => copyToClipboard(msg.content, msg.id)}
                            className="chat-copy text-muted-foreground transition-colors p-1.5 rounded-lg hover:bg-muted"
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
                          <div className="markdown-answer text-sm leading-relaxed text-foreground">
                            <ReactMarkdown remarkPlugins={[remarkGfm, remarkLineBreaks, remarkCitations]} components={{
                              a: ({ href, children, ...props }) => {
                                const number = href?.match(/^#source-(\d+)$/)?.[1];
                                const citation = number ? msg.citations?.find((c, i) => (c.source_number ?? i + 1) === Number(number)) : undefined;
                                return citation ? <button className="text-primary underline underline-offset-2" onClick={() => setPreview(citation)}>{children}</button>
                                  : <a href={href} {...props}>{children}</a>;
                              },
                            }}>{msg.content}</ReactMarkdown>
                          </div>
                        </div>
                      </div>
                    </div>

                    {msg.citations && msg.citations.length > 0 && (
                      <details className="border-t border-border/50 pt-3">
                        <summary className="w-fit cursor-pointer rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">
                          Sources · {msg.citations.length}
                        </summary>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {msg.citations.map((citation, i) => (
                            <details key={`${citation.document_id}-${i}`} className="w-full rounded-xl border border-border/50 bg-background/40 p-3 text-xs">
                              <summary className="cursor-pointer font-medium break-words">
                                Source {citation.source_number ?? i + 1} · {citation.filename}
                              </summary>
                              <p className="mt-3 whitespace-pre-wrap text-muted-foreground leading-relaxed">{citation.chunk_content}</p>
                              <Button variant="outline" size="sm" className="mt-3 rounded-full" onClick={() => setPreview(citation)}>Open in document</Button>
                            </details>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="chat-answer-card flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center mt-0.5">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1">
                  <span className="text-sm font-semibold text-foreground block mb-2">NexusRAG</span>
                  {streamingText ? <div className="markdown-answer" aria-live="off"><ReactMarkdown remarkPlugins={[remarkGfm, remarkLineBreaks]}>{streamingText}</ReactMarkdown></div> : <div role="status" className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-muted/50 w-fit">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">Thinking...</span>
                  </div>}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {error && <div role="alert" className="mx-4 my-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">
        {error}
        {sessionId && messages.length === 0 && <button className="ml-2 underline" onClick={() => setReload((v) => v + 1)}>Reload conversation</button>}
      </div>}
      {/* Input area */}
      <div className="chat-composer-wrap shrink-0">
        <div className="chat-composer relative">
          <ChatUploadButton workspaceId={workspaceId} disabled={isLoading} onUploaded={onDocumentsUploaded} />
          <div className="flex-1 relative">
            <Textarea
              aria-label="Your question"
              maxLength={10000}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about your documents…"
              rows={1}
              className="resize-none"
              disabled={isLoading || historyLoading || historyFailed}
            />
          </div>
          <Button
            onClick={isLoading ? () => abortRef.current?.abort() : handleSend}
            aria-label={isLoading ? "Stop generating" : "Send question"}
            disabled={!isLoading && (!query.trim() || historyLoading || historyFailed || selectedDocIds.size === 0)}
            className="flex-shrink-0 h-11 w-11 rounded-full shadow-none"
          >
            {isLoading ? (
              <Square className="h-3.5 w-3.5 fill-current" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
      {preview && <SourcePreview key={`${preview.document_id}:${preview.chunk_index}:${preview.source_number}`} workspaceId={workspaceId} citation={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}
