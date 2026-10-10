-- ALAN.AI Phase 2 career, learning and companion platform.
-- Integrates with Phase 1 public.profiles(id); does not create demo auth or an independent user table.
create extension if not exists pgcrypto;

create table if not exists public.phase2_opportunities (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(title) between 3 and 180),
  company text not null check (length(company) between 1 and 160),
  kind text not null check (kind in ('Internship','Full-time','Part-time','Contract','Apprenticeship','Scholarship')),
  domain text,
  location text,
  work_mode text check (work_mode is null or work_mode in ('Remote','Hybrid','Onsite')),
  skills text[] not null default '{}',
  description text not null default '',
  deadline date,
  source_url text,
  provenance text not null default 'administrator',
  verification_status text not null default 'unverified' check (verification_status in ('unverified','verified','rejected')),
  published boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint phase2_published_opportunity_must_be_verified check (not published or (verification_status = 'verified' and source_url is not null and source_url <> ''))
);
create index if not exists phase2_opportunities_search_idx on public.phase2_opportunities using gin (to_tsvector('english', title || ' ' || company || ' ' || coalesce(domain,'')));
create index if not exists phase2_opportunities_deadline_idx on public.phase2_opportunities(deadline) where published;

create table if not exists public.phase2_saved_opportunities (
  user_id uuid not null references public.profiles(id) on delete cascade,
  opportunity_id uuid not null references public.phase2_opportunities(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, opportunity_id)
);
create table if not exists public.phase2_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  opportunity_id uuid not null references public.phase2_opportunities(id) on delete restrict,
  status text not null default 'Interested' check (status in ('Interested','Applied','Assessment','Interview','Offer','Rejected','Withdrawn')),
  notes text not null default '' check (length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, opportunity_id)
);
create index if not exists phase2_applications_user_idx on public.phase2_applications(user_id, updated_at desc);

create table if not exists public.phase2_career_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  target_domain text,
  updated_at timestamptz not null default now()
);

create table if not exists public.phase2_roadmaps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (length(title) between 2 and 120),
  domain text not null check (length(domain) between 2 and 100),
  summary text not null default '' check (length(summary) <= 3000),
  weekly_hours smallint not null default 5 check (weekly_hours between 1 and 40),
  status text not null default 'active' check (status in ('active','paused','completed')),
  ai_generated boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists phase2_roadmaps_user_idx on public.phase2_roadmaps(user_id, created_at desc);
create table if not exists public.phase2_roadmap_tasks (
  id uuid primary key default gen_random_uuid(),
  roadmap_id uuid not null references public.phase2_roadmaps(id) on delete cascade,
  title text not null check (length(title) between 2 and 180),
  phase text not null check (length(phase) between 2 and 80),
  description text not null default '' check (length(description) <= 2000),
  estimated_hours smallint not null default 1 check (estimated_hours between 1 and 100),
  done boolean not null default false,
  notes text not null default '' check (length(notes) <= 500),
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  unique (roadmap_id, position)
);
create index if not exists phase2_roadmap_tasks_order_idx on public.phase2_roadmap_tasks(roadmap_id, position);

create table if not exists public.phase2_resources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  provider text not null,
  domain text not null,
  level text not null check (level in ('Beginner','Intermediate','Advanced')),
  resource_type text not null,
  url text not null unique check (url like 'https://%'),
  skills text[] not null default '{}',
  published boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists public.phase2_resource_bookmarks (
  user_id uuid not null references public.profiles(id) on delete cascade,
  resource_id uuid not null references public.phase2_resources(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, resource_id)
);

create table if not exists public.phase2_assessments (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  topic text not null,
  instructions text not null default '',
  published boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists public.phase2_assessment_questions (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.phase2_assessments(id) on delete cascade,
  position smallint not null,
  prompt text not null,
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 8),
  correct_index smallint not null check (correct_index between 0 and 7),
  constraint phase2_question_correct_option_check check (correct_index < jsonb_array_length(options)),
  explanation text not null,
  active boolean not null default true,
  unique (assessment_id, position)
);
create table if not exists public.phase2_assessment_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  assessment_id uuid not null references public.phase2_assessments(id) on delete restrict,
  score smallint not null check (score >= 0),
  total smallint not null check (total > 0 and score <= total),
  answers jsonb not null default '{}'::jsonb,
  review jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists phase2_attempts_user_idx on public.phase2_assessment_attempts(user_id, created_at desc);

create table if not exists public.phase2_interviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (length(role) between 2 and 100),
  status text not null default 'active' check (status in ('active','completed')),
  turns jsonb not null default '[]'::jsonb check (jsonb_typeof(turns) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists phase2_interviews_user_idx on public.phase2_interviews(user_id, created_at desc);

create table if not exists public.phase2_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (length(title) between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists phase2_conversations_user_idx on public.phase2_conversations(user_id, updated_at desc);
create table if not exists public.phase2_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.phase2_conversations(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null check (length(content) between 1 and 6000),
  created_at timestamptz not null default now()
);
create index if not exists phase2_messages_conversation_idx on public.phase2_messages(conversation_id, created_at);

-- Persistent short-term rate-limit events are written only by the trusted SECURITY DEFINER RPC.
create table if not exists public.phase2_ai_request_events (
  user_id uuid not null references public.profiles(id) on delete cascade,
  requested_at timestamptz not null default now()
);
create index if not exists phase2_ai_request_events_user_idx on public.phase2_ai_request_events(user_id, requested_at desc);

-- RLS: student-owned records are isolated to auth.uid(); no staff policy grants access to private career/chat data.
alter table public.phase2_opportunities enable row level security;
drop policy if exists phase2_opportunities_published_read on public.phase2_opportunities;
create policy phase2_opportunities_published_read on public.phase2_opportunities for select to authenticated using (published and verification_status = 'verified');
drop policy if exists phase2_opportunities_admin_manage on public.phase2_opportunities;
create policy phase2_opportunities_admin_manage on public.phase2_opportunities for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.phase2_saved_opportunities enable row level security;
drop policy if exists phase2_saved_opportunities_own on public.phase2_saved_opportunities;
create policy phase2_saved_opportunities_own on public.phase2_saved_opportunities for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (select 1 from public.phase2_opportunities o where o.id = opportunity_id and o.published and o.verification_status = 'verified'));

alter table public.phase2_applications enable row level security;
drop policy if exists phase2_applications_own on public.phase2_applications;
create policy phase2_applications_own on public.phase2_applications for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (select 1 from public.phase2_opportunities o where o.id = opportunity_id and o.published and o.verification_status = 'verified'));

alter table public.phase2_career_profiles enable row level security;
drop policy if exists phase2_career_profiles_own on public.phase2_career_profiles;
create policy phase2_career_profiles_own on public.phase2_career_profiles for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.phase2_roadmaps enable row level security;
drop policy if exists phase2_roadmaps_own on public.phase2_roadmaps;
create policy phase2_roadmaps_own on public.phase2_roadmaps for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.phase2_roadmap_tasks enable row level security;
drop policy if exists phase2_roadmap_tasks_own on public.phase2_roadmap_tasks;
create policy phase2_roadmap_tasks_own on public.phase2_roadmap_tasks for all to authenticated using (exists (select 1 from public.phase2_roadmaps r where r.id = roadmap_id and r.user_id = auth.uid())) with check (exists (select 1 from public.phase2_roadmaps r where r.id = roadmap_id and r.user_id = auth.uid()));

alter table public.phase2_resources enable row level security;
drop policy if exists phase2_resources_published_read on public.phase2_resources;
create policy phase2_resources_published_read on public.phase2_resources for select to authenticated using (published);
drop policy if exists phase2_resources_admin_manage on public.phase2_resources;
create policy phase2_resources_admin_manage on public.phase2_resources for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.phase2_resource_bookmarks enable row level security;
drop policy if exists phase2_resource_bookmarks_own on public.phase2_resource_bookmarks;
create policy phase2_resource_bookmarks_own on public.phase2_resource_bookmarks for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (select 1 from public.phase2_resources r where r.id = resource_id and r.published));

alter table public.phase2_assessments enable row level security;
drop policy if exists phase2_assessments_published_read on public.phase2_assessments;
create policy phase2_assessments_published_read on public.phase2_assessments for select to authenticated using (published);
drop policy if exists phase2_assessments_admin_manage on public.phase2_assessments;
create policy phase2_assessments_admin_manage on public.phase2_assessments for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.phase2_assessment_questions enable row level security;
-- Intentionally no direct client policies or grants: correct_index and explanation are private until submission.

alter table public.phase2_assessment_attempts enable row level security;
drop policy if exists phase2_assessment_attempts_read_own on public.phase2_assessment_attempts;
create policy phase2_assessment_attempts_read_own on public.phase2_assessment_attempts for select to authenticated using (user_id = auth.uid());

alter table public.phase2_interviews enable row level security;
drop policy if exists phase2_interviews_own on public.phase2_interviews;
create policy phase2_interviews_own on public.phase2_interviews for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.phase2_conversations enable row level security;
drop policy if exists phase2_conversations_own on public.phase2_conversations;
create policy phase2_conversations_own on public.phase2_conversations for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.phase2_messages enable row level security;
drop policy if exists phase2_messages_own_conversation on public.phase2_messages;
create policy phase2_messages_own_conversation on public.phase2_messages for select to authenticated
  using (exists (select 1 from public.phase2_conversations c where c.id = conversation_id and c.user_id = auth.uid()));

alter table public.phase2_ai_request_events enable row level security;
-- Intentionally no direct client policies or grants: rate-limit writes are RPC-only.

-- Grant table capabilities to authenticated users; RLS and the private-table revocations below remain authoritative.
revoke all on public.phase2_opportunities, public.phase2_saved_opportunities, public.phase2_applications,
  public.phase2_career_profiles, public.phase2_roadmaps, public.phase2_roadmap_tasks,
  public.phase2_resources, public.phase2_resource_bookmarks, public.phase2_assessments,
  public.phase2_assessment_questions, public.phase2_assessment_attempts, public.phase2_interviews,
  public.phase2_conversations, public.phase2_messages, public.phase2_ai_request_events from public, anon, authenticated;
grant select, insert, update, delete on public.phase2_opportunities, public.phase2_saved_opportunities, public.phase2_applications,
  public.phase2_career_profiles, public.phase2_roadmaps, public.phase2_roadmap_tasks,
  public.phase2_resources, public.phase2_resource_bookmarks, public.phase2_assessments,
  public.phase2_interviews, public.phase2_conversations to authenticated;
grant select on public.phase2_messages to authenticated;
grant select on public.phase2_assessment_attempts to authenticated;
revoke all on public.phase2_assessment_questions, public.phase2_ai_request_events from public, anon, authenticated;

-- The authenticated list reveals question text/options only; never the correct option or explanation.
create or replace function public.phase2_list_assessment_questions()
returns table (assessment_id uuid, assessment_slug text, assessment_title text, topic text, instructions text, question_id uuid, position smallint, prompt text, options jsonb)
language sql stable security definer set search_path = public, pg_temp as $$
  select a.id, a.slug, a.title, a.topic, a.instructions, q.id, q.position, q.prompt, q.options
  from public.phase2_assessments a
  join public.phase2_assessment_questions q on q.assessment_id = a.id
  where auth.uid() is not null and a.published and q.active
  order by a.title, q.position
$$;
revoke all on function public.phase2_list_assessment_questions() from public, anon;
grant execute on function public.phase2_list_assessment_questions() to authenticated;

-- Score only in the database. Correct answers are returned to the owner only after a saved attempt.
create or replace function public.phase2_submit_assessment(p_assessment_id uuid, p_answers jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_total integer;
  v_score integer := 0;
  v_attempt uuid := gen_random_uuid();
  v_answer integer;
  v_correct boolean;
  v_review jsonb := '[]'::jsonb;
  q record;
begin
  if v_uid is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if p_answers is null or jsonb_typeof(p_answers) is distinct from 'object' then raise exception 'invalid answers'; end if;
  if not exists (select 1 from public.phase2_assessments where id = p_assessment_id and published) then raise exception 'assessment not found'; end if;
  select count(*) into v_total from public.phase2_assessment_questions where assessment_id = p_assessment_id and active;
  if v_total < 1 or v_total > 50 or jsonb_object_length(p_answers) <> v_total then raise exception 'answer every question exactly once'; end if;
  if exists (
    select 1 from jsonb_object_keys(p_answers) as supplied(question_id)
    where not exists (select 1 from public.phase2_assessment_questions x where x.assessment_id = p_assessment_id and x.active and x.id::text = supplied.question_id)
  ) then raise exception 'invalid question'; end if;
  for q in select id, position, prompt, options, correct_index, explanation from public.phase2_assessment_questions where assessment_id = p_assessment_id and active order by position loop
    begin v_answer := (p_answers ->> q.id::text)::integer;
    exception when others then raise exception 'invalid answer'; end;
    if v_answer is null or v_answer < 0 or v_answer >= jsonb_array_length(q.options) then raise exception 'invalid answer'; end if;
    v_correct := v_answer = q.correct_index;
    if v_correct then v_score := v_score + 1; end if;
    v_review := v_review || jsonb_build_array(jsonb_build_object('questionId', q.id, 'position', q.position, 'prompt', q.prompt, 'options', q.options, 'selectedIndex', v_answer, 'correctIndex', q.correct_index, 'correct', v_correct, 'explanation', q.explanation));
  end loop;
  insert into public.phase2_assessment_attempts(id, user_id, assessment_id, score, total, answers, review)
  values (v_attempt, v_uid, p_assessment_id, v_score, v_total, p_answers, v_review);
  return jsonb_build_object('attemptId', v_attempt, 'score', v_score, 'total', v_total, 'review', v_review);
end $$;
revoke all on function public.phase2_submit_assessment(uuid, jsonb) from public, anon;
grant execute on function public.phase2_submit_assessment(uuid, jsonb) to authenticated;

-- Serialized per-user 12 requests per rolling minute, across application instances.
create or replace function public.phase2_claim_ai_request()
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_count integer;
begin
  if v_uid is null then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 2));
  delete from public.phase2_ai_request_events where user_id = v_uid and requested_at < now() - interval '24 hours';
  select count(*) into v_count from public.phase2_ai_request_events where user_id = v_uid and requested_at >= now() - interval '1 minute';
  if v_count >= 12 then return false; end if;
  insert into public.phase2_ai_request_events(user_id) values (v_uid);
  return true;
end $$;
revoke all on function public.phase2_claim_ai_request() from public, anon;
grant execute on function public.phase2_claim_ai_request() to authenticated;

-- AI roadmap output is validated and created atomically for the caller; no caller-supplied owner ID.
create or replace function public.phase2_create_roadmap(p_title text, p_domain text, p_summary text, p_weekly_hours smallint, p_ai_generated boolean, p_tasks jsonb)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid := gen_random_uuid();
  v_task jsonb;
  v_position integer := 0;
begin
  if v_uid is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if length(trim(coalesce(p_title,''))) not between 2 and 120 or length(trim(coalesce(p_domain,''))) not between 2 and 100 then raise exception 'invalid roadmap details'; end if;
  if p_weekly_hours not between 1 and 40 or p_tasks is null or jsonb_typeof(p_tasks) is distinct from 'array' then raise exception 'invalid roadmap plan'; end if;
  if jsonb_array_length(p_tasks) not between 4 and 10 then raise exception 'invalid roadmap plan'; end if;
  insert into public.phase2_roadmaps(id, user_id, title, domain, summary, weekly_hours, ai_generated)
  values (v_id, v_uid, trim(p_title), trim(p_domain), left(coalesce(p_summary,''),3000), p_weekly_hours, coalesce(p_ai_generated,false));
  for v_task in select value from jsonb_array_elements(p_tasks) loop
    if length(trim(coalesce(v_task->>'title',''))) not between 2 and 180 or length(trim(coalesce(v_task->>'phase',''))) not between 2 and 80 then raise exception 'invalid roadmap task'; end if;
    insert into public.phase2_roadmap_tasks(roadmap_id,title,phase,description,estimated_hours,position)
    values (v_id,trim(v_task->>'title'),trim(v_task->>'phase'),left(coalesce(v_task->>'description',''),2000),greatest(1,least(100,coalesce((v_task->>'estimatedHours')::integer,1))),v_position);
    v_position := v_position + 1;
  end loop;
  return v_id;
end $$;
revoke all on function public.phase2_create_roadmap(text, text, text, smallint, boolean, jsonb) from public, anon;
grant execute on function public.phase2_create_roadmap(text, text, text, smallint, boolean, jsonb) to authenticated;


-- Persist each conversation turn atomically and bind it to auth.uid().
create or replace function public.phase2_save_chat_turn(p_conversation_id uuid, p_title text, p_user_content text, p_assistant_content text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_conversation uuid := p_conversation_id;
begin
  if v_uid is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if length(trim(coalesce(p_user_content,''))) not between 1 and 4000 or length(trim(coalesce(p_assistant_content,''))) not between 1 and 6000 then raise exception 'invalid message'; end if;
  if v_conversation is null then
    insert into public.phase2_conversations(user_id,title)
    values (v_uid,left(trim(coalesce(nullif(p_title,''),'Learning conversation')),100))
    returning id into v_conversation;
  else
    update public.phase2_conversations set updated_at = now()
    where id = v_conversation and user_id = v_uid;
    if not found then raise exception 'conversation not found' using errcode = 'P0002'; end if;
  end if;
  insert into public.phase2_messages(conversation_id,role,content)
  values (v_conversation,'user',trim(p_user_content)),(v_conversation,'assistant',trim(p_assistant_content));
  return v_conversation;
end $$;
revoke all on function public.phase2_save_chat_turn(uuid, text, text, text) from public, anon;
grant execute on function public.phase2_save_chat_turn(uuid, text, text, text) to authenticated;
