-- College Companion Phase 1. Apply only to the intended Supabase project.
create extension if not exists pgcrypto;

create type public.app_role as enum ('student', 'faculty', 'administrator');
create type public.account_status as enum ('active', 'suspended', 'invited');
create type public.session_status as enum ('scheduled', 'conducted', 'cancelled');
create type public.attendance_status as enum ('present', 'absent', 'excused');
create type public.announcement_status as enum ('draft', 'published', 'archived');
create type public.notice_priority as enum ('normal', 'important', 'urgent');
create type public.target_kind as enum ('college', 'department', 'semester', 'section');
create type public.event_kind as enum ('internal_exam', 'semester_exam', 'assignment', 'project_review', 'laboratory', 'seminar', 'holiday', 'department_event', 'other');
create type public.correction_status as enum ('pending', 'approved', 'rejected');

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (length(trim(code)) between 2 and 24),
  name text not null unique check (length(trim(name)) between 2 and 120),
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.programs (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete restrict,
  code text not null,
  name text not null,
  degree_level text not null default 'undergraduate',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (department_id, code),
  unique (department_id, name)
);

create table public.academic_years (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  starts_on date not null,
  ends_on date not null,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on > starts_on)
);
create unique index academic_years_one_current on public.academic_years (is_current) where is_current;

create table public.semesters (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references public.academic_years(id) on delete restrict,
  program_id uuid references public.programs(id) on delete restrict,
  number smallint not null check (number between 1 and 16),
  name text not null,
  starts_on date not null,
  ends_on date not null,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on > starts_on),
  unique (academic_year_id, program_id, number)
);
create index semesters_current_idx on public.semesters (is_current, starts_on, ends_on);

create table public.sections (
  id uuid primary key default gen_random_uuid(),
  semester_id uuid not null references public.semesters(id) on delete restrict,
  program_id uuid not null references public.programs(id) on delete restrict,
  name text not null check (length(trim(name)) between 1 and 40),
  capacity integer check (capacity is null or capacity > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (semester_id, program_id, name)
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete restrict,
  program_id uuid references public.programs(id) on delete restrict,
  code text not null check (length(trim(code)) between 2 and 32),
  title text not null check (length(trim(title)) between 2 and 160),
  credits numeric(3,1) check (credits is null or credits between 0 and 30),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (department_id, code)
);
create index courses_program_idx on public.courses (program_id, is_active);

create table public.classrooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (length(trim(code)) between 1 and 48),
  name text,
  capacity integer check (capacity is null or capacity > 0),
  location text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'student',
  full_name text not null check (length(trim(full_name)) between 2 and 120),
  preferred_name text check (preferred_name is null or length(trim(preferred_name)) <= 80),
  college_email text,
  profile_image_path text,
  department_id uuid references public.departments(id) on delete set null,
  program_id uuid references public.programs(id) on delete set null,
  academic_year_id uuid references public.academic_years(id) on delete set null,
  semester_id uuid references public.semesters(id) on delete set null,
  section_id uuid references public.sections(id) on delete set null,
  student_identifier text,
  account_status public.account_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (student_identifier is null or length(trim(student_identifier)) between 1 and 48)
);
create unique index profiles_college_email_lower_uidx on public.profiles (lower(college_email)) where college_email is not null;
create unique index profiles_student_identifier_uidx on public.profiles (student_identifier) where student_identifier is not null;
create index profiles_academic_group_idx on public.profiles (department_id, semester_id, section_id, account_status);

create table public.course_enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete restrict,
  semester_id uuid not null references public.semesters(id) on delete restrict,
  section_id uuid not null references public.sections(id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'withdrawn', 'completed')),
  enrolled_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (student_id, course_id, semester_id)
);
create index course_enrollments_student_idx on public.course_enrollments (student_id, semester_id, status);
create index course_enrollments_course_idx on public.course_enrollments (course_id, section_id, semester_id, status);

create table public.faculty_assignments (
  id uuid primary key default gen_random_uuid(),
  faculty_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete restrict,
  semester_id uuid not null references public.semesters(id) on delete restrict,
  section_id uuid not null references public.sections(id) on delete restrict,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (faculty_id, course_id, semester_id, section_id)
);
create index faculty_assignments_faculty_idx on public.faculty_assignments (faculty_id, semester_id, is_active);

-- Recurring definitions are distinct from dated class_sessions.
create table public.timetable_entries (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete restrict,
  semester_id uuid not null references public.semesters(id) on delete restrict,
  section_id uuid not null references public.sections(id) on delete restrict,
  faculty_assignment_id uuid not null references public.faculty_assignments(id) on delete restrict,
  classroom_id uuid references public.classrooms(id) on delete set null,
  weekday smallint not null check (weekday between 0 and 6),
  starts_at_local time not null,
  ends_at_local time not null,
  valid_from date not null,
  valid_until date,
  time_zone text not null default 'Asia/Kolkata',
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at_local > starts_at_local),
  check (valid_until is null or valid_until >= valid_from)
);
create index timetable_entries_section_day_idx on public.timetable_entries (section_id, weekday, starts_at_local) where is_active;
create index timetable_entries_faculty_idx on public.timetable_entries (faculty_assignment_id, weekday) where is_active;
create index timetable_entries_room_idx on public.timetable_entries (classroom_id, weekday, starts_at_local) where is_active;

create table public.class_sessions (
  id uuid primary key default gen_random_uuid(),
  timetable_entry_id uuid references public.timetable_entries(id) on delete set null,
  course_id uuid not null references public.courses(id) on delete restrict,
  semester_id uuid not null references public.semesters(id) on delete restrict,
  section_id uuid not null references public.sections(id) on delete restrict,
  faculty_assignment_id uuid not null references public.faculty_assignments(id) on delete restrict,
  classroom_id uuid references public.classrooms(id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.session_status not null default 'scheduled',
  cancellation_reason text,
  substitute_faculty_id uuid references public.profiles(id) on delete set null,
  change_note text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (status <> 'cancelled' or nullif(trim(cancellation_reason), '') is not null)
);
create unique index class_sessions_recurring_occurrence_uidx on public.class_sessions (timetable_entry_id, starts_at) where timetable_entry_id is not null;
create index class_sessions_section_time_idx on public.class_sessions (section_id, starts_at, status);
create index class_sessions_faculty_time_idx on public.class_sessions (faculty_assignment_id, starts_at, status);
create index class_sessions_course_time_idx on public.class_sessions (course_id, starts_at, status);

create table public.attendance_policies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  minimum_percent numeric(5,2) not null default 75 check (minimum_percent between 0 and 100),
  target_percent numeric(5,2) not null default 75 check (target_percent between 0 and 100),
  excused_counts_as_conducted boolean not null default false,
  excused_counts_as_attended boolean not null default false,
  is_active boolean not null default true,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index attendance_policies_one_active_uidx on public.attendance_policies (is_active) where is_active;
insert into public.attendance_policies (name) values ('Default college policy');

create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.class_sessions(id) on delete restrict,
  student_id uuid not null references public.profiles(id) on delete cascade,
  status public.attendance_status not null,
  note text,
  recorded_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, student_id)
);
create index attendance_records_student_created_idx on public.attendance_records (student_id, created_at desc);
create index attendance_records_session_idx on public.attendance_records (session_id, status);

create table public.attendance_correction_requests (
  id uuid primary key default gen_random_uuid(),
  attendance_record_id uuid not null references public.attendance_records(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete restrict,
  requested_status public.attendance_status not null,
  reason text not null check (length(trim(reason)) between 8 and 1000),
  status public.correction_status not null default 'pending',
  reviewed_by uuid references public.profiles(id) on delete set null,
  review_note text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check ((status = 'pending' and reviewed_at is null) or (status <> 'pending' and reviewed_at is not null))
);
create index attendance_corrections_status_idx on public.attendance_correction_requests (status, created_at);

create table public.attendance_audit_logs (
  id uuid primary key default gen_random_uuid(),
  attendance_record_id uuid not null references public.attendance_records(id) on delete restrict,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  previous_status public.attendance_status not null,
  new_status public.attendance_status not null,
  reason text not null,
  correction_request_id uuid references public.attendance_correction_requests(id) on delete set null,
  created_at timestamptz not null default now()
);
create index attendance_audit_record_idx on public.attendance_audit_logs (attendance_record_id, created_at desc);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 3 and 180),
  summary text check (summary is null or length(summary) <= 360),
  body text not null check (length(trim(body)) between 1 and 20000),
  category text not null default 'general' check (length(trim(category)) between 1 and 48),
  priority public.notice_priority not null default 'normal',
  status public.announcement_status not null default 'draft',
  author_id uuid not null references public.profiles(id) on delete restrict,
  scheduled_for timestamptz,
  published_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at is null or published_at is null or expires_at > published_at),
  check (status <> 'published' or published_at is not null)
);
create index announcements_publication_idx on public.announcements (status, published_at desc, expires_at);
create index announcements_priority_idx on public.announcements (priority, published_at desc) where status = 'published';

create table public.announcement_targets (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  target_type public.target_kind not null,
  target_id uuid,
  created_at timestamptz not null default now(),
  check ((target_type = 'college' and target_id is null) or (target_type <> 'college' and target_id is not null)),
  unique (announcement_id, target_type, target_id)
);
create index announcement_targets_lookup_idx on public.announcement_targets (target_type, target_id, announcement_id);

create table public.announcement_reads (
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (announcement_id, user_id)
);
create index announcement_reads_user_idx on public.announcement_reads (user_id, read_at desc);

create table public.announcement_attachments (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null check (length(trim(file_name)) between 1 and 255),
  content_type text not null,
  byte_size bigint not null check (byte_size between 1 and 10485760),
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index announcement_attachments_parent_idx on public.announcement_attachments (announcement_id);

create table public.academic_events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 3 and 180),
  description text check (description is null or length(description) <= 10000),
  category public.event_kind not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  time_zone text not null default 'Asia/Kolkata',
  location text,
  status public.announcement_status not null default 'draft',
  author_id uuid not null references public.profiles(id) on delete restrict,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (status <> 'published' or published_at is not null)
);
create index academic_events_time_idx on public.academic_events (status, starts_at, ends_at);
create index academic_events_category_idx on public.academic_events (category, starts_at);

create table public.academic_event_targets (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.academic_events(id) on delete cascade,
  target_type public.target_kind not null,
  target_id uuid,
  created_at timestamptz not null default now(),
  check ((target_type = 'college' and target_id is null) or (target_type <> 'college' and target_id is not null)),
  unique (event_id, target_type, target_id)
);
create index academic_event_targets_lookup_idx on public.academic_event_targets (target_type, target_id, event_id);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  dedupe_key text not null,
  title text not null check (length(trim(title)) between 1 and 180),
  body text,
  href text not null check (href like '/%'),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);
create index notifications_user_unread_idx on public.notifications (user_id, created_at desc) where read_at is null;

create table public.attendance_settings (
  id boolean primary key default true check (id),
  college_name text not null default 'College Companion',
  time_zone text not null default 'Asia/Kolkata',
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.attendance_settings (id) values (true) on conflict (id) do nothing;

create table public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles(id) on delete restrict,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index admin_audit_created_idx on public.admin_audit_logs (created_at desc);

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['departments','programs','academic_years','semesters','sections','courses','classrooms','profiles','faculty_assignments','timetable_entries','class_sessions','attendance_policies','attendance_records','announcements','academic_events'] loop
    execute format('create trigger %I_touch_updated_at before update on public.%I for each row execute function public.touch_updated_at()', t, t);
  end loop;
end $$;

-- Every new Auth user is a student. Role metadata from the public sign-up form is ignored.
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public, auth as $$
begin
  insert into public.profiles (id, role, full_name, college_email)
  values (
    new.id,
    'student',
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'New student'),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_auth_user();

create or replace function public.current_app_role()
returns public.app_role language sql stable security definer set search_path = public as $$
  select p.role from public.profiles p where p.id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.current_app_role() = 'administrator', false)
$$;

create or replace function public.profile_matches_target(p_kind public.target_kind, p_target uuid, p_profile uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case p_kind
    when 'college' then exists(select 1 from public.profiles p where p.id = p_profile and p.account_status = 'active')
    when 'department' then exists(select 1 from public.profiles p where p.id = p_profile and p.department_id = p_target and p.account_status = 'active')
    when 'semester' then exists(select 1 from public.profiles p where p.id = p_profile and p.semester_id = p_target and p.account_status = 'active')
    when 'section' then exists(select 1 from public.profiles p where p.id = p_profile and p.section_id = p_target and p.account_status = 'active')
  end
$$;

create or replace function public.can_read_announcement(p_announcement uuid, p_profile uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.announcements a
    where a.id = p_announcement
      and a.status = 'published'
      and a.published_at <= now()
      and (a.expires_at is null or a.expires_at > now())
      and exists (
        select 1 from public.announcement_targets t
        where t.announcement_id = a.id
          and public.profile_matches_target(t.target_type, t.target_id, p_profile)
      )
  )
$$;

create or replace function public.can_read_event(p_event uuid, p_profile uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.academic_events e
    where e.id = p_event and e.status = 'published' and e.published_at <= now()
      and exists (
        select 1 from public.academic_event_targets t
        where t.event_id = e.id and public.profile_matches_target(t.target_type, t.target_id, p_profile)
      )
  )
$$;

create or replace function public.faculty_assigned_to_session(p_session uuid, p_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.class_sessions s
    join public.faculty_assignments f on f.id = s.faculty_assignment_id
    where s.id = p_session and f.faculty_id = p_user and f.is_active
  )
$$;

create or replace function public.faculty_can_access_student(p_student uuid, p_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.course_enrollments e
    join public.faculty_assignments f
      on f.course_id = e.course_id and f.semester_id = e.semester_id and f.section_id = e.section_id and f.is_active
    where e.student_id = p_student and e.status = 'active' and f.faculty_id = p_user
  )
$$;

create or replace function public.is_enrolled_in_session(p_student uuid, p_session uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.class_sessions s
    join public.course_enrollments e on e.course_id = s.course_id and e.semester_id = s.semester_id and e.section_id = s.section_id
    where s.id = p_session and e.student_id = p_student and e.status = 'active'
  )
$$;

create or replace function public.handle_new_announcement_notifications()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'published' and new.published_at <= now() and (tg_op = 'INSERT' or old.status <> 'published' or old.published_at is distinct from new.published_at) then
    insert into public.notifications (user_id, dedupe_key, title, body, href)
    select p.id, 'announcement:' || new.id::text || ':' || p.id::text,
      case when new.priority = 'urgent' then 'Urgent announcement' else 'New announcement' end,
      new.title, '/announcements/' || new.id::text
    from public.profiles p
    where p.account_status = 'active'
      and exists (
        select 1 from public.announcement_targets t
        where t.announcement_id = new.id and public.profile_matches_target(t.target_type, t.target_id, p.id)
      )
    on conflict (user_id, dedupe_key) do nothing;
  end if;
  return new;
end;
$$;
create trigger announcements_notify after insert or update of status, published_at on public.announcements for each row execute function public.handle_new_announcement_notifications();

create or replace function public.handle_new_event_notifications()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'published' and new.published_at <= now() and (tg_op = 'INSERT' or old.status <> 'published' or old.published_at is distinct from new.published_at) then
    insert into public.notifications (user_id, dedupe_key, title, body, href)
    select p.id, 'event:' || new.id::text || ':' || p.id::text, 'Academic event', new.title,
      '/calendar?event=' || new.id::text
    from public.profiles p
    where p.account_status = 'active'
      and exists (
        select 1 from public.academic_event_targets t
        where t.event_id = new.id and public.profile_matches_target(t.target_type, t.target_id, p.id)
      )
    on conflict (user_id, dedupe_key) do nothing;
  end if;
  return new;
end;
$$;
create trigger events_notify after insert or update of status, published_at on public.academic_events for each row execute function public.handle_new_event_notifications();

-- Atomic faculty attendance entry; duplicate students/records or unauthorized classes abort the full transaction.
create or replace function public.submit_class_attendance(p_session_id uuid, p_records jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_role public.app_role;
  v_count integer;
  v_distinct integer;
  r jsonb;
  v_student uuid;
  v_status public.attendance_status;
begin
  v_role := public.current_app_role();
  if v_role not in ('faculty', 'administrator') then raise exception 'not authorized to submit attendance'; end if;
  if v_role = 'faculty' and not public.faculty_assigned_to_session(p_session_id, auth.uid()) then raise exception 'faculty is not assigned to this session'; end if;
  if not exists (select 1 from public.class_sessions where id = p_session_id and status <> 'cancelled') then raise exception 'class session does not exist or was cancelled'; end if;
  if jsonb_typeof(p_records) <> 'array' or jsonb_array_length(p_records) = 0 then raise exception 'attendance list must be a non-empty array'; end if;
  select count(*), count(distinct value ->> 'student_id') into v_count, v_distinct from jsonb_array_elements(p_records);
  if v_count <> v_distinct then raise exception 'duplicate student in attendance submission'; end if;

  update public.class_sessions set status = 'conducted', updated_by = auth.uid() where id = p_session_id;
  for r in select value from jsonb_array_elements(p_records) loop
    v_student := (r ->> 'student_id')::uuid;
    v_status := (r ->> 'status')::public.attendance_status;
    if not public.is_enrolled_in_session(v_student, p_session_id) then raise exception 'student is not enrolled in the selected class'; end if;
    insert into public.attendance_records (session_id, student_id, status, recorded_by, updated_by)
    values (p_session_id, v_student, v_status, auth.uid(), auth.uid());
  end loop;
  return v_count;
end;
$$;

create or replace function public.admin_correct_attendance(p_record_id uuid, p_new_status public.attendance_status, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_old public.attendance_status;
begin
  if not public.is_admin() then raise exception 'administrator permission required'; end if;
  if length(trim(coalesce(p_reason, ''))) < 8 then raise exception 'correction reason must contain at least 8 characters'; end if;
  select status into v_old from public.attendance_records where id = p_record_id for update;
  if v_old is null then raise exception 'attendance record not found'; end if;
  update public.attendance_records set status = p_new_status, updated_by = auth.uid() where id = p_record_id;
  insert into public.attendance_audit_logs (attendance_record_id, actor_id, previous_status, new_status, reason)
  values (p_record_id, auth.uid(), v_old, p_new_status, trim(p_reason));
end;
$$;

create or replace function public.review_attendance_correction(p_request_id uuid, p_approve boolean, p_review_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_request public.attendance_correction_requests%rowtype; v_old public.attendance_status;
begin
  if not public.is_admin() then raise exception 'administrator permission required'; end if;
  select * into v_request from public.attendance_correction_requests where id = p_request_id and status = 'pending' for update;
  if not found then raise exception 'pending correction request not found'; end if;
  select status into v_old from public.attendance_records where id = v_request.attendance_record_id for update;
  update public.attendance_correction_requests set status = case when p_approve then 'approved'::public.correction_status else 'rejected'::public.correction_status end,
    reviewed_by = auth.uid(), review_note = p_review_note, reviewed_at = now() where id = p_request_id;
  if p_approve then
    update public.attendance_records set status = v_request.requested_status, updated_by = auth.uid() where id = v_request.attendance_record_id;
    insert into public.attendance_audit_logs (attendance_record_id, actor_id, previous_status, new_status, reason, correction_request_id)
    values (v_request.attendance_record_id, auth.uid(), v_old, v_request.requested_status, v_request.reason, p_request_id);
  end if;
end;
$$;

-- Per-student/subject aggregates use the same policy in every screen and report.
create or replace view public.student_attendance_summary with (security_invoker = true) as
select e.student_id, e.course_id, e.semester_id, e.section_id,
  count(distinct s.id) filter (
    where s.status = 'conducted'
      and (a.status is distinct from 'excused'::public.attendance_status or coalesce(policy.excused_counts_as_conducted, false))
  )::integer as conducted_sessions,
  count(distinct s.id) filter (
    where s.status = 'conducted'
      and (a.status = 'present' or (a.status = 'excused' and coalesce(policy.excused_counts_as_attended, false)))
  )::integer as attended_sessions,
  case when count(distinct s.id) filter (
    where s.status = 'conducted'
      and (a.status is distinct from 'excused'::public.attendance_status or coalesce(policy.excused_counts_as_conducted, false))
  ) = 0 then null
  else round(100.0 * count(distinct s.id) filter (
    where s.status = 'conducted'
      and (a.status = 'present' or (a.status = 'excused' and coalesce(policy.excused_counts_as_attended, false)))
  ) / nullif(count(distinct s.id) filter (
    where s.status = 'conducted'
      and (a.status is distinct from 'excused'::public.attendance_status or coalesce(policy.excused_counts_as_conducted, false))
  ), 0), 1) end as attendance_percent
from public.course_enrollments e
join public.class_sessions s on s.course_id = e.course_id and s.semester_id = e.semester_id and s.section_id = e.section_id
left join public.attendance_records a on a.session_id = s.id and a.student_id = e.student_id
left join public.attendance_policies policy on policy.is_active
where e.status = 'active'
group by e.student_id, e.course_id, e.semester_id, e.section_id;

-- Attachments are private; authorization is tied to the parent announcement audience.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('college-announcements', 'college-announcements', false, 10485760, array['application/pdf','image/jpeg','image/png','image/webp','text/plain'])
on conflict (id) do update set public = false, file_size_limit = 10485760, allowed_mime_types = excluded.allowed_mime_types;

alter table public.departments enable row level security;
alter table public.programs enable row level security;
alter table public.academic_years enable row level security;
alter table public.semesters enable row level security;
alter table public.sections enable row level security;
alter table public.courses enable row level security;
alter table public.classrooms enable row level security;
alter table public.profiles enable row level security;
alter table public.course_enrollments enable row level security;
alter table public.faculty_assignments enable row level security;
alter table public.timetable_entries enable row level security;
alter table public.class_sessions enable row level security;
alter table public.attendance_policies enable row level security;
alter table public.attendance_records enable row level security;
alter table public.attendance_correction_requests enable row level security;
alter table public.attendance_audit_logs enable row level security;
alter table public.announcements enable row level security;
alter table public.announcement_targets enable row level security;
alter table public.announcement_reads enable row level security;
alter table public.announcement_attachments enable row level security;
alter table public.academic_events enable row level security;
alter table public.academic_event_targets enable row level security;
alter table public.notifications enable row level security;
alter table public.attendance_settings enable row level security;
alter table public.admin_audit_logs enable row level security;
alter table public.student_attendance_summary set (security_invoker = true);

-- Shared academic catalog: authenticated reads; administrators own structural mutations.
do $$
declare t text;
begin
  foreach t in array array['departments','programs','academic_years','semesters','sections','courses','classrooms','attendance_policies','attendance_settings'] loop
    execute format('create policy %I_select_authenticated on public.%I for select to authenticated using (auth.uid() is not null)', t, t);
    execute format('create policy %I_admin_all on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t, t);
  end loop;
end $$;

create policy profiles_select on public.profiles for select to authenticated
using (id = auth.uid() or public.is_admin() or public.faculty_can_access_student(id));
create policy profiles_update_self on public.profiles for update to authenticated
using (id = auth.uid()) with check (id = auth.uid() and role = public.current_app_role());
create policy profiles_admin_all on public.profiles for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy enrollments_select on public.course_enrollments for select to authenticated
using (student_id = auth.uid() or public.is_admin() or exists (
  select 1 from public.faculty_assignments f where f.faculty_id = auth.uid() and f.course_id = course_enrollments.course_id and f.semester_id = course_enrollments.semester_id and f.section_id = course_enrollments.section_id and f.is_active
));
create policy enrollments_admin_all on public.course_enrollments for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy faculty_assignments_select on public.faculty_assignments for select to authenticated using (faculty_id = auth.uid() or public.is_admin());
create policy faculty_assignments_admin_all on public.faculty_assignments for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy timetable_select on public.timetable_entries for select to authenticated using (
  public.is_admin() or exists(select 1 from public.faculty_assignments f where f.id = faculty_assignment_id and f.faculty_id = auth.uid() and f.is_active)
  or exists(select 1 from public.course_enrollments e where e.course_id = timetable_entries.course_id and e.semester_id = timetable_entries.semester_id and e.section_id = timetable_entries.section_id and e.student_id = auth.uid() and e.status = 'active')
);
create policy timetable_admin_all on public.timetable_entries for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy class_sessions_select on public.class_sessions for select to authenticated using (
  public.is_admin() or public.faculty_assigned_to_session(id) or public.is_enrolled_in_session(auth.uid(), id)
);
create policy class_sessions_admin_all on public.class_sessions for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy attendance_records_select on public.attendance_records for select to authenticated using (
  student_id = auth.uid() or public.is_admin() or public.faculty_assigned_to_session(session_id)
);
create policy attendance_records_insert_faculty on public.attendance_records for insert to authenticated with check (
  public.current_app_role() = 'faculty' and public.faculty_assigned_to_session(session_id) and recorded_by = auth.uid()
);
create policy attendance_records_admin_all on public.attendance_records for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy correction_request_select on public.attendance_correction_requests for select to authenticated using (
  requested_by = auth.uid() or public.is_admin() or exists(select 1 from public.attendance_records a where a.id = attendance_record_id and public.faculty_assigned_to_session(a.session_id))
);
create policy correction_request_insert on public.attendance_correction_requests for insert to authenticated with check (
  requested_by = auth.uid() and exists(select 1 from public.attendance_records a where a.id = attendance_record_id and (a.student_id = auth.uid() or public.faculty_assigned_to_session(a.session_id)))
);
create policy correction_request_admin_update on public.attendance_correction_requests for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy attendance_audit_admin_select on public.attendance_audit_logs for select to authenticated using (public.is_admin());

create policy announcements_select on public.announcements for select to authenticated using (
  public.is_admin() or author_id = auth.uid() or public.can_read_announcement(id)
);
create policy announcements_admin_insert on public.announcements for insert to authenticated with check (public.is_admin() and author_id = auth.uid());
create policy announcements_admin_update on public.announcements for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy announcements_admin_delete on public.announcements for delete to authenticated using (public.is_admin());

create policy announcement_targets_select on public.announcement_targets for select to authenticated using (
  public.is_admin() or public.can_read_announcement(announcement_id) or exists(select 1 from public.announcements a where a.id = announcement_id and a.author_id = auth.uid())
);
create policy announcement_targets_admin_all on public.announcement_targets for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy announcement_reads_select on public.announcement_reads for select to authenticated using (user_id = auth.uid() and public.can_read_announcement(announcement_id));
create policy announcement_reads_insert on public.announcement_reads for insert to authenticated with check (user_id = auth.uid() and public.can_read_announcement(announcement_id));
create policy announcement_reads_update on public.announcement_reads for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy announcement_attachments_select on public.announcement_attachments for select to authenticated using (
  public.is_admin() or exists(select 1 from public.announcements a where a.id = announcement_id and a.author_id = auth.uid()) or public.can_read_announcement(announcement_id)
);
create policy announcement_attachments_admin_all on public.announcement_attachments for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy academic_events_select on public.academic_events for select to authenticated using (
  public.is_admin() or author_id = auth.uid() or public.can_read_event(id)
);
create policy academic_events_admin_insert on public.academic_events for insert to authenticated with check (public.is_admin() and author_id = auth.uid());
create policy academic_events_admin_update on public.academic_events for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy academic_events_admin_delete on public.academic_events for delete to authenticated using (public.is_admin());
create policy event_targets_select on public.academic_event_targets for select to authenticated using (
  public.is_admin() or public.can_read_event(event_id) or exists(select 1 from public.academic_events e where e.id = event_id and e.author_id = auth.uid())
);
create policy event_targets_admin_all on public.academic_event_targets for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy notifications_select_own on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_update_own on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy admin_audit_select_admin on public.admin_audit_logs for select to authenticated using (public.is_admin());

-- Storage objects use <announcement-id>/<random-id>/<filename> paths.
create policy announcement_objects_read on storage.objects for select to authenticated using (
  bucket_id = 'college-announcements' and exists (
    select 1 from public.announcement_attachments a
    where a.storage_path = name and (public.is_admin() or public.can_read_announcement(a.announcement_id))
  )
);
create policy announcement_objects_admin_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'college-announcements' and public.is_admin()
  and exists(select 1 from public.announcements a where a.id::text = split_part(name, '/', 1) and a.status = 'draft')
);
create policy announcement_objects_admin_delete on storage.objects for delete to authenticated using (bucket_id = 'college-announcements' and public.is_admin());

-- RPC-only writes for sensitive records. The application calls these with the signed-in user session.
revoke all on function public.submit_class_attendance(uuid, jsonb) from public;
revoke all on function public.admin_correct_attendance(uuid, public.attendance_status, text) from public;
revoke all on function public.review_attendance_correction(uuid, boolean, text) from public;
grant execute on function public.submit_class_attendance(uuid, jsonb) to authenticated;
grant execute on function public.admin_correct_attendance(uuid, public.attendance_status, text) to authenticated;
grant execute on function public.review_attendance_correction(uuid, boolean, text) to authenticated;
grant execute on function public.current_app_role() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.can_read_announcement(uuid, uuid) to authenticated;
grant execute on function public.can_read_event(uuid, uuid) to authenticated;
grant execute on function public.faculty_assigned_to_session(uuid, uuid) to authenticated;
grant execute on function public.faculty_can_access_student(uuid, uuid) to authenticated;
grant execute on function public.is_enrolled_in_session(uuid, uuid) to authenticated;
grant select on public.student_attendance_summary to authenticated;
