import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

function getSiteOrigin(request: Request): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");

  const host = request.headers.get("host");
  if (host) {
    const proto = request.headers.get("x-forwarded-proto") ?? "http";
    return `${proto}://${host}`;
  }

  return new URL(request.url).origin;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const origin = getSiteOrigin(request);

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}/dashboard`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
