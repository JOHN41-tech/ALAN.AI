"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAuthenticatedProfile } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requestAICompletion } from "@/features/career/ai-provider";
import { careerProfileInputSchema, roadmapDraftSchema } from "@/features/career/schemas";
import type { CareerAnswers } from "@/features/career/types";

function fail(path: string, message: string): never { redirect(`${path}?error=${encodeURIComponent(message)}`); }
function parseList(value: FormDataEntryValue | null, max: number) { return String(value ?? "").split(",").map((item) => item.trim()).filter(Boolean).slice(0, max); }

export async function saveCareerProfile(form: FormData) {
  const current = await requireAuthenticatedProfile(["student"]);
  const targetDomain = String(form.get("target_domain") ?? "").trim();
  const parsed = careerProfileInputSchema.safeParse({
    interests: parseList(form.get("interests"), 12),
    skills: parseList(form.get("skills"), 24),
    learningStyle: form.get("learning_style"),
    availableHours: form.get("available_hours"),
    targetDomain: targetDomain || null,
  });
  if (!parsed.success) return fail("/career/discovery", parsed.error.issues[0]?.message ?? "Check your discovery preferences.");
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login");
  const answers: CareerAnswers = { ...parsed.data, targetDomain: parsed.data.targetDomain };
  const { error } = await supabase.from("phase2_career_profiles").upsert({ user_id: current.userId, answers, target_domain: parsed.data.targetDomain, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) return fail("/career/discovery", "We could not save your career preferences. Try again.");
  revalidatePath("/career/discovery");
  revalidatePath("/career");
  redirect("/career/discovery?success=Preferences+saved.+Recommendations+are+heuristic+signals%2C+not+predictions.");
}

function extractJson(text: string): unknown {
  const clean = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  return JSON.parse(start >= 0 && end > start ? clean.slice(start, end + 1) : clean);
}

export async function generateCareerRoadmap(form: FormData) {
  await requireAuthenticatedProfile(["student"]);
  const input = z.object({ domain: z.string().trim().min(2).max(100), goal: z.string().trim().min(6).max(500), weeklyHours: z.coerce.number().int().min(1).max(40) }).safeParse({ domain: form.get("domain"), goal: form.get("goal"), weeklyHours: form.get("weekly_hours") });
  if (!input.success) return fail("/career/roadmaps", input.error.issues[0]?.message ?? "Check the roadmap goal.");
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login");
  const { data: allowed, error: limitError } = await supabase.rpc("phase2_claim_ai_request");
  if (limitError) return fail("/career/roadmaps", "The Phase 2 database migration must be applied before AI roadmap generation is available.");
  if (!allowed) return fail("/career/roadmaps", "You have reached the short-term AI limit. Wait a minute and try again.");
  const response = await requestAICompletion([
    { role: "system", content: "Create a realistic student learning roadmap. Return exactly one JSON object with keys title, summary, tasks. tasks must contain 4–8 objects with title, phase, description, estimatedHours. Keep advice educational, achievable, and honest; do not promise outcomes, invent credential requirements, or include URLs/resources. Mention that sequencing and hours are estimates. Keep each task actionable." },
    { role: "user", content: JSON.stringify({ goal: input.data.goal, domain: input.data.domain, availableHoursPerWeek: input.data.weeklyHours }) },
  ], { maxTokens: 850, temperature: 0.35 });
  if (!response.ok) {
    const message = response.reason === "missing_keys" ? "AI roadmap generation is not configured. Add the server-side AI keys and HTTPS-compatible endpoint in project settings." : "The AI provider did not return a usable roadmap. Try again later.";
    return fail("/career/roadmaps", message);
  }
  let draft: unknown;
  try { draft = extractJson(response.text); }
  catch { return fail("/career/roadmaps", "The AI response was not valid JSON. Please retry with a more specific goal."); }
  const parsedDraft = roadmapDraftSchema.safeParse(draft);
  if (!parsedDraft.success) return fail("/career/roadmaps", "The AI response did not meet the roadmap format. Please retry with a more specific goal.");
  const { data: id, error } = await supabase.rpc("phase2_create_roadmap", {
    p_title: parsedDraft.data.title,
    p_domain: input.data.domain,
    p_summary: parsedDraft.data.summary,
    p_weekly_hours: input.data.weeklyHours,
    p_ai_generated: true,
    p_tasks: parsedDraft.data.tasks,
  });
  if (error || !id) return fail("/career/roadmaps", "The roadmap could not be saved. Apply the Phase 2 database migration and try again.");
  revalidatePath("/career");
  revalidatePath("/career/roadmaps");
  redirect(`/career/roadmaps/${id}?created=1`);
}

export async function toggleRoadmapTask(form: FormData) {
  await requireAuthenticatedProfile(["student"]);
  const id = String(form.get("task_id") ?? "");
  const done = form.get("done") === "true";
  if (!z.string().uuid().safeParse(id).success) return fail("/career/roadmaps", "That roadmap task could not be found.");
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login");
  const { error } = await supabase.from("phase2_roadmap_tasks").update({ done: !done }).eq("id", id);
  if (error) return fail("/career/roadmaps", "We could not update that milestone.");
  revalidatePath("/career/roadmaps");
  revalidatePath("/career");
  const requestedReturn = String(form.get("return_to") ?? "");
  const returnTo = requestedReturn.startsWith("/career/roadmaps") && !requestedReturn.startsWith("//") ? requestedReturn : "/career/roadmaps";
  redirect(returnTo);
}
