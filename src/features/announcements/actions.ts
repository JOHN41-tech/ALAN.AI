"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAuthenticatedProfile } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCollegeSettings } from "@/lib/college-settings";
import { localDateTimeToIso } from "@/lib/timezone";

const idSchema = z.string().uuid();
const text = (form: FormData, key: string, max = 300) => String(form.get(key) ?? "").trim().slice(0, max);
const fail = (path: string, message: string): never => redirect(`${path}?error=${encodeURIComponent(message)}`);

function selectedIds(form: FormData, key: string) {
  return form.getAll(key).filter((value): value is string => typeof value === "string" && value.length > 0);
}

function getTargets(form: FormData) {
  if (form.get("college_wide") === "on") return [{ type: "college", id: null }];
  const targets: { type: string; id: string }[] = [];
  for (const id of selectedIds(form, "department_ids")) targets.push({ type: "department", id });
  for (const id of selectedIds(form, "semester_ids")) targets.push({ type: "semester", id });
  for (const id of selectedIds(form, "section_ids")) targets.push({ type: "section", id });
  return targets;
}

export async function saveAnnouncement(form: FormData) {
  await requireAuthenticatedProfile(["administrator"]);
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login");
  const settings = await getCollegeSettings(supabase);
  const id = text(form, "id", 40) || null;
  const title = text(form, "title", 180);
  const summary = text(form, "summary", 360) || null;
  const body = text(form, "body", 20000);
  const category = text(form, "category", 48) || "general";
  const priority = text(form, "priority", 20);
  const status = text(form, "status", 20);
  const targets = getTargets(form);
  const valid = z.object({ title: z.string().min(3).max(180), summary: z.string().max(360).nullable(), body: z.string().min(1).max(20000), category: z.string().min(1).max(48), priority: z.enum(["normal", "important", "urgent"]), status: z.enum(["draft", "published", "archived"]), id: idSchema.nullable() }).safeParse({ title, summary, body, category, priority, status, id });
  if (!valid.success) return fail("/admin/announcements", valid.error.issues[0]?.message ?? "Check announcement details.");
  if (targets.length === 0) return fail("/admin/announcements", "Choose the whole college or at least one department, semester or section.");
  if ([...selectedIds(form, "department_ids"), ...selectedIds(form, "semester_ids"), ...selectedIds(form, "section_ids")].some((targetId) => !idSchema.safeParse(targetId).success)) return fail("/admin/announcements", "An audience identifier is invalid.");
  const expiresLocal = text(form, "expires_at", 32);
  let expiresAt: string | null = null;
  try { expiresAt = expiresLocal ? localDateTimeToIso(expiresLocal, settings.timeZone) : null; }
  catch (error) { return fail("/admin/announcements", error instanceof Error ? error.message : "Expiry date is invalid."); }
  const { data, error } = await supabase.rpc("admin_save_announcement", {
    p_id: valid.data.id,
    p_data: { title: valid.data.title, summary: valid.data.summary, body: valid.data.body, category: valid.data.category, priority: valid.data.priority, status: valid.data.status, expires_at: expiresAt },
    p_targets: targets,
  });
  if (error) return fail("/admin/announcements", error.message);
  revalidatePath("/announcements");
  revalidatePath("/admin/announcements");
  revalidatePath(`/announcements/${data}`);
  redirect(`/admin/announcements?success=${encodeURIComponent(valid.data.status === "published" ? "Announcement published to its selected audience." : "Announcement saved.")}`);
}

export async function markAnnouncementRead(form: FormData) {
  const current = await requireAuthenticatedProfile();
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login");
  const announcementId = text(form, "announcement_id", 40);
  const destination = `/announcements/${announcementId}`;
  if (!idSchema.safeParse(announcementId).success) return fail("/announcements", "Announcement identifier is invalid.");
  const { error } = await supabase.from("announcement_reads").upsert({ announcement_id: announcementId, user_id: current.userId, read_at: new Date().toISOString() }, { onConflict: "announcement_id,user_id" });
  if (error) return fail(destination, error.message);
  revalidatePath("/announcements");
  revalidatePath(destination);
  redirect(`${destination}?success=${encodeURIComponent("Marked as read.")}`);
}
