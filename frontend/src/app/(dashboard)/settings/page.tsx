"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { theme, setTheme } = useTheme();
  useEffect(() => {
    let cancelled = false;
    createClient().auth.getUser().then(({ data, error }) => {
      if (cancelled) return;
      if (error || !data.user) { setError("Could not load your profile. Reload the page to retry."); return; }
      setUser(data.user);
      setName(data.user.user_metadata?.full_name || data.user.user_metadata?.name || "");
      setBio(data.user.user_metadata?.bio || "");
    }).catch(() => { if (!cancelled) setError("Could not load your profile. Reload to retry."); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data, error } = await createClient().auth.updateUser({ data: { full_name: name.trim(), name: name.trim(), bio: bio.trim() } });
      if (error) throw error;
      setUser(data.user);
      toast.success("Profile saved");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not save your profile."); }
    finally { setSaving(false); }
  };
  return <div className="min-h-dvh bg-background"><Header user={user} /><main className="mx-auto max-w-3xl p-5 sm:p-8 space-y-8">
    <div><h1 className="text-2xl font-semibold tracking-tight">Settings</h1><p className="mt-1 text-sm text-muted-foreground">Your profile, appearance, and account.</p></div>
    {error && <p role="alert" className="text-destructive">{error}</p>}
    {loading ? <p role="status">Loading profile…</p> : <form onSubmit={save} className="rounded-2xl border bg-card p-5 space-y-4">
      <h2 className="font-semibold">Profile</h2>
      <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" value={user?.email || ""} disabled /></div>
      <div className="space-y-2"><Label htmlFor="name">Full name</Label><Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required /></div>
      <div className="space-y-2"><Label htmlFor="bio">Bio</Label><textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={1000} rows={3} className="w-full rounded-lg border bg-background p-3 text-sm" /></div>
      <Button type="submit" disabled={saving || !user || !name.trim()}>{saving ? "Saving…" : "Save profile"}</Button>
    </form>}
    <section className="rounded-2xl border bg-card p-5 space-y-4"><h2 className="font-semibold">Appearance</h2><div className="flex flex-wrap gap-2">{["light", "dark", "system"].map((value) => <Button key={value} variant={theme === value ? "default" : "outline"} aria-pressed={theme === value} onClick={() => setTheme(value)} className="capitalize">{value}</Button>)}</div></section>
    <section className="rounded-2xl border bg-card p-5 space-y-3"><h2 className="font-semibold">Account security</h2><p className="text-sm text-muted-foreground">You sign in through your identity provider. Manage your password and two-factor authentication in that provider’s account settings.</p><p className="text-sm text-muted-foreground">AI model configuration is managed by the server administrator. Personal API keys and notification subscriptions are not available.</p></section>
  </main></div>;
}
