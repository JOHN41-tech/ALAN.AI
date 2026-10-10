"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAuthenticatedProfile } from "@/lib/auth/guards";
import { interviewAnswerSchema, interviewStartSchema } from "@/features/career/schemas";

function fail(message: string): never { redirect(`/career/interviews?error=${encodeURIComponent(message)}`); }
const prompts = [
  "Tell me about yourself and what interests you about this role.",
  "Describe a challenging problem you solved. What was your approach?",
  "Tell me about a project where you used skills relevant to this role.",
];

type InterviewTurn = { question: string; answer: string; feedback: string; at: string };
export async function startInterview(form: FormData) {
  const current = await requireAuthenticatedProfile(["student"]);
  const parsed = interviewStartSchema.safeParse({ role: form.get("role") });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Add a target role.");
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login");
  const { data, error } = await supabase.from("phase2_interviews").insert({ user_id: current.userId, role: parsed.data.role }).select("id").single();
  if (error || !data) return fail("We could not start the practice session.");
  revalidatePath("/career/interviews");
  redirect(`/career/interviews?interview=${data.id}`);
}

export async function submitInterviewAnswer(form: FormData) {
  const current = await requireAuthenticatedProfile(["student"]);
  const id = String(form.get("interview_id") ?? "");
  const answer = interviewAnswerSchema.safeParse({ answer: form.get("answer") });
  if (!answer.success || !/^[0-9a-f-]{36}$/i.test(id)) return fail(answer.success ? "That session could not be found." : answer.error.issues[0]?.message ?? "Add an answer.");
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login");
  const { data: row, error: readError } = await supabase.from("phase2_interviews").select("id,role,status,turns").eq("id", id).eq("user_id", current.userId).maybeSingle();
  if (readError || !row) return fail("That practice session could not be found.");
  if (row.status === "completed") return fail("This practice session is complete. Start another when you are ready.");
  const turns = Array.isArray(row.turns) ? row.turns as InterviewTurn[] : [];
  if (turns.length >= prompts.length) return fail("This practice session is already complete.");
  const feedback = "Reflection guide only: use a clear context → action → result structure, give one specific example, and mention what you learned. This is not an AI evaluation or a verified score.";
  const updated = [...turns, { question: prompts[turns.length] ?? prompts[0], answer: answer.data.answer, feedback, at: new Date().toISOString() }];
  const completed = updated.length >= prompts.length;
  const { error } = await supabase.from("phase2_interviews").update({ turns: updated, status: completed ? "completed" : "active", completed_at: completed ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq("id", id).eq("user_id", current.userId);
  if (error) return fail("We could not save your answer. Try again.");
  revalidatePath("/career/interviews");
  redirect(`/career/interviews?interview=${id}&saved=1`);
}
