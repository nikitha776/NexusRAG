"use client";

import { useAppStore } from "@/store";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, AlertCircle, FileCheck, FileX } from "lucide-react";

interface FileSelectorProps {
  workspaceId: string;
}

export function FileSelector({ workspaceId }: FileSelectorProps) {
  const { documents, selectedDocIds, toggleDocSelection, selectAllDocs, deselectAllDocs } =
    useAppStore();

  const readyDocs = documents.filter((d) => d.status === "ready");
  const processingDocs = documents.filter((d) => d.status === "processing");
  const errorDocs = documents.filter((d) => d.status === "error");
  const allSelected = readyDocs.length > 0 && readyDocs.every((d) => selectedDocIds.has(d.id));

  if (documents.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-accent/10">
            <FileCheck className="h-4 w-4 text-accent" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">Active for chat</h3>
        </div>
        {readyDocs.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground px-2 rounded-lg"
            onClick={allSelected ? deselectAllDocs : selectAllDocs}
          >
            {allSelected ? "Deselect all" : "Select all"}
          </Button>
        )}
      </div>

      {/* Ready documents */}
      {readyDocs.length > 0 && (
        <ScrollArea className="max-h-[200px]">
          <div className="space-y-1">
            {readyDocs.map((doc) => {
              const isSelected = selectedDocIds.has(doc.id);
              return (
                <label
                  key={doc.id}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-pointer transition-all duration-200 ${
                    isSelected
                      ? "bg-primary/5 border border-primary/20 shadow-sm"
                      : "border border-transparent hover:bg-muted/50 hover:border-border/40"
                  }`}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleDocSelection(doc.id)}
                    className="h-4 w-4"
                  />
                  <div className={`p-1.5 rounded-lg ${
                    isSelected ? "bg-primary/10" : "bg-muted/50"
                  } transition-colors`}>
                    <FileCheck className={`h-3.5 w-3.5 ${
                      isSelected ? "text-primary" : "text-muted-foreground"
                    }`} />
                  </div>
                  <span className={`text-sm truncate flex-1 ${
                    isSelected ? "font-medium text-foreground" : "text-foreground"
                  }`}>
                    {doc.filename}
                  </span>
                  {isSelected && (
                    <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                  )}
                </label>
              );
            })}
          </div>
        </ScrollArea>
      )}

      {/* Processing documents */}
      {processingDocs.length > 0 && (
        <div className="space-y-1">
          {processingDocs.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl opacity-60"
            >
              <div className="p-1.5 rounded-lg bg-amber-100">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-600" />
              </div>
              <span className="text-sm truncate flex-1 text-muted-foreground">
                {doc.filename}
              </span>
              <span className="text-[11px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                processing
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Error documents */}
      {errorDocs.length > 0 && (
        <div className="space-y-1">
          {errorDocs.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl opacity-60"
            >
              <div className="p-1.5 rounded-lg bg-red-100">
                <FileX className="h-3.5 w-3.5 text-red-500" />
              </div>
              <span className="text-sm truncate flex-1 text-muted-foreground line-through">
                {doc.filename}
              </span>
              <span className="text-[11px] text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                failed
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Summary */}
      <div className="flex items-center justify-between pt-2 border-t border-border/40">
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{selectedDocIds.size}</span> of {readyDocs.length} selected
        </p>
        {selectedDocIds.size > 0 && (
          <span className="text-xs font-medium text-primary bg-primary/10 px-2.5 py-1 rounded-full">
            Active
          </span>
        )}
      </div>

      {/* Helpful messages */}
      {readyDocs.length === 0 && processingDocs.length > 0 && (
        <div className="text-center py-4 px-3 rounded-xl bg-amber-50 border border-amber-200">
          <Loader2 className="h-5 w-5 text-amber-500 animate-spin mx-auto mb-2" />
          <p className="text-xs text-amber-700 font-medium">
            Documents are processing...
          </p>
          <p className="text-[11px] text-amber-600 mt-1">
            This may take a moment
          </p>
        </div>
      )}
      {readyDocs.length === 0 && processingDocs.length === 0 && errorDocs.length > 0 && (
        <div className="text-center py-4 px-3 rounded-xl bg-red-50 border border-red-200">
          <AlertCircle className="h-5 w-5 text-red-500 mx-auto mb-2" />
          <p className="text-xs text-red-700 font-medium">
            All documents failed
          </p>
          <p className="text-[11px] text-red-600 mt-1">
            Try uploading again
          </p>
        </div>
      )}
    </div>
  );
}
