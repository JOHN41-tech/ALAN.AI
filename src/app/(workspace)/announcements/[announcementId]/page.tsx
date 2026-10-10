import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CheckCheck } from "lucide-react";
import { StatusMessage } from "@/components/status-message";
import { markAnnouncementRead } from "@/features/announcements/actions";
import { requireAuthenticatedProfile } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Announcement" };
type Props = { params: Promise<{ announcementId: string }>; searchParams: Promise<{ success?: string; error?: string }> };

export default async function AnnouncementDetailPage({ params, searchParams }: Props) {
  const current = await requireAuthenticatedProfile();
  const [{ announcementId }, query, supabase] = await Promise.all([params, searchParams, createSupabaseServerClient()]);
  if (!supabase) redirect("/login");
  const { data: notice, error } = await supabase.from("announcements").select("id,title,summary,body,category,priority,published_at,expires_at").eq("id", announcementId).maybeSingle();
  if (error || !notice) notFound();
  const { data: readRow } = await supabase.from("announcement_reads").select("read_at").eq("announcement_id", announcementId).eq("user_id", current.userId).maybeSingle();
  const { data: targets } = await supabase.from("announcement_targets").select("target_type,target_id").eq("announcement_id", announcementId);
  const targetLabels = (targets ?? []).map((target) => target.target_type === "college" ? "College-wide" : target.target_type).filter((value, index, array) => array.indexOf(value) === index);
  return <>
    <Link className="back-link" href="/announcements"><ArrowLeft size={15} /> Back to announcements</Link>
    <StatusMessage error={query.error} success={query.success} />
    <article className="surface announcement-detail">
      <div className="notice-topline"><span className={`badge ${notice.priority === "urgent" ? "badge--red" : notice.priority === "important" ? "badge--amber" : "badge--blue"}`}>{notice.priority}</span><span className="badge">{notice.category}</span><span className="muted-small">{notice.published_at ? new Intl.DateTimeFormat("en-US", { dateStyle: "full" }).format(new Date(notice.published_at)) : "Draft"}</span></div>
      <h1>{notice.title}</h1>{notice.summary && <p className="announcement-summary">{notice.summary}</p>}
      <div className="announcement-body">{notice.body}</div>
      <div className="announcement-detail-footer"><span className="muted-small">Audience: {targetLabels.length ? targetLabels.join(", ") : "Authorized groups"}{notice.expires_at ? ` · Expires ${new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(notice.expires_at))}` : ""}</span>
        {!readRow && <form action={markAnnouncementRead}><input type="hidden" name="announcement_id" value={announcementId} /><button className="button button--secondary" type="submit"><CheckCheck size={15} /> Mark as read</button></form>}
      </div>
    </article>
  </>;
}
