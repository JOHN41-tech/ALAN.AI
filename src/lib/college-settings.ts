import { createSupabaseServerClient } from "@/lib/supabase/server";
import { collegeTimeZone } from "@/lib/timezone";

export async function getCollegeSettings(supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>) {
  const { data, error } = await supabase.from("attendance_settings").select("college_name,time_zone").eq("id", true).maybeSingle();
  const candidate = data?.time_zone;
  let timeZone = collegeTimeZone();
  if (candidate) {
    try { new Intl.DateTimeFormat("en-US", { timeZone: candidate }).format(new Date()); timeZone = candidate; }
    catch { /* Keep the validated environment fallback and return the database state unchanged for administrators to repair. */ }
  }
  return { collegeName: data?.college_name ?? process.env.NEXT_PUBLIC_COLLEGE_NAME ?? "College Companion", timeZone, error: error?.message ?? null };
}
