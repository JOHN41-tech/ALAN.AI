"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAuthenticatedProfile } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCollegeSettings } from "@/lib/college-settings";
import { localDateTimeToIso } from "@/lib/timezone";

const uuid = z.string().uuid();
const clean = (form: FormData, key: string, max = 300) => String(form.get(key) ?? "").trim().slice(0, max);
const fail = (path: string, message: string): never => redirect(`${path}?error=${encodeURIComponent(message)}`);
function getTargets(form: FormData) {
  if (form.get("college_wide") === "on") return [{ type: "college", id: null }];
  const targets: { type: string; id: string }[] = [];
  for (const [field, type] of [["department_ids", "department"], ["semester_ids", "semester"], ["section_ids", "section"]]) {
    for (const value of form.getAll(field).filter((item): item is string => typeof item === "string" && Boolean(item))) targets.push({ type, id: value });
  }
  return targets;
}

export async function saveAcademicEvent(form: FormData) {
  await requireAuthenticatedProfile(["administrator"]);
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login");
  const settings = await getCollegeSettings(supabase);
  const id = clean(form, "id", 40) || null;
  const title = clean(form, "title", 180);
  const description = clean(form, "description", 10000) || null;
  const category = clean(form, "category", 40);
  const location = clean(form, "location", 160) || null;
  const status = clean(form, "status", 20);
  const startsLocal = clean(form, "starts_at", 32);
  const endsLocal = clean(form, "ends_at", 32);
  const targets = getTargets(form);
  const parsed = z.object({ id: uuid.nullable(), title: z.string().min(3).max(180), description: z.string().max(10000).nullable(), category: z.enum(["internal_exam", "semester_exam", "assignment", "project_review", "laboratory", "seminar", "holiday", "department_event", "other"]), location: z.string().max(160).nullable(), status: z.enum(["draft", "published", "archived"]) }).safeParse({ id, title, description, category, location, status });
  if (!parsed.success) return fail("/admin/events", parsed.error.issues[0]?.message ?? "Check event details.");
  if (!targets.length) return fail("/admin/events", "Choose the college or at least one targeted academic group.");
  if (targets.some((target) => target.id && !uuid.safeParse(target.id).success)) return fail("/admin/events", "An audience identifier is invalid.");
  let startsAt: string; let endsAt: string;
  try { startsAt = localDateTimeToIso(startsLocal, settings.timeZone); endsAt = localDateTimeToIso(endsLocal, settings.timeZone); }
  catch (error) { return fail("/admin/events", error instanceof Error ? error.message : "Event dates are invalid."); }
  if (Date.parse(endsAt) <= Date.parse(startsAt)) return fail("/admin/events", "The event end must be after its start.");
  const { error } = await supabase.rpc("admin_save_academic_event", { p_id: parsed.data.id, p_data: { title: parsed.data.title, description: parsed.data.description, category: parsed.data.category, starts_at: startsAt, ends_at: endsAt, time_zone: settings.timeZone, location: parsed.data.location, status: parsed.data.status }, p_targets: targets });
  if (error) return fail("/admin/events", error.message);
  revalidatePath("/calendar");
  revalidatePath("/admin/events");
  redirect(`/admin/events?success=${encodeURIComponent(parsed.data.status === "published" ? "Event published for the selected audience." : "Event saved.")}`);
}
