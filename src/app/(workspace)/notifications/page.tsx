import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeading } from "@/components/page-heading";
import { StatusMessage } from "@/components/status-message";
import { markAllNotificationsRead, markNotificationRead } from "@/features/notifications/actions";
import { requireAuthenticatedProfile } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Notifications" };
type Search = Promise<{ filter?: string; error?: string; success?: string }>;
function internalHref(href: string) { return href.startsWith("/") && !href.startsWith("//") && !/[\u0000-\u001f]/.test(href) ? href : "/notifications"; }

export default async function NotificationsPage({ searchParams }: { searchParams: Search }) {
  const current = await requireAuthenticatedProfile();
  const [params, supabase] = await Promise.all([searchParams, createSupabaseServerClient()]);
  if (!supabase) redirect("/login");
  let query = supabase.from("notifications").select("id,title,body,href,read_at,created_at").eq("user_id", current.userId).order("created_at", { ascending: false }).limit(100);
  if (params.filter === "unread") query = query.is("read_at", null);
  const { data, error } = await query;
  const notifications = data ?? [];
  const unread = notifications.filter((item) => !item.read_at).length;
  return <>
    <PageHeading title="Notifications" description="Personal class changes, official notices and academic-event updates." action={unread > 0 ? <form action={markAllNotificationsRead}><button className="button button--secondary" type="submit"><CheckCheck size={15} /> Mark all read</button></form> : undefined} />
    <StatusMessage error={params.error ?? error?.message} success={params.success} />
    <div className="filter-row"><Link className={`filter-chip ${params.filter !== "unread" ? "filter-chip--active" : ""}`} href="/notifications">All</Link><Link className={`filter-chip ${params.filter === "unread" ? "filter-chip--active" : ""}`} href="/notifications?filter=unread">Unread{unread ? ` · ${unread}` : ""}</Link></div>
    {!notifications.length ? <EmptyState icon={Bell} title={params.filter === "unread" ? "All caught up" : "No notifications yet"} description={params.filter === "unread" ? "You have no unread items." : "When an announcement or class change affects you, it will appear here."} /> : <div className="notification-list">{notifications.map((notification) => <article className={`surface notification-card ${notification.read_at ? "" : "notification-card--unread"}`} key={notification.id}><div className="notification-indicator" /><div className="notification-copy"><div className="notification-heading"><strong>{notification.title}</strong><span>{new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(notification.created_at))}</span></div>{notification.body && <p>{notification.body}</p>}<Link href={internalHref(notification.href)} className="notification-open">Open related page</Link></div>{!notification.read_at && <form action={markNotificationRead}><input type="hidden" name="notification_id" value={notification.id} /><button type="submit" className="button button--secondary button--small">Mark read</button></form>}</article>)}</div>}
  </>;
}
