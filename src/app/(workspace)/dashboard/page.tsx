import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertCircle, ArrowRight, Bell, BookOpen, CalendarDays, ClipboardCheck, Megaphone, Users } from "lucide-react";
import { AppRole } from "@/lib/auth/types";
import { PageHeading } from "@/components/page-heading";
import { EmptyState } from "@/components/empty-state";
import { getAdminDashboard, getFacultyDashboard, getStudentDashboard, formatSessionTime } from "@/features/dashboard/queries";
import { getAuthenticatedProfile } from "@/lib/auth/guards";
import { estimateClassesToTarget } from "@/features/attendance/calculations";

function StatCard({ label, value, hint, icon: Icon }: { label: string; value: string | number; hint?: string; icon: React.ComponentType<{ size?: number }> }) {
  return <article className="surface stat-card"><div className="stat-label"><span>{label}</span><Icon size={16} /></div><div className="stat-value">{value}</div>{hint && <div className="stat-hint">{hint}</div>}</article>;
}

function DashboardError({ message }: { message: string }) {
  return <div className="notice notice--error" role="status"><AlertCircle size={17} />{message}</div>;
}

function QuickActions({ role }: { role: AppRole }) {
  const actions = role === "administrator"
    ? [["Academic structure", "/admin/structure"], ["Timetable", "/admin/timetable"], ["Manage notices", "/admin/announcements"]]
    : role === "faculty"
      ? [["Assigned classes", "/faculty/classes"], ["Timetable", "/timetable"], ["Announcements", "/announcements"]]
      : [["View timetable", "/timetable"], ["View attendance", "/attendance"], ["Read announcements", "/announcements"], ["Academic calendar", "/calendar"], ["Edit profile", "/profile"]];
  return <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>{actions.map(([label, href]) => <Link className="button button--secondary" href={href} key={href}>{label}<ArrowRight size={14} /></Link>)}</div>;
}

export default async function DashboardPage() {
  const current = await getAuthenticatedProfile();
  if (!current) redirect("/login");
  if (current.profile.account_status !== "active") redirect("/login?status=inactive");
  const role = current.profile.role;
  const name = current.profile.preferred_name || current.profile.full_name.split(" ")[0] || "there";
  const dateLabel = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(new Date());

  if (role === "administrator") {
    const data = await getAdminDashboard();
    return <>
      <PageHeading title="Administration" description={`Good day, ${name}. Here’s the current academic operations overview.`} />
      {data?.error && <DashboardError message={data.error} />}
      <div className="stat-grid">
        <StatCard label="Active students" value={data?.students ?? "—"} hint="From current profiles" icon={Users} />
        <StatCard label="Active faculty" value={data?.faculty ?? "—"} hint="From current profiles" icon={BookOpen} />
        <StatCard label="Upcoming sessions" value={data?.upcomingSessions ?? "—"} hint="Scheduled from today" icon={CalendarDays} />
        <StatCard label="Pending corrections" value={data?.pendingCorrections ?? "—"} hint="Needs administrator review" icon={ClipboardCheck} />
      </div>
      <section className="surface panel" style={{ marginTop: 17 }}><div className="panel-heading"><h2>Academic management</h2><Link href="/admin/structure">Open administration <ArrowRight size={14} /></Link></div><QuickActions role={role} /></section>
      <div className="content-grid"><section className="surface panel"><div className="panel-heading"><h2>Publishing overview</h2><Link href="/admin/announcements">Manage announcements</Link></div><p style={{ color: "var(--muted)", fontSize: 13 }}>Published announcements in the current data: <strong>{data?.publishedAnnouncements ?? "—"}</strong>.</p></section><section className="surface panel"><EmptyState icon={CalendarDays} title="Keep the academic structure current" description="Add departments, programs, courses and sections before publishing schedules." action={<Link className="button button--secondary" href="/admin/structure">Manage structure</Link>} /></section></div>
    </>;
  }

  if (role === "faculty") {
    const data = await getFacultyDashboard(current);
    return <>
      <PageHeading title={`Good day, ${name}.`} description={data?.dateLabel ?? dateLabel} />
      {data?.error && <DashboardError message={data.error} />}
      <div className="stat-grid"><StatCard label="Assigned classes" value={data?.assignmentCount ?? "—"} hint="Current active assignments" icon={BookOpen} /><StatCard label="Classes today" value={data?.todaySessions.length ?? "—"} hint="In your assigned schedule" icon={CalendarDays} /><StatCard label="Upcoming sessions" value={data?.upcomingCount ?? "—"} hint="Scheduled from now" icon={ClipboardCheck} /><StatCard label="Role" value="Faculty" hint="Assigned-class access" icon={Users} /></div>
      <div className="content-grid"><section className="surface panel"><div className="panel-heading"><h2>Today’s assigned classes</h2><Link href="/faculty/classes">View classes <ArrowRight size={14} /></Link></div>{!data?.todaySessions.length ? <EmptyState icon={CalendarDays} title="No assigned classes today" description="When the administrator assigns classes, they will appear here." /> : data.todaySessions.map((session) => <div className="timetable-row" key={session.id}><span className="timetable-time">{formatSessionTime(session.starts_at, data.timeZone)}<br />{formatSessionTime(session.ends_at, data.timeZone)}</span><div className="timetable-class"><h3>{session.course?.title ?? "Course"}</h3><p>{session.course?.code ?? "—"} · {session.room?.code ?? "Room not set"} · {session.status}</p><Link href={`/faculty/attendance/${session.id}`} style={{ display: "inline-flex", marginTop: 7, color: "var(--cobalt)", fontSize: 12, fontWeight: 650 }}>Open attendance <ArrowRight size={13} /></Link></div></div>)}</section><section className="surface panel"><div className="panel-heading"><h2>Faculty shortcuts</h2></div><QuickActions role={role} /><div style={{ marginTop: 20 }}><EmptyState icon={Megaphone} title="Official updates" description="See announcements targeted to your campus groups." action={<Link className="button button--secondary" href="/announcements">View announcements</Link>} /></div></section></div>
    </>;
  }

  const data = await getStudentDashboard(current);
  const estimate = data?.attendancePercent !== null && data?.attendancePercent !== undefined && data.conducted > 0
    ? estimateClassesToTarget({ attended: data.attended, conducted: data.conducted }, data.threshold)
    : null;
  return <>
    <PageHeading title={`Good day, ${name}.`} description={data?.dateLabel ?? dateLabel} />
    {data?.error && <DashboardError message={data.error} />}
    <div className="stat-grid">
      <StatCard label="Classes today" value={data?.classes.length ?? "—"} hint="Including scheduled changes" icon={CalendarDays} />
      <StatCard label="Next class" value={data?.nextClass ? formatSessionTime(data.nextClass.starts_at, data.timeZone) : "—"} hint={data?.nextClass?.course?.title ?? "No upcoming class found"} icon={BookOpen} />
      <StatCard label="Overall attendance" value={data?.attendancePercent === null ? "—" : data?.attendancePercent === undefined ? "—" : `${data.attendancePercent}%`} hint={data?.conducted ? `${data.attended} of ${data.conducted} counted sessions` : "No conducted sessions yet"} icon={ClipboardCheck} />
      <StatCard label="Unread announcements" value={data?.unreadAnnouncements ?? "—"} hint="Targeted to your academic group" icon={Bell} />
    </div>
    {estimate !== null && estimate > 0 && <div className="notice notice--info" style={{ marginTop: 14 }}><ClipboardCheck size={17} /><span><strong>Estimate, not a guarantee:</strong> if every next class is attended, about {estimate} additional class{estimate === 1 ? "" : "es"} would reach the configured {data?.threshold}% target.</span></div>}
    <div className="content-grid">
      <section className="surface panel"><div className="panel-heading"><h2>Today’s timetable</h2><Link href="/timetable">Full timetable <ArrowRight size={14} /></Link></div>{!data?.classes.length ? <EmptyState icon={CalendarDays} title="Your schedule will appear here" description="Your college has not published a class session for today, or your profile needs a section assignment." action={<Link className="button button--secondary" href="/profile">Review profile</Link>} /> : data.classes.map((session) => <div className="timetable-row" key={session.id}><span className="timetable-time">{formatSessionTime(session.starts_at, data.timeZone)}<br />{formatSessionTime(session.ends_at, data.timeZone)}</span><div className="timetable-class" style={session.status === "cancelled" ? { borderColor: "var(--rose)" } : undefined}><h3>{session.course?.title ?? "Course"} {session.status === "cancelled" && <span className="badge badge--red">Cancelled</span>}</h3><p>{session.course?.code ?? "—"} · {session.room?.code ?? "Room not set"} · {session.facultyName ?? "Faculty details unavailable"}</p>{session.cancellation_reason && <p>{session.cancellation_reason}</p>}</div></div>)}</section>
      <section className="surface panel"><div className="panel-heading"><h2>Attendance overview</h2><Link href="/attendance">Details <ArrowRight size={14} /></Link></div><div style={{ display: "flex", alignItems: "baseline", gap: 8 }}><strong style={{ fontSize: 31, letterSpacing: "-.05em" }}>{data?.attendancePercent === null ? "—" : data?.attendancePercent === undefined ? "—" : `${data.attendancePercent}%`}</strong><span className="stat-hint">of counted sessions</span></div><p className="stat-hint" style={{ margin: "2px 0 14px" }}>{data?.attended ?? 0} attended / {data?.conducted ?? 0} conducted · threshold {data?.threshold ?? 75}%</p>{data?.belowThreshold ? <div className="notice notice--error"><AlertCircle size={15} />{data.belowThreshold} subject{data.belowThreshold === 1 ? " is" : "s are"} below the configured threshold.</div> : <div className="notice notice--info">A subject-wise breakdown is available in your attendance record.</div>}</section>
    </div>
    <div className="content-grid">
      <section className="surface panel"><div className="panel-heading"><h2>Recent announcements</h2><Link href="/announcements">All notices <ArrowRight size={14} /></Link></div>{!data?.announcements.length ? <EmptyState icon={Megaphone} title="No announcements to show" description="Official notices targeted to your academic group will appear here." /> : <div className="notice-list">{data.announcements.map((notice) => <article className="notice-row" key={notice.id}><div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}><h3>{notice.title}</h3><span className={`badge ${notice.priority === "urgent" ? "badge--red" : notice.priority === "important" ? "badge--amber" : ""}`}>{notice.priority}</span></div><p>{notice.summary ?? "Open the notice for details."}</p></article>)}</div>}</section>
      <section className="surface panel"><div className="panel-heading"><h2>Upcoming activities</h2><Link href="/calendar">Calendar <ArrowRight size={14} /></Link></div>{!data?.events.length ? <EmptyState icon={CalendarDays} title="No upcoming academic activities" description="Published exams, deadlines and campus events will appear here." /> : <div className="notice-list">{data.events.map((event) => <article className="notice-row" key={event.id}><h3>{event.title}</h3><p>{new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: data.timeZone }).format(new Date(event.starts_at))}{event.location ? ` · ${event.location}` : ""}</p></article>)}</div>}</section>
    </div>
    <section className="surface panel" style={{ marginTop: 16 }}><div className="panel-heading"><h2>Quick actions</h2></div><QuickActions role={role} /></section>
  </>;
}
