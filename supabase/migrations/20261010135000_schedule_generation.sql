create or replace function public.admin_generate_class_sessions(p_start_on date, p_end_on date)
returns integer language plpgsql security definer set search_path = public as $$
declare v_created integer;
begin
  if not public.is_admin() then raise exception 'administrator permission required'; end if;
  if p_start_on is null or p_end_on is null or p_end_on < p_start_on then raise exception 'a valid date range is required'; end if;
  if p_end_on - p_start_on > 91 then raise exception 'generate at most 92 days at a time'; end if;

  insert into public.class_sessions (
    timetable_entry_id, course_id, semester_id, section_id, faculty_assignment_id, classroom_id,
    starts_at, ends_at, status, created_by, updated_by
  )
  select e.id, e.course_id, e.semester_id, e.section_id, e.faculty_assignment_id, e.classroom_id,
    (days.local_date + e.starts_at_local) at time zone e.time_zone,
    (days.local_date + e.ends_at_local) at time zone e.time_zone,
    'scheduled', auth.uid(), auth.uid()
  from public.timetable_entries e
  cross join lateral generate_series(p_start_on, p_end_on, interval '1 day') as days(local_timestamp)
  cross join lateral (select days.local_timestamp::date as local_date) days_date
  where e.is_active
    and days_date.local_date between e.valid_from and coalesce(e.valid_until, 'infinity'::date)
    and extract(dow from days_date.local_date)::integer = e.weekday
  on conflict (timetable_entry_id, starts_at) where timetable_entry_id is not null do nothing;
  get diagnostics v_created = row_count;
  return v_created;
end;
$$;
revoke all on function public.admin_generate_class_sessions(date, date) from public, anon;
grant execute on function public.admin_generate_class_sessions(date, date) to authenticated;
