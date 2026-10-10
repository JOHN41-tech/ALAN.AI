"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnvironment } from "@/lib/supabase/env";

export function createSupabaseBrowserClient() {
  const env = getSupabaseEnvironment();
  if (!env) return null;

  return createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookieOptions: {
        sameSite: "none",
        secure: true,
      },
    },
  );
}
