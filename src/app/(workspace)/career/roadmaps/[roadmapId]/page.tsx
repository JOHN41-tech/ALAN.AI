import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, CheckCircle2, Circle, Sparkles } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { StatusMessage } from "@/components/status-message";
import { requireAuthenticatedProfile } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toggleRoadmapTask } from "@/features/career/career-actions";
import type { RoadmapTask } from "@/features/career/types";

type Params = Promise<{ roadmapId: string }>;
type Search = Promise<{ error?: string; created?: string }>;
export const metadata: Metadata = { title: "Roadmap details" };

export default async function RoadmapDetailPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const current = await requireAuthenticatedProfile(["student"]);
  const [{ roadmapId }, query] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/i.test(roadmapId)) notFound();
  const supabase = await createSupabaseServerClient();
  if (!supabase) notFound();
  const { data: road, error } = await supabase.from("phase2_roadmaps").select("id,title,domain,summary,weekly_hours,status,ai_generated,created_at").eq("id", roadmapId).eq("user_id", current.userId).maybeSingle();
  if (error || !road) notFound();
  const { data: tasks, error: taskError } = await supabase.from("phase2_roadmap_tasks").select("id,roadmap_id,title,phase,description,estimated_hours,done,notes,position").eq("roadmap_id", roadmapId).order("position");
  const rows = (tasks ?? []) as RoadmapTask[];
  const complete = rows.filter((task) => task.done).length;
  const percent = rows.length ? Math.round(complete / rows.length * 100) : 0;
  return <>
    <Link className="text-link career-backlink" href="/career/roadmaps"><ArrowLeft size={15} /> All roadmaps</Link>
    <PageHeading title={road.title} description={`${road.domain} · ${road.weekly_hours} hours/week · ${complete} of ${rows.length} milestones complete`} />
    <StatusMessage error={query.error || taskError?.message} success={query.created ? "Roadmap created. Review the steps and adjust your pace as needed." : undefined} />
    <section className="surface career-section career-roadmap-detail"><div className="career-roadmap-detail-head"><div><span className="badge">{road.ai_generated ? <><Sparkles size={13} /> AI-generated · review</> : "Starter plan"}</span><h2>Your plan</h2></div><strong>{percent}% complete</strong></div><p>{road.summary}</p><div className="career-progress career-progress--large"><span style={{ width: `${percent}%` }} /></div><div className="career-milestones">{rows.map((task) => { const Icon = task.done ? CheckCircle2 : Circle; return <article className={`career-milestone ${task.done ? "is-done" : ""}`} key={task.id}><Icon size={19} /><div className="grow"><span className="eyebrow">{task.phase} · estimated {task.estimated_hours}h</span><h3>{task.title}</h3><p>{task.description}</p></div><form action={toggleRoadmapTask}><input type="hidden" name="task_id" value={task.id} /><input type="hidden" name="done" value={String(task.done)} /><input type="hidden" name="return_to" value={`/career/roadmaps/${road.id}`} /><button className="button button--secondary">{task.done ? "Mark incomplete" : "Mark complete"}</button></form></article>; })}</div><p className="muted-small">Milestone time estimates are flexible guidance. They do not guarantee a qualification, job or outcome.</p></section>
  </>;
}
