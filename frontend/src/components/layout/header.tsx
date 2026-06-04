"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { LogOut, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { User } from "@supabase/supabase-js";

interface HeaderProps {
  user: User | null;
}

export function Header({ user }: HeaderProps) {
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="flex h-14 items-center px-4 max-w-screen-2xl mx-auto">
        <div className="flex items-center gap-2 mr-4">
          <Brain className="h-6 w-6 text-primary" />
          <span className="font-bold text-lg">NexusRAG</span>
        </div>

        <div className="flex-1" />

        {user && (
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src={user.user_metadata?.avatar_url} />
              <AvatarFallback>
                {user.email?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm text-muted-foreground hidden md:block">
              {user.email}
            </span>
            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
