"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAuthenticatedProfile } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function fail(path: string, message: string): never { redirect(`${path}?error=${encodeURIComponent(message)}`); }
const uuid = z.string().uuid();

export async function toggleResourceBookmark(form: FormData) {
  const current = await requireAuthenticatedProfile(["student"]);
  const id = String(form.get("resource_id") ?? "");
  if (!uuid.safeParse(id).success) return fail("/career/resources", "That resource could not be found.");
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login");
  const saved = form.get("saved") === "true";
  const result = saved
    ? await supabase.from("phase2_resource_bookmarks").delete().eq("user_id", current.userId).eq("resource_id", id)
    : await supabase.from("phase2_resource_bookmarks").upsert({ user_id: current.userId, resource_id: id }, { onConflict: "user_id,resource_id", ignoreDuplicates: true });
  if (result.error) return fail("/career/resources", "We could not update your bookmark.");
  revalidatePath("/career/resources");
  redirect("/career/resources?success=Bookmarks+updated.");
}

export async function submitAssessment(form: FormData) {
  await requireAuthenticatedProfile(["student"]);
  const assessmentId = String(form.get("assessment_id") ?? "");
  if (!uuid.safeParse(assessmentId).success) return fail("/career/assessments", "That assessment could not be found.");
  const answers: Record<string, number> = {};
  for (const [key, value] of form.entries()) {
    if (key.startsWith("answer:")) {
      const questionId = key.slice("answer:".length);
      if (!uuid.safeParse(questionId).success || typeof value !== "string" || !/^\d+$/.test(value)) return fail("/career/assessments", "Check each answer before submitting.");
      answers[questionId] = Number(value);
    }
  }
  if (!Object.keys(answers).length || Object.keys(answers).length > 50 || Object.values(answers).some((value) => value < 0 || value > 7)) return fail("/career/assessments", "Choose one answer for each question.");
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login");
  const { data, error } = await supabase.rpc("phase2_submit_assessment", { p_assessment_id: assessmentId, p_answers: answers });
  if (error || !data?.attemptId) return fail("/career/assessments", "We could not submit that assessment. Refresh the page and try again.");
  revalidatePath("/career/assessments");
  redirect(`/career/assessments?attempt=${data.attemptId}`);
}
