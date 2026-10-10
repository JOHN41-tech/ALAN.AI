import Link from "next/link";
import type { Metadata } from "next";
import { CheckCircle2, ClipboardCheck } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { StatusMessage } from "@/components/status-message";
import { EmptyState } from "@/components/empty-state";
import { requireAuthenticatedProfile } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { submitAssessment } from "@/features/career/learning-actions";
import type { AssessmentQuestion } from "@/features/career/types";

export const metadata: Metadata = { title: "Assessments" };
type SearchParams = Promise<{ attempt?: string; error?: string }>;
type Review = { questionId: string; prompt: string; options: string[]; selectedIndex: number; correctIndex: number; correct: boolean; explanation: string };

export default async function AssessmentsPage({ searchParams }: { searchParams: SearchParams }) {
  const current = await requireAuthenticatedProfile(["student"]);
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return <><PageHeading title="Assessments" /><StatusMessage error="Configure Supabase to continue." /></>;
  const [{ data: questions, error: questionError }, { data: attempts, error: attemptError }] = await Promise.all([
    supabase.rpc("phase2_list_assessment_questions"),
    supabase.from("phase2_assessment_attempts").select("id,assessment_id,score,total,created_at").eq("user_id", current.userId).order("created_at", { ascending: false }).limit(20),
  ]);
  const rows = (questions ?? []) as AssessmentQuestion[];
  const first = rows[0];
  const formQuestions = first ? rows.filter((question) => question.assessment_id === first.assessment_id) : [];
  let review: Review[] = [];
  let selectedAttempt: { score: number; total: number; created_at: string } | null = null;
  if (params.attempt && /^[0-9a-f-]{36}$/i.test(params.attempt)) {
    const { data } = await supabase.from("phase2_assessment_attempts").select("score,total,review,created_at").eq("id", params.attempt).eq("user_id", current.userId).maybeSingle();
    if (data) { selectedAttempt = data; review = Array.isArray(data.review) ? data.review as Review[] : []; }
  }
  return <>
    <PageHeading title="Knowledge check-ins" description="Practice questions are for learning reflection. Your answers are scored on the server; correct options are revealed only after submission." />
    <StatusMessage error={params.error || questionError?.message || attemptError?.message} />
    {selectedAttempt && <section className="surface career-section career-assessment-result"><div className="career-section-icon"><CheckCircle2 size={18} /><span>Saved result</span></div><h2>{selectedAttempt.score} of {selectedAttempt.total}</h2><p>{Math.round(selectedAttempt.score / selectedAttempt.total * 100)}% on {new Date(selectedAttempt.created_at).toLocaleDateString("en", { dateStyle: "medium" })}. Use the explanations to choose what to revisit.</p><div className="career-review-list">{review.map((item) => <article className={`career-review ${item.correct ? "is-correct" : "is-incorrect"}`} key={item.questionId}><strong>{item.correct ? "Correct" : "Review this"}: {item.prompt}</strong><p>Your answer: {item.options[item.selectedIndex] ?? "—"}{!item.correct && ` · Correct answer: ${item.options[item.correctIndex] ?? "—"}`}</p><small>{item.explanation}</small></article>)}</div></section>}
    {formQuestions.length ? <section className="surface career-section"><div className="eyebrow">{first?.topic}</div><h2>{first?.assessment_title}</h2><p>{first?.instructions}</p><form action={submitAssessment} className="career-assessment-form"><input type="hidden" name="assessment_id" value={first?.assessment_id} />{formQuestions.map((question, index) => <fieldset className="career-question" key={question.question_id}><legend><span className="eyebrow">Question {index + 1}</span><strong>{question.prompt}</strong></legend>{question.options.map((option, optionIndex) => <label className="career-option" key={`${question.question_id}-${optionIndex}`}><input type="radio" name={`answer:${question.question_id}`} value={optionIndex} required /><span>{option}</span></label>)}</fieldset>)}<p className="muted-small">Your correct-answer review will be available only after the server saves this attempt.</p><button className="button button--primary">Submit check-in <ClipboardCheck size={15} /></button></form></section> : <EmptyState icon={ClipboardCheck} title="No assessments are published yet" description="Practice questions will appear here after the Phase 2 schema and assessment seed are applied." />}
    <section className="surface career-section"><div className="section-heading"><div><div className="eyebrow">YOUR HISTORY</div><h2>Previous attempts</h2></div></div>{attempts?.length ? <div className="career-list">{attempts.map((attempt) => <Link className="career-list-row" key={attempt.id} href={`/career/assessments?attempt=${attempt.id}`}><span><strong>{attempt.score}/{attempt.total} correct</strong><small>{new Date(attempt.created_at).toLocaleDateString("en", { dateStyle: "medium" })}</small></span><span className="text-link">Review</span></Link>)}</div> : <p className="muted">Your saved attempts will be private to your account.</p>}</section>
  </>;
}
