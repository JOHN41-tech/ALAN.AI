create or replace view public.class_session_staff_names with (security_barrier = true) as
select s.id as session_id,
  faculty.full_name as faculty_name,
  substitute.full_name as substitute_faculty_name
from public.class_sessions s
join public.faculty_assignments assignment on assignment.id = s.faculty_assignment_id
join public.profiles faculty on faculty.id = assignment.faculty_id
left join public.profiles substitute on substitute.id = s.substitute_faculty_id
where auth.uid() is not null
  and (
    public.is_admin()
    or public.is_enrolled_in_session(auth.uid(), s.id)
    or public.faculty_assigned_to_session(s.id, auth.uid())
  );
revoke all on public.class_session_staff_names from public, anon;
grant select on public.class_session_staff_names to authenticated;
