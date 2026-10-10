import Link from "next/link";
import {
  ArrowRight, ArrowUpRight, Bell, BookOpen, BriefcaseBusiness, CalendarDays,
  Check, ClipboardCheck, GraduationCap, Map, Megaphone, MessageCircle, ShieldCheck,
  Sparkles,
} from "lucide-react";
import { BrandMark } from "@/components/brand-mark";

const features = [
  { icon: CalendarDays, title: "A week that makes sense", description: "See classes, rooms and faculty in one clear timetable, then keep up when a session changes." },
  { icon: ClipboardCheck, title: "Attendance without guesswork", description: "Understand the sessions and counts behind each subject attendance percentage." },
  { icon: Megaphone, title: "The notices that matter", description: "Find official updates targeted to your department, semester or section." },
  { icon: Bell, title: "Campus dates in view", description: "Keep examinations, assignment deadlines and academic events close to your schedule." },
  { icon: BriefcaseBusiness, title: "Verified opportunities", description: "Explore college-published listings that have a source and are marked verified." },
  { icon: Map, title: "Roadmaps you can follow", description: "Turn a learning or career goal into editable milestones and track your own progress." },
  { icon: BookOpen, title: "Resources and check-ins", description: "Save curated learning links, practise with quizzes, and review your own results." },
  { icon: MessageCircle, title: "Practice with purpose", description: "Rehearse common interview prompts and keep private notes on what you want to improve." },
  { icon: Sparkles, title: "ALAN.AI companion", description: "Get bounded study and career-planning assistance. AI advice is not official policy or a guarantee." },
];

export default function HomePage() {
  return (
    <main>
      <header className="container public-nav">
        <Link href="/" aria-label="ALAN.AI home"><BrandMark /></Link>
        <nav className="public-nav-links" aria-label="Main navigation">
          <a className="desktop-link" href="#academics">Academic tools</a>
          <a className="desktop-link" href="#careers">Career and learning</a>
          <Link href="/login">Sign in</Link>
          <Link className="button button--primary" href="/register">Create student account <ArrowUpRight size={15} /></Link>
        </nav>
      </header>

      <section className="hero-section">
        <div className="container hero-grid">
          <div className="hero-copy">
            <span className="eyebrow"><span aria-hidden="true">●</span> One companion for your next chapter</span>
            <h1 className="display-title">Make room for the work that moves you forward.</h1>
            <p className="body-copy">Keep college life organized and career growth within reach—timetable, attendance, official updates, opportunities and learning plans in one student workspace.</p>
            <div className="hero-actions">
              <Link className="button button--primary" href="/register">Join as a student <ArrowRight size={16} /></Link>
              <Link className="button button--secondary" href="/login">Sign in to your campus</Link>
            </div>
            <div className="alan-proof-points">
              <span><Check size={14} /> Built around academic life</span>
              <span><Check size={14} /> Private, role-aware workspace</span>
            </div>
          </div>

          <div className="hero-aside" aria-label="Illustrative ALAN.AI workspace preview">
            <div className="hero-orbit" aria-hidden="true" />
            <div className="surface hero-preview">
              <div className="preview-top"><div><span className="eyebrow" style={{ fontSize: 9 }}>ALAN.AI workspace</span><div style={{ marginTop: 3, fontWeight: 700, fontSize: 17, letterSpacing: "-.03em" }}>A clearer next step</div></div><span className="badge badge--blue">Today</span></div>
              <div className="preview-row"><span className="preview-time">09:00<br />10:00</span><div className="preview-course"><strong>Know your academic day</strong><span>Classes, places and campus dates</span></div></div>
              <div className="preview-row"><span className="preview-time">Build</span><div className="preview-course" style={{ borderColor: "#b97316" }}><strong>Make progress visible</strong><span>Learning milestones at your pace</span></div></div>
              <div className="preview-row"><span className="preview-time">Explore</span><div className="preview-course" style={{ borderColor: "#3b8c6d" }}><strong>Find your next opportunity</strong><span>Source-backed listings and resources</span></div></div>
              <p style={{ margin: "12px 0 0", color: "var(--muted)", fontSize: 10 }}>Illustration only · personal data appears after you sign in</p>
            </div>
            <div className="surface hero-note"><span className="badge badge--green"><ShieldCheck size={12} /> Role-aware by design</span></div>
          </div>
        </div>
      </section>

      <section className="section-pad" id="academics" style={{ background: "white" }}>
        <div className="container">
          <div className="section-head"><span className="eyebrow">Academic life, connected</span><h2 className="section-title" style={{ marginTop: 12 }}>The details of college, easier to manage.</h2><p className="body-copy" style={{ margin: "12px 0 0", fontSize: 15 }}>A clearer view of the practical things that shape your day—without another place to lose track of them.</p></div>
          <div className="feature-grid">{features.slice(0, 4).map(({ icon: Icon, title, description }) => <article className="surface feature-card" key={title}><div className="feature-icon"><Icon size={19} /></div><h3>{title}</h3><p>{description}</p></article>)}</div>
        </div>
      </section>

      <section className="section-pad alan-career-band" id="careers">
        <div className="container"><div className="section-head"><span className="eyebrow">A companion beyond the timetable</span><h2 className="section-title" style={{ marginTop: 12 }}>Explore what you could learn and where it could take you.</h2><p className="body-copy" style={{ margin: "12px 0 0", fontSize: 15 }}>Move from a career question to a learning plan, practice activity, or sourced opportunity—one manageable step at a time.</p></div>
          <div className="feature-grid">{features.slice(4).map(({ icon: Icon, title, description }) => <article className="surface feature-card" key={title}><div className="feature-icon"><Icon size={19} /></div><h3>{title}</h3><p>{description}</p></article>)}</div>
          <div className="phase-note alan-responsibility-note"><div><span className="eyebrow" style={{ color: "#6474ad", fontSize: 10 }}>Designed to support, not overpromise</span><strong style={{ display: "block", marginTop: 3 }}>You stay in control of your progress and personal context.</strong><p>Opportunity listings are shown only after administrator verification; ALAN.AI’s suggestions are learning aids, not official college guidance or guaranteed outcomes.</p></div><GraduationCap size={28} color="var(--cobalt)" aria-hidden="true" /></div>
        </div>
      </section>

      <section className="roles-band" id="roles"><div className="container"><div className="section-head" style={{ marginBottom: 22 }}><span className="eyebrow">One campus, clear permissions</span><h2 className="section-title" style={{ marginTop: 10 }}>Useful to every part of college life.</h2></div><div className="role-grid"><article className="role-card"><h3>For students</h3><p>Keep your own timetable, attendance, notices and academic dates close at hand, then explore learning and career paths.</p></article><article className="role-card"><h3>For faculty</h3><p>See assigned classes, the relevant roster and attendance tasks you’re authorized to manage.</p></article><article className="role-card"><h3>For administrators</h3><p>Manage academic operations and curate source-backed opportunities with clear publication controls.</p></article></div></div></section>

      <footer className="site-footer"><div className="container footer-inner"><Link href="/" aria-label="ALAN.AI home"><BrandMark /></Link><span>For account access or campus setup, contact your college administrator.</span><div style={{ display: "flex", gap: 18 }}><Link href="/login">Sign in</Link><Link href="/register">Register</Link></div></div></footer>
    </main>
  );
}
