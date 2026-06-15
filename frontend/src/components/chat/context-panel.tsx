"use client";

import React, { useState } from "react";
import {
  BarChart3,
  FileText,
  Clock,
  TrendingUp,
  X,
  ChevronDown,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge-enhanced";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { Document } from "@/types";

interface ContextPanelProps {
  documents: Document[];
  selectedDocIds: Set<string>;
  onRemoveDocument?: (id: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export function ContextPanel({
  documents,
  selectedDocIds,
  onRemoveDocument,
  isOpen = true,
  onClose,
}: ContextPanelProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["documents", "statistics"])
  );

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const selectedDocs = documents.filter((doc) => selectedDocIds.has(doc.id));
  const totalChunks = selectedDocs.reduce((sum, doc) => sum + doc.chunk_count, 0);
  const readyDocs = selectedDocs.filter((doc) => doc.status === "ready").length;
  const processingDocs = selectedDocs.filter((doc) => doc.status === "processing").length;

  const avgChunkSize = selectedDocs.length > 0
    ? (selectedDocs.reduce((sum, doc) => sum + doc.file_size, 0) / selectedDocs.length / 1024 / 1024).toFixed(2)
    : 0;

  if (!isOpen) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => onClose?.()}
        className="fixed bottom-4 right-4 gap-2"
      >
        <BarChart3 className="w-4 h-4" />
        Show Context
      </Button>
    );
  }

  return (
    <div className="h-full flex flex-col bg-card border-l border-border/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/50">
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <BarChart3 className="w-4 h-4" />
          Context
        </h2>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Selected Documents Section */}
          <div className="space-y-2">
            <button
              onClick={() => toggleSection("documents")}
              className="flex items-center gap-2 w-full px-2 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronDown
                className={cn(
                  "w-3 h-3 transition-transform",
                  expandedSections.has("documents") ? "rotate-0" : "-rotate-90"
                )}
              />
              DOCUMENTS ({selectedDocs.length})
            </button>

            {expandedSections.has("documents") && (
              <div className="space-y-2 pl-2">
                {selectedDocs.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">
                    No documents selected
                  </p>
                ) : (
                  selectedDocs.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-start justify-between p-2 rounded-lg bg-muted/30 group"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">
                          {doc.filename}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {doc.chunk_count} chunks
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                        onClick={() => onRemoveDocument?.(doc.id)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          <Separator className="my-2" />

          {/* Statistics Section */}
          <div className="space-y-2">
            <button
              onClick={() => toggleSection("statistics")}
              className="flex items-center gap-2 w-full px-2 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronDown
                className={cn(
                  "w-3 h-3 transition-transform",
                  expandedSections.has("statistics") ? "rotate-0" : "-rotate-90"
                )}
              />
              STATISTICS
            </button>

            {expandedSections.has("statistics") && (
              <div className="space-y-3">
                {/* Total Chunks */}
                <div className="p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                      <FileText className="w-3 h-3" />
                      Total Chunks
                    </span>
                    <span className="text-sm font-bold text-foreground">
                      {totalChunks}
                    </span>
                  </div>
                </div>

                {/* Status Breakdown */}
                <div className="p-3 rounded-lg bg-muted/30 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Status</p>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Badge variant="success" className="text-xs">
                        Indexed
                      </Badge>
                      <span className="text-xs font-semibold text-foreground">
                        {readyDocs}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <Badge variant="processing" className="text-xs">
                        Processing
                      </Badge>
                      <span className="text-xs font-semibold text-foreground">
                        {processingDocs}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Average Size */}
                <div className="p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                      <TrendingUp className="w-3 h-3" />
                      Avg Size
                    </span>
                    <span className="text-sm font-bold text-foreground">
                      {avgChunkSize} MB
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <Separator className="my-2" />

          {/* Recent Activity */}
          <div className="space-y-2">
            <button
              onClick={() => toggleSection("activity")}
              className="flex items-center gap-2 w-full px-2 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronDown
                className={cn(
                  "w-3 h-3 transition-transform",
                  expandedSections.has("activity") ? "rotate-0" : "-rotate-90"
                )}
              />
              RECENT ACTIVITY
            </button>

            {expandedSections.has("activity") && (
              <div className="space-y-2 pl-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span>Last indexed: 2 mins ago</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Documents last updated: Today at 3:45 PM
                </div>
              </div>
            )}
          </div>

          <Separator className="my-2" />

          {/* Context Settings */}
          <div className="space-y-2">
            <button
              onClick={() => toggleSection("settings")}
              className="flex items-center gap-2 w-full px-2 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronDown
                className={cn(
                  "w-3 h-3 transition-transform",
                  expandedSections.has("settings") ? "rotate-0" : "-rotate-90"
                )}
              />
              SETTINGS
            </button>

            {expandedSections.has("settings") && (
              <div className="space-y-2 pl-2">
                <Button variant="outline" size="sm" className="w-full gap-2 text-xs">
                  <Settings className="w-3 h-3" />
                  Configure Context
                </Button>
              </div>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
