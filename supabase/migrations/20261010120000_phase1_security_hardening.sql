-- Hardening follow-up to the initial Phase 1 schema.
create extension if not exists btree_gist;

-- NULL target IDs must not permit duplicate college-wide audience rows.
create unique index announcement_targets_college_uidx on public.announcement_targets (announcement_id) where target_type = 'college';
create unique index announcement_targets_group_uidx on public.announcement_targets (announcement_id, target_type, target_id) where target_type <> 'college';
create unique index event_targets_college_uidx on public.academic_event_targets (event_id) where target_type = 'college';
create unique index event_targets_group_uidx on public.academic_event_targets (event_id, target_type, target_id) where target_type <> 'college';

-- Reject overlapping recurring room or faculty reservations in PostgreSQL, not only in UI code.
alter table public.timetable_entries
  add constraint timetable_room_no_overlap exclude using gist (
    weekday with =,
    classroom_id with =,
    daterange(valid_from, valid_until, '[]') with &&,
    tsrange(date '2000-01-01' + starts_at_local, date '2000-01-01' + ends_at_local, '[)') with &&
  ) where (is_active and classroom_id is not null);
alter table public.timetable_entries
  add constraint timetable_faculty_no_overlap exclude using gist (
    weekday with =,
    faculty_assignment_id with =,
    daterange(valid_from, valid_until, '[]') with &&,
    tsrange(date '2000-01-01' + starts_at_local, date '2000-01-01' + ends_at_local, '[)') with &&
  ) where (is_active);
alter table public.class_sessions
  add constraint class_session_room_no_overlap exclude using gist (
    classroom_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status <> 'cancelled' and classroom_id is not null);
alter table public.class_sessions
  add constraint class_session_faculty_no_overlap exclude using gist (
    faculty_assignment_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status <> 'cancelled');

-- Students may see the names of the faculty assigned to their own enrolled class, not unrelated profiles.
create or replace function public.student_can_read_faculty_profile(p_faculty uuid, p_student uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.course_enrollments e
    join public.faculty_assignments f
      on f.course_id = e.course_id and f.semester_id = e.semester_id and f.section_id = e.section_id and f.is_active
    where e.student_id = p_student and e.status = 'active' and f.faculty_id = p_faculty
  )
$$;
drop policy profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
using (id = auth.uid() or public.is_admin() or public.faculty_can_access_student(id) or (role = 'faculty' and public.student_can_read_faculty_profile(id)));

-- Application clients can edit only basic self-service profile columns. Role and academic placement
-- changes require a server-trusted provisioning/admin operation and cannot be changed via PostgREST.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, preferred_name, profile_image_path) on public.profiles to authenticated;

-- No ordinary client can insert/update/delete an official attendance row. Faculty entry is through
-- the assignment-checked atomic RPC; corrections are through the audited administrator RPC.
drop policy attendance_records_insert_faculty on public.attendance_records;
drop policy attendance_records_admin_all on public.attendance_records;
revoke insert, update, delete on public.attendance_records from anon, authenticated;
grant select on public.attendance_records to authenticated;

-- Notification links must remain local application paths, not protocol-relative external redirects.
alter table public.notifications drop constraint notifications_href_check;
alter table public.notifications add constraint notifications_href_check
  check (href like '/%' and href not like '//%' and href !~ '[[:cntrl:]]');

-- Notify enrolled students and the assigned faculty when an actual class session changes.
create or replace function public.handle_class_session_notifications()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_title text; v_body text; v_href text; v_key text;
begin
  if tg_op = 'UPDATE' and (old.status is distinct from new.status or old.starts_at is distinct from new.starts_at or old.ends_at is distinct from new.ends_at or old.classroom_id is distinct from new.classroom_id or old.change_note is distinct from new.change_note) then
    v_title := case when new.status = 'cancelled' then 'Class cancelled' else 'Timetable updated' end;
    v_body := coalesce(nullif(trim(new.change_note), ''), case when new.status = 'cancelled' then new.cancellation_reason else 'A class session has changed.' end);
    v_href := '/timetable';
    v_key := 'class-session:' || new.id::text || ':' || new.updated_at::text;
    insert into public.notifications (user_id, dedupe_key, title, body, href)
    select distinct p.id, v_key || ':' || p.id::text, v_title, v_body, v_href
    from public.profiles p
    where p.account_status = 'active' and (
      p.id = (select f.faculty_id from public.faculty_assignments f where f.id = new.faculty_assignment_id)
      or exists (
        select 1 from public.course_enrollments e
        where e.student_id = p.id and e.course_id = new.course_id and e.semester_id = new.semester_id
          and e.section_id = new.section_id and e.status = 'active'
      )
    )
    on conflict (user_id, dedupe_key) do nothing;
  end if;
  return new;
end;
$$;
create trigger class_session_notifications after update on public.class_sessions for each row execute function public.handle_class_session_notifications();

-- Secure-profile helpers called from authenticated RLS policies are executable only by app users.
revoke all on function public.student_can_read_faculty_profile(uuid, uuid) from public, anon;
grant execute on function public.student_can_read_faculty_profile(uuid, uuid) to authenticated;
revoke all on function public.current_app_role() from public, anon;
revoke all on function public.is_admin() from public, anon;
revoke all on function public.profile_matches_target(public.target_kind, uuid, uuid) from public, anon;
revoke all on function public.can_read_announcement(uuid, uuid) from public, anon;
revoke all on function public.can_read_event(uuid, uuid) from public, anon;
revoke all on function public.faculty_assigned_to_session(uuid, uuid) from public, anon;
revoke all on function public.faculty_can_access_student(uuid, uuid) from public, anon;
revoke all on function public.is_enrolled_in_session(uuid, uuid) from public, anon;
grant execute on function public.current_app_role() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.profile_matches_target(public.target_kind, uuid, uuid) to authenticated;
grant execute on function public.can_read_announcement(uuid, uuid) to authenticated;
grant execute on function public.can_read_event(uuid, uuid) to authenticated;
grant execute on function public.faculty_assigned_to_session(uuid, uuid) to authenticated;
grant execute on function public.faculty_can_access_student(uuid, uuid) to authenticated;
grant execute on function public.is_enrolled_in_session(uuid, uuid) to authenticated;

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
-- Restore the least-privilege profile and attendance grants after broad schema defaults.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, preferred_name, profile_image_path) on public.profiles to authenticated;
revoke insert, update, delete on public.attendance_records from anon, authenticated;
grant select on public.attendance_records to authenticated;
revoke all on function public.submit_class_attendance(uuid, jsonb) from public, anon;
revoke all on function public.admin_correct_attendance(uuid, public.attendance_status, text) from public, anon;
revoke all on function public.review_attendance_correction(uuid, boolean, text) from public, anon;
grant execute on function public.submit_class_attendance(uuid, jsonb) to authenticated;
grant execute on function public.admin_correct_attendance(uuid, public.attendance_status, text) to authenticated;
grant execute on function public.review_attendance_correction(uuid, boolean, text) to authenticated;
