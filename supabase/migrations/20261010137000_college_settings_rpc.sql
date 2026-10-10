create or replace function public.admin_update_college_settings(
  p_college_name text,
  p_time_zone text,
  p_minimum_percent numeric,
  p_target_percent numeric,
  p_excused_counts_as_conducted boolean,
  p_excused_counts_as_attended boolean
) returns void
language plpgsql security definer set search_path = public, pg_catalog as $$
declare v_actor uuid := auth.uid(); v_policy uuid;
begin
  if not public.is_admin() then raise exception 'administrator role is required'; end if;
  if length(trim(p_college_name)) not between 2 and 100 then raise exception 'college name must contain 2–100 characters'; end if;
  if not exists(select 1 from pg_timezone_names where name = p_time_zone) then raise exception 'choose a valid IANA timezone'; end if;
  if p_minimum_percent not between 0 and 100 or p_target_percent not between 0 and 100 then raise exception 'attendance percentages must be between 0 and 100'; end if;
  insert into public.attendance_settings (id, college_name, time_zone, updated_by)
  values (true, trim(p_college_name), p_time_zone, v_actor)
  on conflict (id) do update set college_name = excluded.college_name, time_zone = excluded.time_zone, updated_by = v_actor, updated_at = now();
  select id into v_policy from public.attendance_policies where is_active for update;
  if v_policy is null then raise exception 'no active attendance policy exists'; end if;
  update public.attendance_policies set minimum_percent = p_minimum_percent, target_percent = p_target_percent,
    excused_counts_as_conducted = p_excused_counts_as_conducted,
    excused_counts_as_attended = p_excused_counts_as_attended, updated_by = v_actor, updated_at = now()
  where id = v_policy;
  insert into public.admin_audit_logs (actor_id, action, entity_type, entity_id, details)
  values (v_actor, 'update_college_settings', 'attendance_settings', null,
    jsonb_build_object('college_name', trim(p_college_name), 'time_zone', p_time_zone,
      'minimum_percent', p_minimum_percent, 'target_percent', p_target_percent,
      'excused_counts_as_conducted', p_excused_counts_as_conducted,
      'excused_counts_as_attended', p_excused_counts_as_attended));
end;
$$;
revoke all on function public.admin_update_college_settings(text, text, numeric, numeric, boolean, boolean) from public, anon;
grant execute on function public.admin_update_college_settings(text, text, numeric, numeric, boolean, boolean) to authenticated;
