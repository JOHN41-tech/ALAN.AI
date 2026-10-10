import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Map as MapIcon, Sparkles } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { StatusMessage } from "@/components/status-message";
import { EmptyState } from "@/components/empty-state";
import { requireAuthenticatedProfile } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateCareerRoadmap, toggleRoadmapTask } from "@/features/career/career-actions";
import type { RoadmapTask } from "@/features/career/types";

export const metadata: Metadata = { title: "Learning roadmaps" };
type Search = Promise<{ domain?: string; error?: string; created?: string }>;

export default async function RoadmapsPage({ searchParams }: { searchParams: Search }) {
  const current = await requireAuthenticatedProfile(["student"]);
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return <><PageHeading title="Learning roadmaps" /><StatusMessage error="Configure Supabase to continue." /></>;
  const roadsResult = await supabase.from("phase2_roadmaps").select("id,title,domain,summary,weekly_hours,status,ai_generated,created_at").eq("user_id", current.userId).order("created_at", { ascending: false }).limit(20);
  const roads = roadsResult.data ?? [];
  const ids = roads.map((road) => road.id);
  const taskResult = ids.length ? await supabase.from("phase2_roadmap_tasks").select("id,roadmap_id,title,phase,description,estimated_hours,done,notes,position").in("roadmap_id", ids).order("position") : { data: [], error: null };
  const taskMap = new Map<string, RoadmapTask[]>();
  for (const task of (taskResult.data ?? []) as RoadmapTask[]) taskMap.set(task.roadmap_id, [...(taskMap.get(task.roadmap_id) ?? []), task]);
  const configured = Boolean(process.env.ALAN_AI_API_KEY_1 || process.env.ALAN_AI_API_KEY_2 || process.env.ALAN_AI_API_KEY_3);
  return <>
    <PageHeading title="Learning roadmaps" description="A goal becomes easier to approach when it is broken into smaller steps. Mark progress as you go." />
    <StatusMessage error={params.error || roadsResult.error?.message || taskResult.error?.message} success={params.created ? "AI-generated roadmap saved. Review each step and adjust the pace to suit you." : undefined} />
    <div className="career-roadmap-layout"><section className="surface career-section"><div className="career-section-icon"><Sparkles size={18} /><span>AI-guided plan</span></div><h2>Start from a goal</h2><p className="muted">ALAN.AI creates an editable sequence of milestones from the goal and time you provide. Estimated hours are starting points, not promises. No resource links are invented.</p>
      {!configured && <p className="notice notice--warning">AI keys are not available to this runtime. Add them through protected project settings to generate a plan.</p>}
      <form action={generateCareerRoadmap} className="career-form"><label className="field"><span className="field-label">Goal or skill area</span><input className="input" name="domain" defaultValue={params.domain ?? ""} minLength={2} maxLength={100} required placeholder="e.g. data analysis" /></label><label className="field"><span className="field-label">What would you like to accomplish?</span><textarea className="input" name="goal" required minLength={6} maxLength={500} rows={4} placeholder="Describe a practical learning goal, what you already know, and any constraints." /></label><label className="field"><span className="field-label">Time each week</span><div className="career-inline-input"><input className="input" name="weekly_hours" type="number" min="1" max="40" defaultValue="5" required /><span>hours</span></div></label><button className="button button--primary" disabled={!configured}>Generate my roadmap <ArrowRight size={15} /></button></form>
    </section><aside className="surface career-section"><div className="eyebrow">YOUR SAVED PLANS</div><h2>{roads.length ? `${roads.length} roadmap${roads.length === 1 ? "" : "s"}` : "Nothing saved yet"}</h2><p className="muted">Roadmaps and milestone progress are private to your signed-in student account.</p>{roads.length ? <div className="career-list">{roads.map((road) => { const tasks = taskMap.get(road.id) ?? []; const done = tasks.filter((task) => task.done).length; const progress = tasks.length ? Math.round(done / tasks.length * 100) : 0; return <Link className="career-list-row career-roadmap-row" href={`/career/roadmaps/${road.id}`} key={road.id}><div><strong>{road.title}</strong><small>{road.domain} · {done}/{tasks.length} milestones · {progress}%</small><div className="career-progress"><span style={{ width: `${progress}%` }} /></div></div><ArrowRight size={16} /></Link>; })}</div> : <EmptyState icon={MapIcon} title="Create your first learning plan" description="Tell ALAN.AI what you want to learn and how much time you have." />}</aside></div>
    {roads.length > 0 && <section className="career-roadmap-cards" aria-label="Roadmap milestones">{roads.map((road) => { const tasks = taskMap.get(road.id) ?? []; return <article className="surface career-roadmap-card" key={road.id}><div className="career-roadmap-card-head"><div><span className="eyebrow">{road.domain} · {road.weekly_hours} hrs/week</span><h2><Link href={`/career/roadmaps/${road.id}`}>{road.title}</Link></h2></div><span className="badge">{road.ai_generated ? "AI-generated · review" : "Starter plan"}</span></div><p>{road.summary}</p><div className="career-progress" aria-label={`${tasks.filter((task) => task.done).length} of ${tasks.length} milestones complete`}><span style={{ width: `${tasks.length ? tasks.filter((task) => task.done).length / tasks.length * 100 : 0}%` }} /></div><div className="career-task-list">{tasks.map((task) => <form action={toggleRoadmapTask} key={task.id} className={`career-task ${task.done ? "is-done" : ""}`}><input type="hidden" name="task_id" value={task.id} /><input type="hidden" name="done" value={String(task.done)} /><input type="hidden" name="return_to" value="/career/roadmaps" /><button className="career-task-toggle" aria-label={task.done ? `Mark ${task.title} incomplete` : `Mark ${task.title} complete`}>{task.done ? "✓" : "○"}</button><span><strong>{task.title}</strong><small>{task.phase} · ~{task.estimated_hours}h</small><span className="muted">{task.description}</span></span></form>)}</div></article>; })}</section>}
  </>;
}
