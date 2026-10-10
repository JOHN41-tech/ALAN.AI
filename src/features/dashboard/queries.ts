import { createSupabaseServerClient } from "@/lib/supabase/server";
import { calculateAttendancePercent } from "@/features/attendance/calculations";
import type { AuthenticatedProfile } from "@/lib/auth/types";
import { getCollegeSettings } from "@/lib/college-settings";

type SessionRow = {
  id: string; course_id: string; section_id: string; faculty_assignment_id: string;
  substitute_faculty_id: string | null;
  classroom_id: string | null; starts_at: string; ends_at: string;
  status: "scheduled" | "conducted" | "cancelled"; cancellation_reason: string | null;
};

type CourseSummary = { id: string; code: string; title: string };
type RoomSummary = { id: string; code: string; name: string | null };
type SessionView = SessionRow & { course: CourseSummary | null; room: RoomSummary | null; facultyName: string | null };

function localDateKey(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function addCalendarDays(key: string, count: number) {
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + count));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function zonedMidnightUtc(key: string, timeZone: string) {
  const [year, month, day] = key.split("-").map(Number);
  const desiredLocalAsUtc = Date.UTC(year, month - 1, day);
  let candidate = desiredLocalAsUtc;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    }).formatToParts(new Date(candidate));
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const representedAsUtc = Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), Number(values.hour), Number(values.minute), Number(values.second));
    const difference = representedAsUtc - desiredLocalAsUtc;
    if (difference === 0) break;
    candidate = desiredLocalAsUtc - difference;
  }
  return new Date(candidate);
}

function formatDateLabel(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone }).format(date);
}

function formatTime(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone }).format(new Date(value));
}

async function enrichSessions(rows: SessionRow[], supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>) {
  const courseIds = [...new Set(rows.map((row) => row.course_id))];
  const roomIds = [...new Set(rows.flatMap((row) => row.classroom_id ? [row.classroom_id] : []))];
  const sessionIds = rows.map((row) => row.id);
  const [courseResult, roomResult, staffResult] = await Promise.all([
    courseIds.length ? supabase.from("courses").select("id, code, title").in("id", courseIds) : Promise.resolve({ data: [], error: null }),
    roomIds.length ? supabase.from("classrooms").select("id, code, name").in("id", roomIds) : Promise.resolve({ data: [], error: null }),
    sessionIds.length ? supabase.from("class_session_staff_names").select("session_id, faculty_name, substitute_faculty_name").in("session_id", sessionIds) : Promise.resolve({ data: [], error: null }),
  ]);
  const courses = new Map((courseResult.data ?? []).map((course: CourseSummary) => [course.id, course]));
  const rooms = new Map((roomResult.data ?? []).map((room: RoomSummary) => [room.id, room]));
  const staff = new Map((staffResult.data ?? []).map((item: { session_id: string; faculty_name: string; substitute_faculty_name: string | null }) => [item.session_id, item.substitute_faculty_name ?? item.faculty_name]));
  return rows.map((row) => {
    return { ...row, course: courses.get(row.course_id) ?? null, room: row.classroom_id ? rooms.get(row.classroom_id) ?? null : null, facultyName: staff.get(row.id) ?? null } as SessionView;
  });
}

export type StudentDashboardData = {
  dateLabel: string; timeZone: string; classes: SessionView[]; nextClass: SessionView | null;
  attended: number; conducted: number; attendancePercent: number | null; belowThreshold: number;
  threshold: number; unreadAnnouncements: number;
  announcements: { id: string; title: string; summary: string | null; priority: string; published_at: string | null }[];
  events: { id: string; title: string; category: string; starts_at: string; location: string | null }[];
  error: string | null;
};

export async function getStudentDashboard(current: AuthenticatedProfile): Promise<StudentDashboardData | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const settings = await getCollegeSettings(supabase);
  const timeZone = settings.timeZone;
  const todayKey = localDateKey(new Date(), timeZone);
  const from = zonedMidnightUtc(todayKey, timeZone);
  const until = zonedMidnightUtc(addCalendarDays(todayKey, 1), timeZone);
  const enrollmentResult = await supabase.from("course_enrollments").select("course_id, semester_id, section_id").eq("student_id", current.userId).eq("status", "active");
  const enrollments = enrollmentResult.data ?? [];
  const sectionIds = [...new Set(enrollments.map((row: { section_id: string }) => row.section_id))];

  const [sessionResult, summaryResult, policyResult, noticeResult, eventResult] = await Promise.all([
    sectionIds.length ? supabase.from("class_sessions").select("id, course_id, section_id, faculty_assignment_id, substitute_faculty_id, classroom_id, starts_at, ends_at, status, cancellation_reason").in("section_id", sectionIds).gte("starts_at", from.toISOString()).lt("starts_at", until.toISOString()).order("starts_at") : Promise.resolve({ data: [], error: null }),
    supabase.from("student_attendance_summary").select("course_id, attended_sessions, conducted_sessions, attendance_percent").eq("student_id", current.userId),
    supabase.from("attendance_policies").select("minimum_percent, target_percent").eq("is_active", true).maybeSingle(),
    supabase.from("announcements").select("id, title, summary, priority, published_at").eq("status", "published").order("published_at", { ascending: false }).limit(5),
    supabase.from("academic_events").select("id, title, category, starts_at, location").eq("status", "published").gte("starts_at", from.toISOString()).order("starts_at").limit(5),
  ]);
  const classRows = (sessionResult.data ?? []) as SessionRow[];
  const classes = await enrichSessions(classRows, supabase);
  const summaries = summaryResult.data ?? [];
  const attended = summaries.reduce((sum: number, row: { attended_sessions: number | null }) => sum + Number(row.attended_sessions ?? 0), 0);
  const conducted = summaries.reduce((sum: number, row: { conducted_sessions: number | null }) => sum + Number(row.conducted_sessions ?? 0), 0);
  const attendancePercent = calculateAttendancePercent({ attended, conducted });
  const threshold = Number(policyResult.data?.minimum_percent ?? 75);
  const belowThreshold = summaries.filter((row: { attendance_percent: number | null }) => row.attendance_percent !== null && Number(row.attendance_percent) < threshold).length;
  const noticeIds = (noticeResult.data ?? []).map((row: { id: string }) => row.id);
  const readResult = noticeIds.length ? await supabase.from("announcement_reads").select("announcement_id").eq("user_id", current.userId).in("announcement_id", noticeIds) : { data: [], error: null };
  const readIds = new Set((readResult.data ?? []).map((row: { announcement_id: string }) => row.announcement_id));
  const unreadAnnouncements = noticeIds.filter((id: string) => !readIds.has(id)).length;
  const now = Date.now();
  const nextClass = classes.find((session) => Date.parse(session.ends_at) > now && session.status !== "cancelled") ?? null;
  const failure = [enrollmentResult.error, sessionResult.error, summaryResult.error, policyResult.error, noticeResult.error, eventResult.error, readResult.error].find(Boolean);

  return {
    dateLabel: formatDateLabel(new Date(), timeZone), timeZone, classes, nextClass,
    attended, conducted, attendancePercent, belowThreshold, threshold, unreadAnnouncements,
    announcements: (noticeResult.data ?? []).map((notice: { id: string; title: string; summary: string | null; priority: string; published_at: string | null }) => notice),
    events: (eventResult.data ?? []).map((event: { id: string; title: string; category: string; starts_at: string; location: string | null }) => event),
    error: failure || settings.error ? "Some academic information could not be loaded. Refresh or contact your college administrator." : null,
  };
}

export async function getFacultyDashboard(current: AuthenticatedProfile) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const settings = await getCollegeSettings(supabase);
  const timeZone = settings.timeZone;
  const todayKey = localDateKey(new Date(), timeZone);
  const from = zonedMidnightUtc(todayKey, timeZone);
  const until = zonedMidnightUtc(addCalendarDays(todayKey, 1), timeZone);
  const assignmentResult = await supabase.from("faculty_assignments").select("id, course_id, section_id, semester_id").eq("faculty_id", current.userId).eq("is_active", true);
  const assignments = assignmentResult.data ?? [];
  const assignmentIds = assignments.map((item: { id: string }) => item.id);
  const [sessionResult, substituteResult] = await Promise.all([
    assignmentIds.length ? supabase.from("class_sessions").select("id, course_id, section_id, faculty_assignment_id, substitute_faculty_id, classroom_id, starts_at, ends_at, status, cancellation_reason").in("faculty_assignment_id", assignmentIds).gte("starts_at", from.toISOString()).lt("starts_at", until.toISOString()).order("starts_at") : Promise.resolve({ data: [], error: null }),
    supabase.from("class_sessions").select("id, course_id, section_id, faculty_assignment_id, substitute_faculty_id, classroom_id, starts_at, ends_at, status, cancellation_reason").eq("substitute_faculty_id", current.userId).gte("starts_at", from.toISOString()).lt("starts_at", until.toISOString()).order("starts_at"),
  ]);
  const todayMap = new Map<string, SessionRow>();
  for (const row of [...(sessionResult.data ?? []), ...(substituteResult.data ?? [])]) todayMap.set(row.id, row as SessionRow);
  const sessions = await enrichSessions([...todayMap.values()].sort((a, b) => a.starts_at.localeCompare(b.starts_at)), supabase);
  const [upcomingAssigned, upcomingSubstitute] = await Promise.all([
    assignmentIds.length ? supabase.from("class_sessions").select("id").in("faculty_assignment_id", assignmentIds).gte("starts_at", new Date().toISOString()).eq("status", "scheduled").limit(2000) : Promise.resolve({ data: [], error: null }),
    supabase.from("class_sessions").select("id").eq("substitute_faculty_id", current.userId).gte("starts_at", new Date().toISOString()).eq("status", "scheduled").limit(2000),
  ]);
  const upcomingIds = new Set([...(upcomingAssigned.data ?? []), ...(upcomingSubstitute.data ?? [])].map((row) => row.id));
  return { dateLabel: formatDateLabel(new Date(), timeZone), timeZone, assignmentCount: assignments.length, todaySessions: sessions, upcomingCount: upcomingIds.size, error: assignmentResult.error || sessionResult.error || substituteResult.error || upcomingAssigned.error || upcomingSubstitute.error || settings.error ? "Some assigned-class information could not be loaded." : null };
}

export async function getAdminDashboard() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const [students, faculty, upcoming, corrections, announcements] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "student").eq("account_status", "active"),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "faculty").eq("account_status", "active"),
    supabase.from("class_sessions").select("id", { count: "exact", head: true }).gte("starts_at", new Date().toISOString()).eq("status", "scheduled"),
    supabase.from("attendance_correction_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("announcements").select("id", { count: "exact", head: true }).eq("status", "published"),
  ]);
  return {
    students: students.count ?? 0,
    faculty: faculty.count ?? 0,
    upcomingSessions: upcoming.count ?? 0,
    pendingCorrections: corrections.count ?? 0,
    publishedAnnouncements: announcements.count ?? 0,
    error: [students.error, faculty.error, upcoming.error, corrections.error, announcements.error].some(Boolean) ? "Some administrative summary information could not be loaded." : null,
  };
}

export function formatSessionTime(value: string, timeZone = process.env.NEXT_PUBLIC_COLLEGE_TIME_ZONE || "Asia/Kolkata") {
  return formatTime(value, timeZone);
}
