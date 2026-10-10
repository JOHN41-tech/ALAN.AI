import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  Bell,
  BookOpen,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Info,
  LayoutDashboard,
  Megaphone,
} from "lucide-react";
import type { ComponentType } from "react";
import { BrandMark } from "@/components/brand-mark";

export const metadata: Metadata = { title: "Sample dashboard preview" };

const sampleClasses = [
  { time: "09:00–10:00", subject: "Data Structures", detail: "CS-302 · Room B-204", state: "Next class" },
  { time: "11:15–12:15", subject: "Database Systems", detail: "CS-316 · Lab C-12", state: "Scheduled" },
  { time: "14:00–15:00", subject: "Algorithms tutorial", detail: "CS-305 · Room A-108", state: "Scheduled" },
];

function SampleStat({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: ComponentType<{ size?: number }>;
}) {
  return (
    <article className="surface stat-card">
      <div className="stat-label"><span>{label}</span><Icon size={16} aria-hidden="true" /></div>
      <div className="stat-value">{value}</div>
      <div className="stat-hint">{hint}</div>
    </article>
  );
}

export default function SampleDashboardPreview() {
  return (
    <main className="sample-dashboard" id="top">
      <div className="sample-dashboard-shell">
        <aside className="sample-dashboard-sidebar" aria-label="Sample dashboard navigation">
          <Link href="/" aria-label="ALAN.AI home"><BrandMark /></Link>
          <div className="nav-group-label">Sample workspace</div>
          <nav className="sample-dashboard-nav">
            <a href="#top" className="sample-dashboard-nav-link sample-dashboard-nav-link--active" aria-current="page"><LayoutDashboard size={17} /> Dashboard</a>
            <a href="#today" className="sample-dashboard-nav-link"><CalendarDays size={17} /> Timetable</a>
            <a href="#attendance" className="sample-dashboard-nav-link"><ClipboardCheck size={17} /> Attendance</a>
            <a href="#notices" className="sample-dashboard-nav-link"><Megaphone size={17} /> Announcements</a>
            <a href="#career" className="sample-dashboard-nav-link"><BriefcaseBusiness size={17} /> Career &amp; learning</a>
          </nav>
          <div className="sample-dashboard-side-note">
            <span className="badge badge--blue">Illustrative only</span>
            <p>These example figures are synthetic—not college records.</p>
          </div>
        </aside>

        <div className="sample-dashboard-main">
          <header className="sample-dashboard-topbar">
            <span className="eyebrow">ALAN.AI · Student workspace</span>
            <Link className="button button--secondary" href="/login">Sign in <ArrowRight size={15} /></Link>
          </header>

          <div className="sample-dashboard-content">
            <div className="sample-preview-banner" role="note">
              <Info size={18} aria-hidden="true" />
              <p><strong>Sample dashboard preview.</strong> You’re viewing a read-only illustration with fictional data; it does not sign you in or access a student account.</p>
            </div>

            <div className="page-heading sample-dashboard-heading">
              <div>
                <h1>Your college day, at a glance.</h1>
                <p>Sample student · Computer Science · Semester 5</p>
              </div>
              <span className="badge badge--blue">Preview mode</span>
            </div>

            <div className="stat-grid">
              <SampleStat label="Classes today" value="3" hint="Across 2 subjects and 1 tutorial" icon={CalendarDays} />
              <SampleStat label="Next class" value="09:00" hint="Data Structures · Room B-204" icon={BookOpen} />
              <SampleStat label="Overall attendance" value="87.5%" hint="21 of 24 counted sessions" icon={ClipboardCheck} />
              <SampleStat label="Unread notices" value="2" hint="Targeted campus updates" icon={Bell} />
            </div>

            <div className="content-grid">
              <section className="surface panel" id="today">
                <div className="panel-heading"><h2>Today’s timetable</h2><span className="badge">Sample schedule</span></div>
                {sampleClasses.map((item) => (
                  <article className="timetable-row" key={item.subject}>
                    <time className="timetable-time">{item.time}</time>
                    <div className="timetable-class">
                      <h3>{item.subject} {item.state === "Next class" && <span className="badge badge--blue">{item.state}</span>}</h3>
                      <p>{item.detail} · Faculty details shown in your college account</p>
                    </div>
                  </article>
                ))}
              </section>

              <section className="surface panel" id="attendance">
                <div className="panel-heading"><h2>Attendance overview</h2><span className="badge badge--green">Above sample target</span></div>
                <div className="sample-attendance-number">87.5%</div>
                <p className="stat-hint">21 attended / 24 conducted · illustrative threshold 75%</p>
                <div className="progress-track" role="img" aria-label="Sample attendance progress: 87.5 percent"><span style={{ width: "87.5%" }} /></div>
                <div className="sample-target-note"><CheckCircle2 size={16} /> Progress is calculated from sample counts only.</div>
              </section>
            </div>

            <div className="content-grid">
              <section className="surface panel" id="notices">
                <div className="panel-heading"><h2>Recent announcements</h2><span className="badge">2 unread</span></div>
                <div className="notice-list">
                  <article className="notice-row"><h3>Mid-semester timetable update</h3><p>Academic Office · Important · Sample notice</p></article>
                  <article className="notice-row"><h3>Department seminar registration</h3><p>Computer Science · New · Sample notice</p></article>
                  <article className="notice-row"><h3>Library hours this week</h3><p>College Library · Routine · Sample notice</p></article>
                </div>
              </section>

              <section className="surface panel" id="career">
                <div className="panel-heading"><h2>Coming up</h2><span className="badge">Sample activities</span></div>
                <div className="notice-list">
                  <article className="notice-row"><h3>Algorithms assignment</h3><p>Due Thursday · Sample deadline</p></article>
                  <article className="notice-row"><h3>Database lab review</h3><p>Next week · Sample academic event</p></article>
                </div>
              </section>
            </div>

            <section className="surface sample-career-card">
              <div className="sample-career-icon"><BriefcaseBusiness size={20} /></div>
              <div><span className="eyebrow">Career &amp; learning</span><h2>Your next chapter, alongside your college day.</h2><p>Explore roadmaps, verified opportunities, learning resources, assessments, mock interviews and the AI companion from one workspace.</p></div>
              <Link className="button button--secondary" href="/career">Open career &amp; learning <ArrowRight size={15} /></Link>
            </section>

            <footer className="sample-preview-footer">Design preview only · Synthetic sample data · No account access or database changes</footer>
          </div>
        </div>
      </div>
    </main>
  );
}
