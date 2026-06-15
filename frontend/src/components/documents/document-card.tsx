"use client";

import React from "react";
import {
  FileText,
  File,
  Trash2,
  Download,
  MoreVertical,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge-enhanced";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import type { Document } from "@/types";

interface DocumentCardProps {
  document: Document;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  onDelete?: (id: string) => void;
  onDownload?: (id: string) => void;
}

export function DocumentCard({
  document,
  isSelected = false,
  onSelect,
  onDelete,
  onDownload,
}: DocumentCardProps) {
  const getFileIcon = (fileType: string) => {
    if (fileType.includes("pdf")) {
      return <File className="w-8 h-8 text-red-500" />;
    }
    if (fileType.includes("word") || fileType.includes("docx")) {
      return <FileText className="w-8 h-8 text-blue-500" />;
    }
    if (fileType.includes("text") || fileType.includes("txt")) {
      return <FileText className="w-8 h-8 text-slate-500" />;
    }
    return <File className="w-8 h-8 text-foreground/60" />;
  };

  const getStatusConfig = (status: Document["status"]) => {
    switch (status) {
      case "processing":
        return {
          badge: (
            <Badge variant="processing" className="gap-1">
              <Clock className="w-3 h-3" />
              Processing
            </Badge>
          ),
          color: "text-blue-500",
        };
      case "ready":
        return {
          badge: (
            <Badge variant="success" className="gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Indexed
            </Badge>
          ),
          color: "text-green-500",
        };
      case "error":
        return {
          badge: (
            <Badge variant="warning" className="gap-1">
              <AlertCircle className="w-3 h-3" />
              Failed
            </Badge>
          ),
          color: "text-red-500",
        };
      default:
        return {
          badge: <Badge variant="outline">Unknown</Badge>,
          color: "text-foreground/60",
        };
    }
  };

  const statusConfig = getStatusConfig(document.status);
  const uploadDate = new Date(document.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div
      className={cn(
        "group relative p-4 rounded-lg border transition-all hover:shadow-md hover:border-primary/30 cursor-pointer",
        isSelected
          ? "bg-primary/5 border-primary/30"
          : "bg-card border-border/50 hover:bg-card/80"
      )}
      onClick={() => onSelect?.(document.id)}
    >
      {/* Select Checkbox */}
      <div className="absolute top-3 right-3">
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onSelect?.(document.id)}
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      {/* Content */}
      <div className="flex gap-3 pr-8">
        <div className="flex-shrink-0">{getFileIcon(document.file_type)}</div>

        <div className="flex-1 min-w-0">
          {/* Filename */}
          <h3 className="font-medium text-foreground truncate hover:text-primary transition-colors">
            {document.filename}
          </h3>

          {/* Meta Info */}
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            <span>{(document.file_size / 1024 / 1024).toFixed(2)} MB</span>
            <span>•</span>
            <span>{document.chunk_count} chunks</span>
            <span>•</span>
            <span>{uploadDate}</span>
          </div>

          {/* Status Badge */}
          <div className="mt-2.5">{statusConfig.badge}</div>
        </div>
      </div>

      {/* Hover Actions */}
      <div className="absolute bottom-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={(e) => {
            e.stopPropagation();
            onDownload?.(document.id);
          }}
          title="Download"
        >
          <Download className="w-3.5 h-3.5" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger
            className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-border/50 bg-card text-sm font-medium hover:bg-muted/50 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem>View Details</DropdownMenuItem>
            <DropdownMenuItem>Share</DropdownMenuItem>
            <DropdownMenuItem>Rename</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={() => onDelete?.(document.id)}>
              <Trash2 className="w-3 h-3 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
