"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAuthenticatedProfile } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { opportunityInputSchema } from "@/features/career/schemas";

const uuid = z.string().uuid();
function fail(path: string, message: string): never { redirect(`${path}?error=${encodeURIComponent(message)}`); }

export async function toggleOpportunitySave(form: FormData) {
  const current = await requireAuthenticatedProfile(["student"]);
  const id = String(form.get("opportunity_id") ?? "");
  if (!uuid.safeParse(id).success) return fail("/career/opportunities", "That opportunity could not be found.");
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login");
  const currentlySaved = form.get("saved") === "true";
  const result = currentlySaved
    ? await supabase.from("phase2_saved_opportunities").delete().eq("user_id", current.userId).eq("opportunity_id", id)
    : await supabase.from("phase2_saved_opportunities").upsert({ user_id: current.userId, opportunity_id: id }, { onConflict: "user_id,opportunity_id", ignoreDuplicates: true });
  if (result.error) return fail("/career/opportunities", "We could not update your saved opportunities. Try again.");
  revalidatePath("/career");
  revalidatePath("/career/opportunities");
  redirect("/career/opportunities?success=Saved+opportunities+updated.");
}

export async function createApplication(form: FormData) {
  const current = await requireAuthenticatedProfile(["student"]);
  const id = String(form.get("opportunity_id") ?? "");
  if (!uuid.safeParse(id).success) return fail("/career/opportunities", "That opportunity could not be found.");
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login");
  const { error } = await supabase.from("phase2_applications").insert({ user_id: current.userId, opportunity_id: id, status: "Interested" });
  if (error?.code === "23505") return fail("/career/opportunities", "You already track this opportunity.");
  if (error) return fail("/career/opportunities", "This listing may no longer be available. Refresh and try again.");
  revalidatePath("/career");
  revalidatePath("/career/opportunities");
  redirect("/career/opportunities?success=Added+to+your+application+tracker.");
}

export async function updateApplication(form: FormData) {
  const current = await requireAuthenticatedProfile(["student"]);
  const id = String(form.get("application_id") ?? "");
  const parsed = z.object({ status: z.enum(["Interested", "Applied", "Assessment", "Interview", "Offer", "Rejected", "Withdrawn"]), notes: z.string().trim().max(1000) }).safeParse({ status: form.get("status"), notes: form.get("notes") ?? "" });
  if (!uuid.safeParse(id).success || !parsed.success) return fail("/career/opportunities?tab=applications", "Check the application update and try again.");
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login");
  const { error } = await supabase.from("phase2_applications").update({ status: parsed.data.status, notes: parsed.data.notes, updated_at: new Date().toISOString() }).eq("id", id).eq("user_id", current.userId);
  if (error) return fail("/career/opportunities?tab=applications", "We could not update this application.");
  revalidatePath("/career/opportunities");
  redirect("/career/opportunities?tab=applications&success=Application+updated.");
}

export async function saveOpportunity(form: FormData) {
  const current = await requireAuthenticatedProfile(["administrator"]);
  const id = String(form.get("id") ?? "").trim();
  const raw = {
    title: form.get("title"), company: form.get("company"), kind: form.get("kind"),
    domain: String(form.get("domain") ?? "").trim() || null,
    location: String(form.get("location") ?? "").trim() || null,
    workMode: String(form.get("work_mode") ?? "").trim() || null,
    skills: String(form.get("skills") ?? "").split(",").map((value) => value.trim()).filter(Boolean),
    description: form.get("description"),
    deadline: String(form.get("deadline") ?? "").trim() || null,
    sourceUrl: form.get("source_url"),
    verificationStatus: form.get("verification_status"),
    published: form.get("published") === "on",
  };
  const parsed = opportunityInputSchema.safeParse(raw);
  if (!parsed.success) return fail("/admin/career", parsed.error.issues[0]?.message ?? "Check the opportunity details.");
  if (parsed.data.published && parsed.data.verificationStatus !== "verified") return fail("/admin/career", "Only a verified listing can be published.");
  if (id && !uuid.safeParse(id).success) return fail("/admin/career", "The listing identifier is invalid.");
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login");
  const payload = {
    title: parsed.data.title, company: parsed.data.company, kind: parsed.data.kind,
    domain: parsed.data.domain, location: parsed.data.location, work_mode: parsed.data.workMode,
    skills: parsed.data.skills, description: parsed.data.description, deadline: parsed.data.deadline,
    source_url: parsed.data.sourceUrl, verification_status: parsed.data.verificationStatus,
    published: parsed.data.published, provenance: "administrator-verified-source",
    created_by: current.userId, updated_at: new Date().toISOString(),
  };
  const result = id
    ? await supabase.from("phase2_opportunities").update(payload).eq("id", id)
    : await supabase.from("phase2_opportunities").insert(payload);
  if (result.error) return fail("/admin/career", "We could not save the listing. Verify the source URL and publication status.");
  revalidatePath("/admin/career");
  revalidatePath("/career/opportunities");
  redirect("/admin/career?success=Opportunity+saved.");
}
