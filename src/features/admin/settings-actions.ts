"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAuthenticatedProfile } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const timeZoneSchema = z.string().min(1).max(64).refine((value) => { try { new Intl.DateTimeFormat("en-US", { timeZone: value }); return true; } catch { return false; } }, "Choose a valid IANA timezone.");
const schema = z.object({ college_name: z.string().trim().min(2).max(100), time_zone: timeZoneSchema, minimum_percent: z.coerce.number().min(0).max(100), target_percent: z.coerce.number().min(0).max(100), excused_counts_as_conducted: z.boolean(), excused_counts_as_attended: z.boolean() });
function fail(message: string): never { redirect(`/admin/settings?error=${encodeURIComponent(message)}`); }

export async function updateCollegeSettings(form: FormData) {
  const current = await requireAuthenticatedProfile(["administrator"]);
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login");
  const parsed = schema.safeParse({
    college_name: String(form.get("college_name") ?? "").trim(),
    time_zone: String(form.get("time_zone") ?? "").trim(),
    minimum_percent: String(form.get("minimum_percent") ?? ""),
    target_percent: String(form.get("target_percent") ?? ""),
    excused_counts_as_conducted: form.get("excused_counts_as_conducted") === "on",
    excused_counts_as_attended: form.get("excused_counts_as_attended") === "on",
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check college settings.");
  const { error } = await supabase.rpc("admin_update_college_settings", {
    p_college_name: parsed.data.college_name,
    p_time_zone: parsed.data.time_zone,
    p_minimum_percent: parsed.data.minimum_percent,
    p_target_percent: parsed.data.target_percent,
    p_excused_counts_as_conducted: parsed.data.excused_counts_as_conducted,
    p_excused_counts_as_attended: parsed.data.excused_counts_as_attended,
  });
  if (error) return fail(error.message);
  for (const path of ["/admin/settings", "/dashboard", "/attendance", "/calendar", "/timetable", "/admin/timetable", "/admin/events", "/admin/announcements"]) revalidatePath(path);
  void current;
  redirect(`/admin/settings?success=${encodeURIComponent("College and attendance settings saved; the change was audited.")}`);
}
