"use client";

import React, { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { useAppStore } from "@/store";
import type { User } from "@supabase/supabase-js";

interface MainLayoutProps {
  children: React.ReactNode;
  user?: User | null;
}

export function MainLayout({ children, user }: MainLayoutProps) {
  const [showCreateWorkspaceDialog, setShowCreateWorkspaceDialog] = useState(false);

  const handleCreateWorkspace = () => {
    setShowCreateWorkspaceDialog(true);
  };

  const handleLogout = async () => {
    // Handle logout - will be connected to auth
    console.log("Logout clicked");
  };

  return (
    <ThemeProvider>
      <div className="flex h-screen bg-background">
        <Sidebar
          user={user}
          onCreateWorkspace={handleCreateWorkspace}
          onLogout={handleLogout}
        />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </ThemeProvider>
  );
}
