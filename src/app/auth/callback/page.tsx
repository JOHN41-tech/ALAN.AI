import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Completing sign in" };

type CallbackProps = { searchParams: Promise<{ code?: string; next?: string }> };

function safeNextPath(candidate: string | undefined) {
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\")) return "/app";
  return candidate;
}

export default async function AuthCallbackPage({ searchParams }: CallbackProps) {
  const { code, next } = await searchParams;
  const destination = safeNextPath(next);
  const supabase = await createSupabaseServerClient();
  if (!code || !supabase) redirect("/login?error=callback");

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) redirect("/login?error=callback");
  redirect(destination);
}
