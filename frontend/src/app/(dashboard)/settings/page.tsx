"use client";

import React, { useState } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { Header } from "@/components/layout/header-enhanced";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge-enhanced";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { 
  Bell, 
  Lock, 
  Palette, 
  Key, 
  Settings, 
  Database, 
  ChevronRight,
  Moon,
  Sun,
} from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";
import type { User } from "@supabase/supabase-js";

interface SettingsPageProps {
  user?: User | null;
}

export default function SettingsPage({ user }: SettingsPageProps) {
  const [activeTab, setActiveTab] = useState<"profile" | "preferences" | "security" | "api" | "llm">("profile");
  const { theme, setTheme } = useTheme();

  const tabs = [
    { id: "profile" as const, label: "Profile", icon: Settings },
    { id: "preferences" as const, label: "Preferences", icon: Palette },
    { id: "security" as const, label: "Security", icon: Lock },
    { id: "api" as const, label: "API Keys", icon: Key },
    { id: "llm" as const, label: "LLM Settings", icon: Database },
  ];

  return (
    <MainLayout user={user}>
      <div className="flex-1 flex flex-col h-screen">
        <Header user={user} workspaceName="Settings" />

        <main className="flex-1 overflow-auto">
          <div className="max-w-6xl mx-auto p-6">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-foreground">Settings</h1>
              <p className="text-foreground/60 mt-1">Manage your account and preferences</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Sidebar */}
              <aside className="lg:col-span-1">
                <div className="space-y-2 sticky top-6">
                  {tabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-colors text-left ${
                          activeTab === tab.id
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-foreground/70 hover:bg-muted"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </aside>

              {/* Content */}
              <div className="lg:col-span-3">
                {activeTab === "profile" && <ProfileSettings user={user} />}
                {activeTab === "preferences" && <PreferencesSettings theme={theme} setTheme={setTheme} />}
                {activeTab === "security" && <SecuritySettings />}
                {activeTab === "api" && <APIKeysSettings />}
                {activeTab === "llm" && <LLMSettings />}
              </div>
            </div>
          </div>
        </main>
      </div>
    </MainLayout>
  );
}

function ProfileSettings({ user }: { user?: User | null }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground mb-4">Profile Information</h2>
        <Card className="p-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="email" className="text-sm font-medium mb-2 block">Email</Label>
              <Input
                id="email"
                value={user?.email || ""}
                disabled
                className="bg-muted/50"
              />
            </div>
            <div>
              <Label htmlFor="name" className="text-sm font-medium mb-2 block">Full Name</Label>
              <Input
                id="name"
                value={user?.user_metadata?.name || ""}
                placeholder="Enter your name"
                className="bg-card"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="bio" className="text-sm font-medium mb-2 block">Bio</Label>
            <textarea
              id="bio"
              placeholder="Tell us about yourself"
              rows={4}
              className="w-full px-3 py-2 rounded-lg border border-border/50 bg-card text-foreground placeholder-muted-foreground"
            />
          </div>

          <Button className="w-full">Save Changes</Button>
        </Card>
      </div>
    </div>
  );
}

function PreferencesSettings({ theme, setTheme }: { theme?: string; setTheme?: (theme: string) => void }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground mb-4">Appearance</h2>
        <Card className="p-6 space-y-4">
          <div>
            <Label className="text-sm font-medium mb-3 block">Theme</Label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: "light", label: "Light", icon: Sun },
                { id: "dark", label: "Dark", icon: Moon },
                { id: "system", label: "System", icon: Settings },
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setTheme?.(id)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-all ${
                    theme === id
                      ? "border-primary bg-primary/5"
                      : "border-border/50 hover:border-border"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-xs font-medium">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <div>
        <h2 className="text-xl font-bold text-foreground mb-4">Notifications</h2>
        <Card className="p-6 space-y-4">
          {[
            { title: "Email notifications", description: "Receive updates about your documents" },
            { title: "Chat notifications", description: "Get alerted when conversations are updated" },
            { title: "Workspace updates", description: "Notifications about workspace changes" },
          ].map((item, idx) => (
            <div key={idx} className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium text-sm text-foreground">{item.title}</p>
                <p className="text-xs text-muted-foreground">{item.description}</p>
              </div>
              <input type="checkbox" className="w-4 h-4 rounded" defaultChecked />
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

function SecuritySettings() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground mb-4">Password & Security</h2>
        <Card className="p-6 space-y-4">
          <Button variant="outline" className="w-full">Change Password</Button>
          <Separator />
          <div>
            <p className="text-sm font-medium text-foreground mb-3">Two-Factor Authentication</p>
            <p className="text-xs text-muted-foreground mb-4">Add an extra layer of security to your account</p>
            <Button className="w-full">Enable 2FA</Button>
          </div>
        </Card>
      </div>

      <div>
        <h2 className="text-xl font-bold text-foreground mb-4">Active Sessions</h2>
        <Card className="p-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div>
                <p className="text-sm font-medium text-foreground">Current Session</p>
                <p className="text-xs text-muted-foreground">Chrome on macOS</p>
              </div>
              <Badge variant="success">Active</Badge>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function APIKeysSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground mb-4">API Keys</h2>
        <Card className="p-6 space-y-4">
          <p className="text-sm text-muted-foreground">Manage API keys for programmatic access</p>
          <Button className="w-full">Generate New API Key</Button>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Production Key</p>
                <p className="text-xs text-muted-foreground font-mono truncate">sk_live_4eC39HqLyjWDarhtT...</p>
              </div>
              <Button variant="outline" size="sm">Revoke</Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function LLMSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground mb-4">LLM Configuration</h2>
        <Card className="p-6 space-y-4">
          <div>
            <Label htmlFor="model" className="text-sm font-medium mb-2 block">Default Model</Label>
            <select
              id="model"
              className="w-full px-3 py-2 rounded-lg border border-border/50 bg-card text-foreground"
            >
              <option>gpt-4</option>
              <option>gpt-3.5-turbo</option>
              <option>claude-3-opus</option>
              <option>claude-3-sonnet</option>
            </select>
          </div>

          <div>
            <Label htmlFor="temperature" className="text-sm font-medium mb-2 block">Temperature (0-1)</Label>
            <Input
              id="temperature"
              type="number"
              min="0"
              max="1"
              step="0.1"
              defaultValue="0.7"
              className="bg-card"
            />
          </div>

          <div>
            <Label htmlFor="maxTokens" className="text-sm font-medium mb-2 block">Max Tokens</Label>
            <Input
              id="maxTokens"
              type="number"
              defaultValue="2048"
              className="bg-card"
            />
          </div>

          <Button className="w-full">Save LLM Settings</Button>
        </Card>
      </div>
    </div>
  );
}
