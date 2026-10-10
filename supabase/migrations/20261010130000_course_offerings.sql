create table public.course_offerings (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete restrict,
  course_id uuid not null references public.courses(id) on delete restrict,
  semester_id uuid not null references public.semesters(id) on delete restrict,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (program_id, course_id, semester_id)
);
create index course_offerings_semester_idx on public.course_offerings (program_id, semester_id, is_active);
create trigger course_offerings_touch_updated_at before update on public.course_offerings for each row execute function public.touch_updated_at();
alter table public.course_offerings enable row level security;
create policy course_offerings_select on public.course_offerings for select to authenticated using (auth.uid() is not null);
create policy course_offerings_admin_all on public.course_offerings for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.course_offerings to authenticated;

create or replace function public.validate_faculty_assignment_offering()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_section_program uuid; v_section_semester uuid;
begin
  select program_id, semester_id into v_section_program, v_section_semester from public.sections where id = new.section_id;
  if v_section_program is null or v_section_semester is null or v_section_semester <> new.semester_id then
    raise exception 'faculty assignment section must match its semester';
  end if;
  if not exists(select 1 from public.course_offerings o where o.program_id = v_section_program and o.course_id = new.course_id and o.semester_id = new.semester_id and o.is_active) then
    raise exception 'course must be offered to this program in the selected semester';
  end if;
  if not exists(select 1 from public.profiles p where p.id = new.faculty_id and p.role = 'faculty' and p.account_status = 'active') then
    raise exception 'faculty assignment requires an active faculty account';
  end if;
  return new;
end;
$$;
create trigger faculty_assignments_validate_offering before insert or update of faculty_id, course_id, semester_id, section_id, is_active on public.faculty_assignments for each row execute function public.validate_faculty_assignment_offering();
revoke all on function public.validate_faculty_assignment_offering() from public, anon, authenticated;
