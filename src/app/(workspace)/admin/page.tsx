import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CalendarDays, ClipboardCheck, Megaphone, Settings2, Users } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { StatusMessage } from "@/components/status-message";
import { requireAuthenticatedProfile } from "@/lib/auth/guards";
import { getAdminDashboard } from "@/features/dashboard/queries";

export const metadata: Metadata = { title: "Administration" };

export default async function AdministrationPage() {
  const current = await requireAuthenticatedProfile(["administrator"]);
  const data = await getAdminDashboard();
  if (!data) redirect("/login");
  const cards = [
    { href: "/admin/structure", title: "Academic structure", copy: "Departments, programs, years, semesters, sections, courses and term offerings.", icon: Settings2 },
    { href: "/admin/users", title: "People and access", copy: "Invite faculty, provision administrators and assign student placement.", icon: Users },
    { href: "/admin/timetable", title: "Timetable", copy: "Maintain recurring periods, dated sessions, changes and cancellations.", icon: CalendarDays },
    { href: "/admin/events", title: "Academic events", copy: "Publish targeted examinations, deadlines and campus activities.", icon: CalendarDays },
    { href: "/admin/announcements", title: "Official announcements", copy: "Draft, target, publish and expire college notices.", icon: Megaphone },
    { href: "/admin/attendance", title: "Attendance review", copy: "Review class summaries and authorized correction requests.", icon: ClipboardCheck },
  ];
  return <>
    <PageHeading title="Administration" description={`Welcome, ${current.profile.preferred_name || current.profile.full_name}. Manage the academic workspace and its access.`} />
    <StatusMessage error={data.error ?? undefined} />
    <div className="stat-grid"><div className="surface stat-card"><div className="stat-label">Active students</div><div className="stat-value">{data.students}</div><div className="stat-hint">Current profile records</div></div><div className="surface stat-card"><div className="stat-label">Active faculty</div><div className="stat-value">{data.faculty}</div><div className="stat-hint">Current profile records</div></div><div className="surface stat-card"><div className="stat-label">Upcoming sessions</div><div className="stat-value">{data.upcomingSessions}</div><div className="stat-hint">Scheduled from now</div></div><div className="surface stat-card"><div className="stat-label">Pending corrections</div><div className="stat-value">{data.pendingCorrections}</div><div className="stat-hint">Awaiting review</div></div></div>
    <div className="admin-home-grid" style={{ marginTop: 18 }}>{cards.map(({ href, title, copy, icon: Icon }) => <Link href={href} className="surface admin-home-card" key={href}><div className="feature-icon"><Icon size={19} /></div><h2>{title}</h2><p>{copy}</p><span>Open workspace →</span></Link>)}</div>
  </>;
}
