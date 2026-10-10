import type { Metadata } from "next";
import { Mic, MessageCircle, Play, RotateCcw } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { StatusMessage } from "@/components/status-message";
import { EmptyState } from "@/components/empty-state";
import { requireAuthenticatedProfile } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { startInterview, submitInterviewAnswer } from "@/features/career/interview-actions";

export const metadata: Metadata = { title: "Mock interviews" };
type Search = Promise<{ interview?: string; error?: string; saved?: string }>;
type Turn = { question: string; answer: string; feedback: string; at: string };

export default async function InterviewsPage({ searchParams }: { searchParams: Search }) {
  const current = await requireAuthenticatedProfile(["student"]);
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return <><PageHeading title="Mock interviews" /><StatusMessage error="Configure Supabase to continue." /></>;
  const { data: rows, error } = await supabase.from("phase2_interviews").select("id,role,status,turns,created_at,completed_at").eq("user_id", current.userId).order("created_at", { ascending: false }).limit(20);
  const currentInterview = rows?.find((row) => row.id === params.interview);
  const turns = currentInterview && Array.isArray(currentInterview.turns) ? currentInterview.turns as Turn[] : [];
  return <>
    <PageHeading title="Mock interview practice" description="Work through a few common prompts and save your reflections. Coaching is a static reflection guide, not AI evaluation or a verified score." />
    <StatusMessage error={params.error || error?.message} success={params.saved ? "Your answer was saved." : undefined} />
    <div className="career-interview-layout"><section className="surface career-section"><div className="career-section-icon"><Mic size={18} /><span>Practice session</span></div>
      {currentInterview ? <><h2>{currentInterview.role}</h2><p className="muted">{currentInterview.status === "completed" ? "This session is complete. Review your answers or start another." : `${turns.length} of 3 prompts answered.`}</p><div className="career-interview-turns">{turns.map((turn, index) => <article className="career-interview-turn" key={`${turn.at}-${index}`}><span className="eyebrow">Prompt {index + 1}</span><h3>{turn.question}</h3><p className="career-interview-answer">{turn.answer}</p><p className="notice notice--info">Reflection guide: {turn.feedback}</p></article>)}</div>{currentInterview.status !== "completed" && <form action={submitInterviewAnswer} className="career-form"><input type="hidden" name="interview_id" value={currentInterview.id} /><label className="field"><span className="field-label">Your answer</span><textarea className="input" name="answer" rows={6} maxLength={3000} minLength={1} required placeholder="Share a specific example, what you did, and what you learned." /></label><button className="button button--primary">Save answer <MessageCircle size={15} /></button></form>}</> : <><h2>Start a role-specific practice</h2><p className="muted">Three prompts help you rehearse clear examples. Your answers remain private to your student account.</p><form action={startInterview} className="career-form"><label className="field"><span className="field-label">Role you are preparing for</span><input className="input" name="role" minLength={2} maxLength={100} required placeholder="e.g. software engineering intern" /></label><button className="button button--primary">Start practice <Play size={15} /></button></form></>}
    </section><aside className="surface career-section"><div className="eyebrow">PRIVATE PRACTICE HISTORY</div><h2>Your sessions</h2>{rows?.length ? <div className="career-list">{rows.map((row) => <a className="career-list-row" href={`/career/interviews?interview=${row.id}`} key={row.id}><span><strong>{row.role}</strong><small>{row.status === "completed" ? "Complete" : "In progress"} · {new Date(row.created_at).toLocaleDateString("en", { dateStyle: "medium" })}</small></span><RotateCcw size={15} /></a>)}</div> : <EmptyState icon={Mic} title="No practice yet" description="Create a private session when you have a role in mind." />}</aside></div>
  </>;
}
