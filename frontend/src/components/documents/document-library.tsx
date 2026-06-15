"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Upload,
  Filter,
  ChevronDown,
  Grid3x3,
  List,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DocumentCard } from "@/components/documents/document-card";
import { Badge } from "@/components/ui/badge-enhanced";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import type { Document } from "@/types";

interface DocumentLibraryProps {
  documents: Document[];
  selectedIds?: Set<string>;
  onSelect?: (id: string) => void;
  onSelectAll?: () => void;
  onDeselectAll?: () => void;
  onDelete?: (id: string) => void;
  onUpload?: () => void;
  isLoading?: boolean;
}

export function DocumentLibrary({
  documents,
  selectedIds = new Set(),
  onSelect,
  onSelectAll,
  onDeselectAll,
  onDelete,
  onUpload,
  isLoading,
}: DocumentLibraryProps) {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [filterStatus, setFilterStatus] = useState<"all" | "processing" | "ready" | "error">("all");
  const [sortBy, setSortBy] = useState<"date" | "name" | "size">("date");

  const filteredDocs = documents.filter((doc) => {
    if (filterStatus === "all") return true;
    return doc.status === filterStatus;
  });

  const sortedDocs = [...filteredDocs].sort((a, b) => {
    switch (sortBy) {
      case "name":
        return a.filename.localeCompare(b.filename);
      case "size":
        return b.file_size - a.file_size;
      case "date":
      default:
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
  });

  const allSelected = selectedIds.size === sortedDocs.length && sortedDocs.length > 0;
  const someSelected = selectedIds.size > 0 && !allSelected;
  const selectAllRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);

  if (documents.length === 0 && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 rounded-lg border-2 border-dashed border-border/50 bg-muted/20">
        <Upload className="w-12 h-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-1">
          No documents yet
        </h3>
        <p className="text-sm text-muted-foreground mb-6">
          Upload documents to start building your knowledge base
        </p>
        <Button onClick={onUpload} className="gap-2">
          <Plus className="w-4 h-4" />
          Upload First Document
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-card border border-border/50 rounded-lg p-4">
        <div className="flex items-center gap-3 flex-1">
          {/* Checkbox for select all */}
          <input
            ref={selectAllRef}
            type="checkbox"
            checked={allSelected}
            onChange={(e) => {
              if (e.target.checked) {
                onSelectAll?.();
              } else {
                onDeselectAll?.();
              }
            }}
            className="w-4 h-4 rounded cursor-pointer"
          />

          {selectedIds.size > 0 && (
            <span className="text-xs font-medium text-muted-foreground">
              {selectedIds.size} selected
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center gap-2 h-8 px-3 rounded-md border border-border/50 bg-card text-sm font-medium hover:bg-muted/50 transition-colors cursor-pointer">
              <Filter className="w-4 h-4" />
              <ChevronDown className="w-3 h-3" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-40">
              <DropdownMenuCheckboxItem
                checked={filterStatus === "all"}
                onCheckedChange={() => setFilterStatus("all")}
              >
                All Documents
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={filterStatus === "ready"}
                onCheckedChange={() => setFilterStatus("ready")}
              >
                Indexed
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={filterStatus === "processing"}
                onCheckedChange={() => setFilterStatus("processing")}
              >
                Processing
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={filterStatus === "error"}
                onCheckedChange={() => setFilterStatus("error")}
              >
                Failed
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Sort */}
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center gap-2 h-8 px-3 rounded-md border border-border/50 bg-card text-sm font-medium hover:bg-muted/50 transition-colors cursor-pointer">
              Sort
              <ChevronDown className="w-3 h-3" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-40">
              <DropdownMenuCheckboxItem
                checked={sortBy === "date"}
                onCheckedChange={() => setSortBy("date")}
              >
                Newest First
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={sortBy === "name"}
                onCheckedChange={() => setSortBy("name")}
              >
                Name (A-Z)
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={sortBy === "size"}
                onCheckedChange={() => setSortBy("size")}
              >
                Size (Largest)
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* View Toggle */}
          <div className="flex gap-1 bg-muted p-1 rounded-md">
            <Button
              size="sm"
              variant={viewMode === "grid" ? "default" : "ghost"}
              className="h-7 w-7 p-0"
              onClick={() => setViewMode("grid")}
            >
              <Grid3x3 className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant={viewMode === "list" ? "default" : "ghost"}
              className="h-7 w-7 p-0"
              onClick={() => setViewMode("list")}
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Documents Grid/List */}
      <div
        className={cn(
          "gap-4",
          viewMode === "grid"
            ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            : "space-y-2"
        )}
      >
        {sortedDocs.map((doc) => (
          <DocumentCard
            key={doc.id}
            document={doc}
            isSelected={selectedIds.has(doc.id)}
            onSelect={onSelect}
            onDelete={onDelete}
          />
        ))}
      </div>

      {/* Empty State after Filter */}
      {sortedDocs.length === 0 && documents.length > 0 && (
        <div className="text-center py-8">
          <p className="text-muted-foreground">No documents match your filter</p>
        </div>
      )}
    </div>
  );
}
