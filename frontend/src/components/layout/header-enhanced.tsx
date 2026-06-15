"use client";

import React, { useState } from "react";
import {
  Search,
  Upload,
  Settings,
  Bell,
  MoreVertical,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge-enhanced";
import type { User } from "@supabase/supabase-js";

interface HeaderProps {
  user?: User | null;
  workspaceName?: string;
  onSearch?: (query: string) => void;
  onUpload?: () => void;
  onSettings?: () => void;
  isLoading?: boolean;
}

export function Header({
  user,
  workspaceName,
  onSearch,
  onUpload,
  onSettings,
  isLoading,
}: HeaderProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    onSearch?.(query);
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/50 bg-card/80 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-4 px-6 py-3.5">
        {/* Left: Workspace Info */}
        <div className="flex items-center gap-3 min-w-0">
          {workspaceName && (
            <>
              <div>
                <h1 className="text-lg font-semibold text-foreground truncate">
                  {workspaceName}
                </h1>
                <p className="text-xs text-muted-foreground">
                  Workspace · Updated just now
                </p>
              </div>
            </>
          )}
        </div>

        {/* Center: Search */}
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search documents..."
              value={searchQuery}
              onChange={handleSearch}
              className="pl-9 pr-3 h-9 bg-muted/50 border-border/50"
              disabled={isLoading}
            />
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <Button
            onClick={onUpload}
            size="sm"
            className="gap-2 bg-primary hover:bg-primary/90"
            disabled={isLoading}
          >
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">Upload</span>
          </Button>

          <Button
            onClick={onSettings}
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={isLoading}
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Settings</span>
          </Button>

          <Button variant="outline" size="sm" className="relative h-9 w-9 p-0">
            <Bell className="w-4 h-4" />
            <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
              3
            </Badge>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center justify-center h-9 w-9 rounded-md text-sm font-medium hover:bg-muted/50 transition-colors cursor-pointer">
              <MoreVertical className="w-4 h-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem>Share Workspace</DropdownMenuItem>
              <DropdownMenuItem>Export Data</DropdownMenuItem>
              <DropdownMenuItem>Workspace Settings</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
