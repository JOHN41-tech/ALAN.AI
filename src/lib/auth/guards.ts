import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AppRole, AuthenticatedProfile, StudentProfile } from "@/lib/auth/types";

export async function getAuthenticatedProfile(): Promise<AuthenticatedProfile | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data) return null;
  return {
    userId: user.id,
    email: user.email ?? null,
    profile: data as StudentProfile,
  };
}

export async function requireAuthenticatedProfile(
  roles?: readonly AppRole[],
): Promise<AuthenticatedProfile> {
  const current = await getAuthenticatedProfile();
  if (!current) redirect("/login?next=%2Fdashboard");
  if (current.profile.account_status !== "active") redirect("/login?status=inactive");
  if (roles && !roles.includes(current.profile.role)) redirect("/dashboard");
  return current;
}

export function isRole(value: unknown): value is AppRole {
  return value === "student" || value === "faculty" || value === "administrator";
}
