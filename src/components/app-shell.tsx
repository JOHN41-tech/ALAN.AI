"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell, BookOpen, BriefcaseBusiness, CalendarDays, ChevronLeft, ChevronRight, ClipboardCheck,
  Compass, GraduationCap, LayoutDashboard, Library, LogOut, Map, Menu, Megaphone, MessageCircle, Settings2, Sparkles, Target, Users, X,
} from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { AppRole, StudentProfile } from "@/lib/auth/types";

const studentLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/timetable", label: "Timetable", icon: CalendarDays },
  { href: "/calendar", label: "Academic calendar", icon: CalendarDays },
  { href: "/attendance", label: "Attendance", icon: ClipboardCheck },
  { href: "/announcements", label: "Announcements", icon: Megaphone },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/profile", label: "My profile", icon: GraduationCap },
];

const careerLinks = [
  { href: "/career", label: "Career hub", icon: BriefcaseBusiness },
  { href: "/career/opportunities", label: "Opportunities", icon: Target },
  { href: "/career/discovery", label: "Career discovery", icon: Compass },
  { href: "/career/roadmaps", label: "Learning roadmaps", icon: Map },
  { href: "/career/resources", label: "Resources", icon: Library },
  { href: "/career/assessments", label: "Assessments", icon: BookOpen },
  { href: "/career/interviews", label: "Mock interviews", icon: MessageCircle },
  { href: "/career/companion", label: "AI companion", icon: Sparkles },
];

const facultyLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/faculty/classes", label: "Assigned classes", icon: BookOpen },
  { href: "/timetable", label: "Timetable", icon: CalendarDays },
  { href: "/calendar", label: "Academic calendar", icon: CalendarDays },
  { href: "/announcements", label: "Announcements", icon: Megaphone },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/profile", label: "My profile", icon: GraduationCap },
];

const adminLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/structure", label: "Academic structure", icon: Settings2 },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/timetable", label: "Timetable", icon: CalendarDays },
  { href: "/admin/events", label: "Events", icon: CalendarDays },
  { href: "/admin/announcements", label: "Announcements", icon: Megaphone },
  { href: "/admin/attendance", label: "Attendance", icon: ClipboardCheck },
  { href: "/admin/settings", label: "College settings", icon: Settings2 },
  { href: "/admin/career", label: "Career opportunities", icon: BriefcaseBusiness },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/profile", label: "My profile", icon: GraduationCap },
];

type AppShellProps = { profile: StudentProfile; children: React.ReactNode };

export function AppShell({ profile, children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const links = profile.role === "administrator" ? adminLinks : profile.role === "faculty" ? facultyLinks : studentLinks;
  const name = profile.preferred_name || profile.full_name || "Student";
  const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    if (supabase) await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="app-shell">
      {mobileOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
      <aside className={`app-sidebar ${collapsed ? "app-sidebar--collapsed" : ""} ${mobileOpen ? "app-sidebar--mobile-open" : ""}`} aria-label="Application navigation">
        <div className="sidebar-brand">
          <Link href="/dashboard" aria-label="ALAN.AI dashboard"><BrandMark compact={collapsed} /></Link>
          <button className="icon-button sidebar-collapse" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            {collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
          </button>
          <button className="icon-button sidebar-mobile-close" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X size={18} /></button>
        </div>
        <div className="nav-group-label">Academic workspace</div>
        <nav className="sidebar-nav">
          {links.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
            return (
              <Link key={href} href={href} className={`sidebar-link ${active ? "sidebar-link--active" : ""}`} aria-current={active ? "page" : undefined} onClick={() => setMobileOpen(false)} title={collapsed ? label : undefined}>
                <Icon size={18} aria-hidden="true" /> <span className="nav-link-text">{label}</span>
              </Link>
            );
          })}
        </nav>
        {profile.role === "student" && <>
          <div className="nav-group-label">Career &amp; learning</div>
          <nav className="sidebar-nav" aria-label="Career and learning">
            {careerLinks.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || (href !== "/career" && pathname.startsWith(`${href}/`));
              return <Link key={href} href={href} className={`sidebar-link ${active ? "sidebar-link--active" : ""}`} aria-current={active ? "page" : undefined} onClick={() => setMobileOpen(false)} title={collapsed ? label : undefined}><Icon size={18} aria-hidden="true" /> <span className="nav-link-text">{label}</span></Link>;
            })}
          </nav>
        </>}
        <div className="sidebar-bottom">
          <button className="sidebar-link" onClick={signOut} style={{ width: "100%", border: 0, background: "transparent", cursor: "pointer" }} title={collapsed ? "Sign out" : undefined}>
            <LogOut size={18} aria-hidden="true" /> <span className="nav-link-text">Sign out</span>
          </button>
        </div>
      </aside>

      <div className={`app-main ${collapsed ? "app-main--expanded" : ""}`}>
        <header className="app-topbar">
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <button className="icon-button mobile-menu-button" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={19} /></button>
            <span className="eyebrow" style={{ fontSize: 10 }}>ALAN.AI · Academic workspace</span>
          </div>
          <div className="topbar-actions">
            <Link className="icon-button" href="/notifications" aria-label="Open notifications"><Bell size={18} /></Link>
            <Link href="/profile" aria-label={`Open profile for ${name}`} className="avatar">{initials || "A"}</Link>
          </div>
        </header>
        <main className="main-content">{children}</main>
      </div>
    </div>
  );
}

export function RoleLabel({ role }: { role: AppRole }) {
  return <span className="badge badge--blue">{role === "administrator" ? "Administrator" : role === "faculty" ? "Faculty" : "Student"}</span>;
}
