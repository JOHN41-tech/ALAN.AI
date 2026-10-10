-- Enforce faculty identity and overlap rules across distinct course assignments.
alter table public.timetable_entries add column faculty_id uuid references public.profiles(id) on delete restrict;
update public.timetable_entries t set faculty_id = f.faculty_id from public.faculty_assignments f where f.id = t.faculty_assignment_id;
alter table public.timetable_entries alter column faculty_id set not null;

create or replace function public.sync_timetable_assignment_faculty()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_faculty uuid;
begin
  select faculty_id into v_faculty from public.faculty_assignments
  where id = new.faculty_assignment_id and course_id = new.course_id and semester_id = new.semester_id and section_id = new.section_id and is_active;
  if v_faculty is null then raise exception 'faculty assignment must be active and match the selected course, semester and section'; end if;
  new.faculty_id := v_faculty;
  return new;
end;
$$;
create trigger timetable_assignment_faculty before insert or update of faculty_assignment_id, course_id, semester_id, section_id on public.timetable_entries for each row execute function public.sync_timetable_assignment_faculty();

alter table public.timetable_entries drop constraint timetable_faculty_no_overlap;
alter table public.timetable_entries add constraint timetable_faculty_no_overlap exclude using gist (
  weekday with =,
  faculty_id with =,
  daterange(valid_from, valid_until, '[]') with &&,
  tsrange(date '2000-01-01' + starts_at_local, date '2000-01-01' + ends_at_local, '[)') with &&
) where (is_active);

alter table public.class_sessions add column faculty_id uuid references public.profiles(id) on delete restrict;
update public.class_sessions s set faculty_id = f.faculty_id from public.faculty_assignments f where f.id = s.faculty_assignment_id;
alter table public.class_sessions alter column faculty_id set not null;

create or replace function public.sync_class_session_faculty()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_faculty uuid;
begin
  select faculty_id into v_faculty from public.faculty_assignments
  where id = new.faculty_assignment_id and course_id = new.course_id and semester_id = new.semester_id and section_id = new.section_id;
  if v_faculty is null then raise exception 'class session must reference a matching faculty assignment'; end if;
  new.faculty_id := v_faculty;
  return new;
end;
$$;
create trigger class_session_faculty before insert or update of faculty_assignment_id, course_id, semester_id, section_id on public.class_sessions for each row execute function public.sync_class_session_faculty();

alter table public.class_sessions drop constraint class_session_faculty_no_overlap;
alter table public.class_sessions add constraint class_session_faculty_no_overlap exclude using gist (
  (coalesce(substitute_faculty_id, faculty_id)) with =,
  tstzrange(starts_at, ends_at, '[)') with &&
) where (status <> 'cancelled');
create index class_sessions_faculty_snapshot_idx on public.class_sessions (faculty_id, starts_at, status);

create or replace function public.faculty_assigned_to_session(p_session uuid, p_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.class_sessions s
    join public.faculty_assignments f on f.id = s.faculty_assignment_id
    where s.id = p_session and f.is_active and (f.faculty_id = p_user or s.substitute_faculty_id = p_user)
  )
$$;
revoke all on function public.faculty_assigned_to_session(uuid, uuid) from public, anon;
grant execute on function public.faculty_assigned_to_session(uuid, uuid) to authenticated;

-- Auth metadata is untrusted; safely bound new profile names and ignore any role metadata.
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public, auth as $$
declare v_name text;
begin
  v_name := nullif(trim(new.raw_user_meta_data ->> 'full_name'), '');
  if v_name is null or length(v_name) < 2 then v_name := 'New student'; end if;
  if length(v_name) > 120 then v_name := left(v_name, 120); end if;
  insert into public.profiles (id, role, full_name, college_email)
  values (new.id, 'student', v_name, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Keep multi-row notice/event targeting and publication atomic; the notification trigger runs only
-- after all target rows exist and only once the final status is published.
create or replace function public.admin_save_announcement(p_id uuid, p_data jsonb, p_targets jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_status public.announcement_status; v_published_at timestamptz; v_target jsonb; v_kind public.target_kind; v_target_id uuid;
begin
  if not public.is_admin() then raise exception 'administrator permission required'; end if;
  if jsonb_typeof(p_targets) <> 'array' or jsonb_array_length(p_targets) = 0 then raise exception 'at least one audience target is required'; end if;
  v_id := coalesce(p_id, gen_random_uuid());
  v_status := coalesce((p_data ->> 'status')::public.announcement_status, 'draft');
  v_published_at := case when v_status = 'published' then coalesce((p_data ->> 'published_at')::timestamptz, now()) else null end;
  if p_id is not null then
    perform 1 from public.announcements where id = p_id for update;
    if not found then raise exception 'announcement not found'; end if;
    update public.announcements set title = p_data ->> 'title', summary = p_data ->> 'summary', body = p_data ->> 'body',
      category = coalesce(p_data ->> 'category', 'general'), priority = coalesce((p_data ->> 'priority')::public.notice_priority, 'normal'),
      status = 'draft', scheduled_for = nullif(p_data ->> 'scheduled_for', '')::timestamptz,
      published_at = null, expires_at = nullif(p_data ->> 'expires_at', '')::timestamptz
    where id = p_id;
    delete from public.announcement_targets where announcement_id = p_id;
  else
    insert into public.announcements (id, title, summary, body, category, priority, status, author_id, scheduled_for, published_at, expires_at)
    values (v_id, p_data ->> 'title', p_data ->> 'summary', p_data ->> 'body', coalesce(p_data ->> 'category', 'general'),
      coalesce((p_data ->> 'priority')::public.notice_priority, 'normal'), 'draft', auth.uid(),
      nullif(p_data ->> 'scheduled_for', '')::timestamptz, null, nullif(p_data ->> 'expires_at', '')::timestamptz);
  end if;
  for v_target in select value from jsonb_array_elements(p_targets) loop
    v_kind := (v_target ->> 'type')::public.target_kind;
    v_target_id := nullif(v_target ->> 'id', '')::uuid;
    if (v_kind = 'college' and v_target_id is not null) or (v_kind <> 'college' and v_target_id is null) then raise exception 'invalid audience target'; end if;
    insert into public.announcement_targets (announcement_id, target_type, target_id) values (v_id, v_kind, v_target_id);
  end loop;
  if v_status = 'published' then
    update public.announcements set status = 'published', published_at = v_published_at where id = v_id;
  elsif v_status = 'archived' then
    update public.announcements set status = 'archived' where id = v_id;
  end if;
  return v_id;
end;
$$;

create or replace function public.admin_save_academic_event(p_id uuid, p_data jsonb, p_targets jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_status public.announcement_status; v_published_at timestamptz; v_target jsonb; v_kind public.target_kind; v_target_id uuid;
begin
  if not public.is_admin() then raise exception 'administrator permission required'; end if;
  if jsonb_typeof(p_targets) <> 'array' or jsonb_array_length(p_targets) = 0 then raise exception 'at least one audience target is required'; end if;
  v_id := coalesce(p_id, gen_random_uuid());
  v_status := coalesce((p_data ->> 'status')::public.announcement_status, 'draft');
  v_published_at := case when v_status = 'published' then coalesce((p_data ->> 'published_at')::timestamptz, now()) else null end;
  if p_id is not null then
    perform 1 from public.academic_events where id = p_id for update;
    if not found then raise exception 'event not found'; end if;
    update public.academic_events set title = p_data ->> 'title', description = p_data ->> 'description', category = (p_data ->> 'category')::public.event_kind,
      starts_at = (p_data ->> 'starts_at')::timestamptz, ends_at = (p_data ->> 'ends_at')::timestamptz,
      time_zone = coalesce(p_data ->> 'time_zone', 'Asia/Kolkata'), location = p_data ->> 'location', status = 'draft', published_at = null
    where id = p_id;
    delete from public.academic_event_targets where event_id = p_id;
  else
    insert into public.academic_events (id, title, description, category, starts_at, ends_at, time_zone, location, status, author_id, published_at)
    values (v_id, p_data ->> 'title', p_data ->> 'description', (p_data ->> 'category')::public.event_kind,
      (p_data ->> 'starts_at')::timestamptz, (p_data ->> 'ends_at')::timestamptz, coalesce(p_data ->> 'time_zone', 'Asia/Kolkata'),
      p_data ->> 'location', 'draft', auth.uid(), null);
  end if;
  for v_target in select value from jsonb_array_elements(p_targets) loop
    v_kind := (v_target ->> 'type')::public.target_kind;
    v_target_id := nullif(v_target ->> 'id', '')::uuid;
    if (v_kind = 'college' and v_target_id is not null) or (v_kind <> 'college' and v_target_id is null) then raise exception 'invalid audience target'; end if;
    insert into public.academic_event_targets (event_id, target_type, target_id) values (v_id, v_kind, v_target_id);
  end loop;
  if v_status = 'published' then update public.academic_events set status = 'published', published_at = v_published_at where id = v_id;
  elsif v_status = 'archived' then update public.academic_events set status = 'archived' where id = v_id;
  end if;
  return v_id;
end;
$$;

create or replace function public.submit_class_attendance(p_session_id uuid, p_records jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare v_role public.app_role; v_count integer; v_distinct integer; r jsonb; v_student uuid; v_status public.attendance_status; v_starts_at timestamptz;
begin
  v_role := public.current_app_role();
  if v_role not in ('faculty', 'administrator') then raise exception 'not authorized to submit attendance'; end if;
  if v_role = 'faculty' and not public.faculty_assigned_to_session(p_session_id, auth.uid()) then raise exception 'faculty is not assigned to this session'; end if;
  select starts_at into v_starts_at from public.class_sessions where id = p_session_id and status <> 'cancelled' for update;
  if not found then raise exception 'class session does not exist or was cancelled'; end if;
  if v_starts_at > now() then raise exception 'attendance cannot be submitted before the class starts'; end if;
  if jsonb_typeof(p_records) <> 'array' or jsonb_array_length(p_records) = 0 or jsonb_array_length(p_records) > 200 then raise exception 'attendance list must contain between 1 and 200 records'; end if;
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

revoke all on function public.admin_save_announcement(uuid, jsonb, jsonb) from public, anon;
revoke all on function public.admin_save_academic_event(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.admin_save_announcement(uuid, jsonb, jsonb) to authenticated;
grant execute on function public.admin_save_academic_event(uuid, jsonb, jsonb) to authenticated;
revoke all on function public.sync_timetable_assignment_faculty() from public, anon, authenticated;
revoke all on function public.sync_class_session_faculty() from public, anon, authenticated;
revoke all on function public.handle_new_auth_user() from public, anon, authenticated;
revoke all on function public.handle_new_announcement_notifications() from public, anon, authenticated;
revoke all on function public.handle_new_event_notifications() from public, anon, authenticated;
revoke all on function public.handle_class_session_notifications() from public, anon, authenticated;
