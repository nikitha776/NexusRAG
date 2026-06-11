"use client";

import { useAppStore } from "@/store";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, CheckSquare, Square } from "lucide-react";

interface FileSelectorProps {
  workspaceId: string;
}

export function FileSelector({ workspaceId }: FileSelectorProps) {
  const { documents, selectedDocIds, toggleDocSelection, selectAllDocs, deselectAllDocs } =
    useAppStore();

  const readyDocs = documents.filter((d) => d.status === "ready");
  const allSelected = readyDocs.length > 0 && readyDocs.every((d) => selectedDocIds.has(d.id));

  if (readyDocs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4 text-center rounded-xl border border-dashed border-muted-foreground/20 bg-muted/20">
        <div className="flex items-center justify-center h-10 w-10 rounded-full bg-muted mb-2">
          <FileText className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground/70">
          No documents available
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Upload and process documents to select them for retrieval
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Select Documents for Retrieval
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={allSelected ? deselectAllDocs : selectAllDocs}
        >
          {allSelected ? (
            <>
              <Square className="mr-1 h-3 w-3" />
              Deselect All
            </>
          ) : (
            <>
              <CheckSquare className="mr-1 h-3 w-3" />
              Select All
            </>
          )}
        </Button>
      </div>

      <ScrollArea className="h-[200px]">
        <div className="space-y-1 pr-3">
          {readyDocs.map((doc) => {
            const isSelected = selectedDocIds.has(doc.id);
            return (
              <label
                key={doc.id}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                  isSelected
                    ? "bg-primary/5 border border-primary/15"
                    : "border border-transparent hover:bg-muted/50 hover:border-border"
                }`}
              >
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => toggleDocSelection(doc.id)}
                />
                <div className={`flex items-center justify-center h-7 w-7 rounded-md flex-shrink-0 ${
                  isSelected ? "bg-primary/10" : "bg-muted"
                }`}>
                  <FileText className={`h-3.5 w-3.5 ${
                    isSelected ? "text-primary" : "text-muted-foreground"
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm truncate block">{doc.filename}</span>
                </div>
                <span className="text-[11px] text-muted-foreground flex-shrink-0 tabular-nums">
                  {doc.chunk_count} chunks
                </span>
              </label>
            );
          })}
        </div>
      </ScrollArea>

      <div className="flex items-center justify-between px-1 pt-1 border-t border-border/50">
        <p className="text-xs text-muted-foreground">
          {selectedDocIds.size} of {readyDocs.length} selected
        </p>
        {selectedDocIds.size > 0 && (
          <span className="text-[11px] font-medium text-primary">
            Retrieval active
          </span>
        )}
      </div>
    </div>
  );
}
