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
      <div className="p-3 text-center text-sm text-muted-foreground">
        No ready documents to select
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
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
        <div className="space-y-1">
          {readyDocs.map((doc) => (
            <label
              key={doc.id}
              className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
            >
              <Checkbox
                checked={selectedDocIds.has(doc.id)}
                onCheckedChange={() => toggleDocSelection(doc.id)}
              />
              <FileText className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              <span className="text-sm truncate">{doc.filename}</span>
              <span className="text-xs text-muted-foreground ml-auto flex-shrink-0">
                {doc.chunk_count} chunks
              </span>
            </label>
          ))}
        </div>
      </ScrollArea>

      <div className="px-1">
        <p className="text-xs text-muted-foreground">
          {selectedDocIds.size} of {readyDocs.length} documents selected for retrieval
        </p>
      </div>
    </div>
  );
}
