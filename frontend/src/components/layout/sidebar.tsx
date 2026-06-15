"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { 
  Plus, 
  Settings, 
  LogOut, 
  ChevronDown,
  MoreVertical,
  Trash2,
  Edit2,
  Archive
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store";
import { Badge } from "@/components/ui/badge-enhanced";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface SidebarProps {
  user?: { email?: string; user_metadata?: { name?: string; avatar_url?: string } } | null;
  onCreateWorkspace?: () => void;
  onLogout?: () => void;
}

export function Sidebar({ user, onCreateWorkspace, onLogout }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { workspaces, activeWorkspace, setActiveWorkspace } = useAppStore();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set(["workspaces"]));

  const toggleMenu = (menu: string) => {
    setExpandedMenus((prev) => {
      const next = new Set(prev);
      if (next.has(menu)) {
        next.delete(menu);
      } else {
        next.add(menu);
      }
      return next;
    });
  };

  const handleWorkspaceClick = (workspace: typeof workspaces[0]) => {
    setActiveWorkspace(workspace);
    router.push(`/workspace/${workspace.id}`);
  };

  const initials = user?.user_metadata?.name
    ? user.user_metadata.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : user?.email?.[0]?.toUpperCase() || "U";

  const isWorkspacePage = pathname.includes("/workspace");

  return (
    <div
      className={cn(
        "flex flex-col h-screen border-r border-border/50 bg-sidebar transition-all duration-300",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/30">
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-white font-bold text-sm">
              N
            </div>
            <span className="font-bold text-foreground">NexusRAG</span>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="h-8 w-8"
        >
          <ChevronDown
            className={cn("w-4 h-4 transition-transform", isCollapsed ? "rotate-90" : "-rotate-90")}
          />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-6">
          {/* Create Workspace */}
          {!isCollapsed && (
            <Button
              onClick={onCreateWorkspace}
              className="w-full gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
              size="sm"
            >
              <Plus className="w-4 h-4" />
              New Workspace
            </Button>
          )}

          {/* Workspaces Section */}
          <div className="space-y-2">
            {!isCollapsed && (
              <button
                onClick={() => toggleMenu("workspaces")}
                className="flex items-center gap-2 w-full px-2 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronDown
                  className={cn(
                    "w-3 h-3 transition-transform",
                    expandedMenus.has("workspaces") ? "rotate-0" : "-rotate-90"
                  )}
                />
                WORKSPACES ({workspaces.length})
              </button>
            )}

            {expandedMenus.has("workspaces") && !isCollapsed && (
              <div className="space-y-1">
                {workspaces.length === 0 ? (
                  <div className="px-2 py-3 text-xs text-muted-foreground text-center">
                    No workspaces yet
                  </div>
                ) : (
                  workspaces.map((workspace) => (
                    <div key={workspace.id} className="group relative">
                      <button
                        onClick={() => handleWorkspaceClick(workspace)}
                        className={cn(
                          "w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm transition-colors truncate",
                          activeWorkspace?.id === workspace.id
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-foreground/80 hover:bg-muted/50"
                        )}
                      >
                        <div className="w-2 h-2 rounded-full bg-current" />
                        <span className="truncate flex-1 text-left">{workspace.name}</span>
                        <Badge variant="outline" className="text-xs px-1.5 py-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          {workspace.document_count}
                        </Badge>
                      </button>

                      <DropdownMenu>
                        <DropdownMenuTrigger className="absolute right-1 top-1.5 h-6 w-6 inline-flex items-center justify-center rounded-md text-sm font-medium hover:bg-muted/50 transition-opacity opacity-0 group-hover:opacity-100 cursor-pointer">
                          <MoreVertical className="w-3 h-3" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem>
                            <Edit2 className="w-3 h-3 mr-2" />
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Archive className="w-3 h-3 mr-2" />
                            Archive
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">
                            <Trash2 className="w-3 h-3 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Collapsed Mode - Workspace Icons */}
          {isCollapsed && workspaces.length > 0 && (
            <div className="space-y-2">
              {workspaces.slice(0, 5).map((workspace) => (
                <button
                  key={workspace.id}
                  onClick={() => handleWorkspaceClick(workspace)}
                  title={workspace.name}
                  className={cn(
                    "w-full flex items-center justify-center h-8 rounded-lg transition-colors",
                    activeWorkspace?.id === workspace.id
                      ? "bg-primary/20 text-primary"
                      : "text-foreground/60 hover:bg-muted"
                  )}
                >
                  <span className="text-xs font-semibold">
                    {workspace.name[0]?.toUpperCase()}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      <Separator className="my-0" />

      {/* Footer */}
      <div className="p-3 space-y-2 border-t border-border/30">
        {!isCollapsed && (
          <Link href="/settings">
            <Button variant="ghost" size="sm" className="w-full justify-start gap-2">
              <Settings className="w-4 h-4" />
              Settings
            </Button>
          </Link>
        )}

        <div
          className={cn(
            "flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer",
            isCollapsed ? "justify-center" : ""
          )}
        >
          <Avatar className="h-8 w-8">
            <AvatarImage src={user?.user_metadata?.avatar_url} />
            <AvatarFallback className="text-xs bg-primary/20 text-primary font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>

          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">
                {user?.user_metadata?.name || "User"}
              </p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center justify-center h-8 w-8 rounded-md text-sm font-medium hover:bg-muted/50 transition-colors cursor-pointer">
              <MoreVertical className="w-3 h-3" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align={isCollapsed ? "start" : "end"} className="w-40">
              <DropdownMenuItem>Account</DropdownMenuItem>
              <DropdownMenuItem>Preferences</DropdownMenuItem>
              <DropdownMenuItem className="text-destructive" onClick={onLogout}>
                <LogOut className="w-3 h-3 mr-2" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
