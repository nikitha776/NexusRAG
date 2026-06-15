"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Send,
  Plus,
  RotateCcw,
  Copy,
  ThumbsUp,
  ThumbsDown,
  Share2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge-enhanced";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import type { ChatMessage, Citation } from "@/types";

interface ChatInterfaceProps {
  messages: ChatMessage[];
  isLoading?: boolean;
  onSendMessage?: (message: string, selectedDocIds: string[]) => Promise<void>;
  selectedDocIds?: string[];
  onSelectDocs?: () => void;
  onCopyMessage?: (content: string) => void;
}

const SUGGESTED_PROMPTS = [
  "Summarize the key findings from the documents",
  "What are the main topics covered?",
  "Extract actionable insights",
  "Compare different viewpoints",
];

export function ChatInterface({
  messages,
  isLoading = false,
  onSendMessage,
  selectedDocIds = [],
  onSelectDocs,
  onCopyMessage,
}: ChatInterfaceProps) {
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!input.trim() || isSending || isLoading) return;

    const messageContent = input;
    setInput("");
    setIsSending(true);

    try {
      await onSendMessage?.(messageContent, Array.from(selectedDocIds));
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && e.ctrlKey) {
      handleSendMessage();
    }
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-full bg-background">
      <ScrollArea className="flex-1">
        <div className="max-w-3xl mx-auto w-full px-4 py-6 space-y-6">
          {isEmpty ? (
            <div className="flex flex-col items-center justify-center h-96">
              <div className="text-center space-y-4">
                <div className="inline-block p-3 rounded-lg bg-primary/10">
                  <Plus className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-foreground mb-2">
                    Start a conversation
                  </h2>
                  <p className="text-muted-foreground max-w-xs">
                    Ask questions about your documents and get AI-powered insights
                  </p>
                </div>

                {selectedDocIds.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-border/50">
                    <p className="text-xs text-muted-foreground mb-2">
                      Using {selectedDocIds.length} document(s)
                    </p>
                  </div>
                )}
              </div>

              {/* Suggested Prompts */}
              <div className="absolute bottom-32 left-0 right-0 px-4">
                <div className="max-w-3xl mx-auto">
                  <p className="text-xs font-semibold text-muted-foreground mb-3">
                    Try asking:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {SUGGESTED_PROMPTS.map((prompt, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setInput(prompt);
                          inputRef.current?.focus();
                        }}
                        className="p-3 rounded-lg border border-border/50 hover:bg-muted/50 text-left transition-colors text-sm text-foreground hover:text-foreground"
                      >
                        "{prompt}"
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  onCopy={onCopyMessage}
                />
              ))}

              {isLoading && (
                <div className="flex gap-3 items-start">
                  <Avatar className="h-8 w-8 mt-0.5 flex-shrink-0">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      AI
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-2 flex-1">
                    <div className="flex gap-2">
                      <div className="w-2 h-2 rounded-full bg-primary animate-bounce" />
                      <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0.2s" }} />
                      <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0.4s" }} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="border-t border-border/50 bg-card p-4">
        <div className="max-w-3xl mx-auto space-y-3">
          {selectedDocIds.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium text-muted-foreground">
                Using:
              </span>
              {Array.from(selectedDocIds).map((docId) => (
                <Badge key={docId} variant="secondary" className="gap-1 text-xs">
                  {docId.slice(0, 8)}...
                </Badge>
              ))}
              <Button
                variant="ghost"
                size="sm"
                className="h-5 text-xs"
                onClick={onSelectDocs}
              >
                Change
              </Button>
            </div>
          )}

          <div className="flex gap-3">
            <div className="flex-1 flex flex-col gap-2">
              <Textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  selectedDocIds.length > 0
                    ? "Ask a question about your documents..."
                    : "Select documents first to start chatting..."
                }
                disabled={isSending || isLoading || selectedDocIds.length === 0}
                className="resize-none max-h-24 bg-muted/50 border-border/50"
                rows={2}
              />
              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onSelectDocs}
                  disabled={isSending || isLoading}
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add Documents
                </Button>
                <Button
                  onClick={handleSendMessage}
                  disabled={
                    !input.trim() ||
                    isSending ||
                    isLoading ||
                    selectedDocIds.length === 0
                  }
                  className="gap-2"
                >
                  <Send className="w-4 h-4" />
                  Send
                </Button>
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Use Ctrl+Enter to send • Powered by advanced RAG
          </p>
        </div>
      </div>
    </div>
  );
}

interface MessageBubbleProps {
  message: ChatMessage;
  onCopy?: (content: string) => void;
}

function MessageBubble({ message, onCopy }: MessageBubbleProps) {
  const [showCopyFeedback, setShowCopyFeedback] = useState(false);
  const isUser = message.role === "user";

  const handleCopy = () => {
    onCopy?.(message.content);
    setShowCopyFeedback(true);
    setTimeout(() => setShowCopyFeedback(false), 2000);
  };

  return (
    <div className={cn("flex gap-3", isUser && "justify-end")}>
      {!isUser && (
        <Avatar className="h-8 w-8 mt-0.5 flex-shrink-0">
          <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
            AI
          </AvatarFallback>
        </Avatar>
      )}

      <div className={cn("space-y-2 max-w-2xl", !isUser && "flex-1")}>
        <div
          className={cn(
            "rounded-lg px-4 py-3 prose prose-sm dark:prose-invert max-w-none",
            isUser
              ? "bg-primary text-primary-foreground rounded-br-none"
              : "bg-card border border-border/50 rounded-bl-none"
          )}
        >
          <p className="leading-relaxed text-sm">{message.content}</p>
        </div>

        {/* Citations */}
        {message.citations && message.citations.length > 0 && (
          <div className="space-y-2 pt-1">
            <p className="text-xs font-semibold text-muted-foreground">Sources:</p>
            <div className="flex flex-wrap gap-2">
              {message.citations.map((citation) => (
                <button
                  key={`${citation.document_id}-${citation.score}`}
                  className="group inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors text-xs text-muted-foreground hover:text-foreground"
                  title={citation.chunk_content.slice(0, 100)}
                >
                  <span className="truncate">{citation.filename}</span>
                  <Badge variant="outline" className="text-xs px-1 py-0 opacity-60">
                    {(citation.score * 100).toFixed(0)}%
                  </Badge>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message Actions */}
        {!isUser && (
          <div className="flex gap-1 pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={handleCopy}
              title={showCopyFeedback ? "Copied!" : "Copy"}
            >
              <Copy className="w-3 h-3" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0"
              title="Helpful"
            >
              <ThumbsUp className="w-3 h-3" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0"
              title="Not helpful"
            >
              <ThumbsDown className="w-3 h-3" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0"
              title="Share"
            >
              <Share2 className="w-3 h-3" />
            </Button>
          </div>
        )}
      </div>

      {isUser && (
        <Avatar className="h-8 w-8 mt-0.5 flex-shrink-0">
          <AvatarFallback className="bg-secondary text-secondary-foreground text-xs font-bold">
            U
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}
