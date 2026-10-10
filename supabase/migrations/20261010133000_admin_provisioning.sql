-- An administrator-accessible application server calls this only through its server-only service-role
-- client after validating the active session. It is not granted to anon/authenticated API roles.
create or replace function public.admin_update_profile_access(
  p_actor_id uuid,
  p_profile_id uuid,
  p_role public.app_role,
  p_account_status public.account_status,
  p_department_id uuid,
  p_program_id uuid,
  p_academic_year_id uuid,
  p_semester_id uuid,
  p_section_id uuid,
  p_student_identifier text
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_previous public.profiles%rowtype;
  v_section_program uuid;
  v_section_semester uuid;
  v_program_department uuid;
begin
  if not exists (select 1 from public.profiles actor where actor.id = p_actor_id and actor.role = 'administrator' and actor.account_status = 'active') then
    raise exception 'active administrator identity is required';
  end if;
  if p_profile_id = p_actor_id and p_role <> 'administrator' then
    raise exception 'an administrator cannot remove their own role through this operation';
  end if;
  if p_section_id is not null then
    select program_id, semester_id into v_section_program, v_section_semester from public.sections where id = p_section_id;
    if not found or v_section_program <> p_program_id or v_section_semester <> p_semester_id then
      raise exception 'selected section does not match the program and semester';
    end if;
  end if;
  if p_program_id is not null and p_department_id is not null then
    select department_id into v_program_department from public.programs where id = p_program_id;
    if v_program_department is distinct from p_department_id then raise exception 'selected program does not belong to the selected department'; end if;
  end if;

  select * into v_previous from public.profiles where id = p_profile_id for update;
  if not found then raise exception 'profile not found'; end if;
  update public.profiles set role = p_role, account_status = p_account_status,
    department_id = p_department_id, program_id = p_program_id, academic_year_id = p_academic_year_id,
    semester_id = p_semester_id, section_id = p_section_id,
    student_identifier = nullif(trim(p_student_identifier), '')
  where id = p_profile_id;

  if p_role = 'student' and p_account_status = 'active' and p_program_id is not null and p_semester_id is not null and p_section_id is not null then
    update public.course_enrollments set status = 'withdrawn'
    where student_id = p_profile_id and status = 'active';
    insert into public.course_enrollments (student_id, course_id, semester_id, section_id, status)
    select p_profile_id, o.course_id, o.semester_id, p_section_id, 'active'
    from public.course_offerings o
    where o.program_id = p_program_id and o.semester_id = p_semester_id and o.is_active
    on conflict (student_id, course_id, semester_id) do update set section_id = excluded.section_id, status = 'active';
  else
    update public.course_enrollments set status = 'withdrawn'
    where student_id = p_profile_id and status = 'active';
  end if;

  insert into public.admin_audit_logs (actor_id, action, entity_type, entity_id, details)
  values (p_actor_id, 'update_account_access', 'profile', p_profile_id, jsonb_build_object(
    'previous_role', v_previous.role, 'role', p_role,
    'previous_status', v_previous.account_status, 'account_status', p_account_status,
    'previous_section_id', v_previous.section_id, 'section_id', p_section_id
  ));
end;
$$;
revoke all on function public.admin_update_profile_access(uuid, uuid, public.app_role, public.account_status, uuid, uuid, uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.admin_update_profile_access(uuid, uuid, public.app_role, public.account_status, uuid, uuid, uuid, uuid, uuid, text) to service_role;
