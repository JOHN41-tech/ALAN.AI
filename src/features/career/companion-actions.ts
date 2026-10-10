"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAuthenticatedProfile } from "@/lib/auth/guards";
import { requestAICompletion } from "@/features/career/ai-provider";
import { chatInputSchema } from "@/features/career/schemas";

function fail(message: string): never { redirect(`/career/companion?error=${encodeURIComponent(message)}`); }
function cleanJson(value: unknown) {
  if (value === null || typeof value !== "object") return {};
  return value;
}

export async function sendCompanionMessage(form: FormData) {
  const current = await requireAuthenticatedProfile(["student"]);
  const parsed = chatInputSchema.safeParse({
    message: form.get("message"),
    conversationId: String(form.get("conversation_id") ?? "").trim() || undefined,
    topic: form.get("topic") || "general",
    sharePreferences: form.get("share_preferences") === "on",
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Write a message before sending.");
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login");
  let history: Array<{ role: "user" | "assistant"; content: string }> = [];
  if (parsed.data.conversationId) {
    const { data: conversation, error: conversationError } = await supabase.from("phase2_conversations").select("id").eq("id", parsed.data.conversationId).eq("user_id", current.userId).maybeSingle();
    if (conversationError || !conversation) return fail("That private conversation could not be found.");
    const { data, error } = await supabase.from("phase2_messages").select("role,content").eq("conversation_id", conversation.id).order("created_at", { ascending: false }).limit(12);
    if (error) return fail("We could not load the recent conversation context.");
    history = (data ?? []).reverse().filter((item) => item.role === "user" || item.role === "assistant").map((item) => ({ role: item.role as "user" | "assistant", content: String(item.content).slice(0, 1200) }));
  }
  const { data: allowed, error: limitError } = await supabase.rpc("phase2_claim_ai_request");
  if (limitError) return fail("The Phase 2 migration is not applied yet. The companion is ready once the database setup is complete.");
  if (!allowed) return fail("You have reached the short-term AI limit. Wait a minute before sending another message.");
  let preferences = "";
  if (parsed.data.sharePreferences) {
    const { data } = await supabase.from("phase2_career_profiles").select("answers,target_domain").eq("user_id", current.userId).maybeSingle();
    if (data) preferences = `\nStudent-approved career preferences (only fields explicitly saved in Career Discovery): ${JSON.stringify(cleanJson({ answers: data.answers, targetDomain: data.target_domain })).slice(0, 1800)}`;
  }
  const topicGuidance = parsed.data.topic === "study" ? "Focus on explaining concepts, worked examples, practice steps and metacognition." : parsed.data.topic === "career" ? "Focus on skill-building, career exploration and practical next steps; do not invent current job vacancies or employer details." : "Help with college learning and career planning in a concise, supportive way.";
  const result = await requestAICompletion([
    { role: "system", content: `You are ALAN.AI, a supportive college study and career companion. ${topicGuidance} Be concise, explain uncertainty, do not claim access to college timetable/attendance or official records, do not invent verified job listings or resource links, do not guarantee admission/employment/salary outcomes, and do not present advice as official college policy. Only use private profile context if it appears below because the student explicitly enabled sharing.${preferences}` },
    ...history,
    { role: "user", content: parsed.data.message },
  ], { maxTokens: 650, temperature: 0.45 });
  if (!result.ok) {
    if (result.reason === "missing_keys") return fail("The AI provider is not configured. Ask an administrator to complete the protected server settings.");
    if (result.reason === "invalid_endpoint") return fail("The AI provider URL must be a valid HTTPS OpenAI-compatible API base.");
    return fail("The AI provider is temporarily unavailable. Your message was not saved; try again shortly.");
  }
  const { data: conversationId, error } = await supabase.rpc("phase2_save_chat_turn", {
    p_conversation_id: parsed.data.conversationId ?? null,
    p_title: parsed.data.message.slice(0, 80),
    p_user_content: parsed.data.message,
    p_assistant_content: result.text,
  });
  if (error || !conversationId) return fail("The response was ready, but we could not save the private conversation. Try again.");
  revalidatePath("/career/companion");
  revalidatePath("/career");
  redirect(`/career/companion?conversation=${conversationId}`);
}

export async function deleteCompanionConversation(form: FormData) {
  const current = await requireAuthenticatedProfile(["student"]);
  const id = String(form.get("conversation_id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail("That conversation could not be found.");
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login");
  const { error } = await supabase.from("phase2_conversations").delete().eq("id", id).eq("user_id", current.userId);
  if (error) return fail("We could not delete that conversation.");
  revalidatePath("/career/companion");
  redirect("/career/companion?success=Conversation+deleted.");
}
