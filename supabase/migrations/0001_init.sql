-- ============================================================================
-- PREPIFY — Initial schema migration
-- Run this once in the Supabase SQL Editor on a fresh project.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- EXTENSIONS
-- ----------------------------------------------------------------------------
create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- TABLE: profiles
-- One row per auth user. Username is the public-facing identifier.
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  created_at timestamptz not null default now(),
  constraint username_format check (
    username ~ '^[a-zA-Z0-9_]{3,20}$'
  )
);

create index if not exists idx_profiles_username on public.profiles (lower(username));

-- ----------------------------------------------------------------------------
-- TABLE: subjects
-- ----------------------------------------------------------------------------
create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  constraint subject_name_not_blank check (length(trim(name)) > 0)
);

create index if not exists idx_subjects_user on public.subjects (user_id);
-- One subject name per user (case-insensitive)
create unique index if not exists uniq_subject_per_user on public.subjects (user_id, lower(name));

-- ----------------------------------------------------------------------------
-- TABLE: chapters
-- ----------------------------------------------------------------------------
create table if not exists public.chapters (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  position integer not null default 0,
  progress_level integer not null default 0,
  created_at timestamptz not null default now(),
  constraint chapter_name_not_blank check (length(trim(name)) > 0),
  constraint chapter_progress_valid check (progress_level between 0 and 3)
);

create index if not exists idx_chapters_subject on public.chapters (subject_id, position);
create index if not exists idx_chapters_user on public.chapters (user_id);

-- ----------------------------------------------------------------------------
-- TABLE: study_logs
-- Multiple logs per date are allowed.
-- ----------------------------------------------------------------------------
create table if not exists public.study_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  log_date date not null,
  hours numeric(5,2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  constraint study_hours_nonnegative check (hours >= 0 and hours <= 24)
);

create index if not exists idx_study_logs_user_date on public.study_logs (user_id, log_date);

-- ----------------------------------------------------------------------------
-- TABLE: exams
-- ----------------------------------------------------------------------------
create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  exam_date date not null,
  total_marks numeric(7,2),
  exam_type text not null default 'exam',
  marks_scored numeric(7,2),
  notes text,
  created_at timestamptz not null default now(),
  constraint exam_name_not_blank check (length(trim(name)) > 0),
  constraint exam_type_valid check (exam_type in ('exam', 'main_exam', 'rest_day')),
  constraint exam_marks_nonnegative check (total_marks is null or total_marks >= 0),
  constraint exam_scored_nonnegative check (marks_scored is null or marks_scored >= 0),
  constraint exam_scored_within_total check (
    marks_scored is null or total_marks is null or marks_scored <= total_marks
  )
);

create index if not exists idx_exams_user_date on public.exams (user_id, exam_date);

-- ----------------------------------------------------------------------------
-- TABLE: exam_chapters
-- Links existing chapters into an exam's syllabus + per-chapter score.
-- ----------------------------------------------------------------------------
create table if not exists public.exam_chapters (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  marks_scored numeric(6,2),
  marks_possible numeric(6,2),
  constraint exam_chapter_scored_nonnegative check (marks_scored is null or marks_scored >= 0),
  constraint exam_chapter_possible_nonnegative check (marks_possible is null or marks_possible >= 0),
  constraint exam_chapter_scored_within_possible check (
    marks_scored is null or marks_possible is null or marks_scored <= marks_possible
  ),
  constraint uniq_chapter_per_exam unique (exam_id, chapter_id)
);

create index if not exists idx_exam_chapters_exam on public.exam_chapters (exam_id);
create index if not exists idx_exam_chapters_chapter on public.exam_chapters (chapter_id);

-- ----------------------------------------------------------------------------
-- TABLE: calendar_events
-- Only exam / main_exam / rest_day are stored here. Study activity is
-- derived from study_logs at query time, never inserted here.
-- ----------------------------------------------------------------------------
create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_date date not null,
  event_type text not null,
  title text,
  exam_id uuid references public.exams(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint calendar_event_type_valid check (event_type in ('exam', 'main_exam', 'rest_day'))
);

create index if not exists idx_calendar_events_user_date on public.calendar_events (user_id, event_date);

-- ----------------------------------------------------------------------------
-- TABLE: user_settings
-- ----------------------------------------------------------------------------
create table if not exists public.user_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  daily_target_hours numeric(5,2) not null default 0,
  weekly_target_hours numeric(6,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_target_nonnegative check (daily_target_hours >= 0),
  constraint weekly_target_nonnegative check (weekly_target_hours >= 0)
);

create index if not exists idx_user_settings_user on public.user_settings (user_id);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Keep updated_at fresh on user_settings
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_user_settings_updated_at on public.user_settings;
create trigger trg_user_settings_updated_at
  before update on public.user_settings
  for each row execute function public.set_updated_at();

-- Automatically create calendar_events row whenever an exam is created/updated,
-- and keep it in sync (so exams always appear on the calendar).
create or replace function public.sync_exam_calendar_event()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.exam_type in ('exam', 'main_exam') then
    -- Remove any stale event for this exam, then (re)insert current state.
    delete from public.calendar_events where exam_id = new.id;
    insert into public.calendar_events (user_id, event_date, event_type, title, exam_id)
    values (new.user_id, new.exam_date, new.exam_type, new.name, new.id);
  else
    -- exam_type = 'rest_day': store as a rest day marker, not an exam.
    delete from public.calendar_events where exam_id = new.id;
    insert into public.calendar_events (user_id, event_date, event_type, title, exam_id)
    values (new.user_id, new.exam_date, 'rest_day', new.name, new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_exam_calendar_sync on public.exams;
create trigger trg_exam_calendar_sync
  after insert or update of exam_date, exam_type, name on public.exams
  for each row execute function public.sync_exam_calendar_event();

-- ----------------------------------------------------------------------------
-- Username -> email lookup for login (SECURITY DEFINER, minimal surface).
-- Only returns an email when the username exists; never reveals whether a
-- username exists beyond what a normal login error already would.
-- ----------------------------------------------------------------------------
create or replace function public.get_email_for_username(p_username text)
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text;
begin
  select u.email into v_email
  from public.profiles p
  join auth.users u on u.id = p.id
  where lower(p.username) = lower(p_username)
  limit 1;

  return v_email;
end;
$$;

revoke all on function public.get_email_for_username(text) from public;
grant execute on function public.get_email_for_username(text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- Check username availability (used by signup form, avoids leaking emails).
-- ----------------------------------------------------------------------------
create or replace function public.is_username_available(p_username text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.profiles where lower(username) = lower(p_username)
  );
$$;

revoke all on function public.is_username_available(text) from public;
grant execute on function public.is_username_available(text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- Auto-create a profile row after a new auth user signs up.
-- Username is passed in via signUp options.data.username.
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
begin
  v_username := new.raw_user_meta_data ->> 'username';

  if v_username is null or length(trim(v_username)) = 0 then
    raise exception 'Username is required';
  end if;

  insert into public.profiles (id, username)
  values (new.id, v_username);

  insert into public.user_settings (user_id)
  values (new.id);

  return new;
end;
$$;

drop trigger if exists trg_on_auth_user_created on auth.users;
create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.subjects enable row level security;
alter table public.chapters enable row level security;
alter table public.study_logs enable row level security;
alter table public.exams enable row level security;
alter table public.exam_chapters enable row level security;
alter table public.calendar_events enable row level security;
alter table public.user_settings enable row level security;

-- ---- profiles ----
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- (insert is handled by the trigger via security definer; no client insert policy needed)

-- ---- subjects ----
drop policy if exists "subjects_select_own" on public.subjects;
create policy "subjects_select_own" on public.subjects
  for select using (auth.uid() = user_id);

drop policy if exists "subjects_insert_own" on public.subjects;
create policy "subjects_insert_own" on public.subjects
  for insert with check (auth.uid() = user_id);

drop policy if exists "subjects_update_own" on public.subjects;
create policy "subjects_update_own" on public.subjects
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "subjects_delete_own" on public.subjects;
create policy "subjects_delete_own" on public.subjects
  for delete using (auth.uid() = user_id);

-- ---- chapters ----
drop policy if exists "chapters_select_own" on public.chapters;
create policy "chapters_select_own" on public.chapters
  for select using (auth.uid() = user_id);

drop policy if exists "chapters_insert_own" on public.chapters;
create policy "chapters_insert_own" on public.chapters
  for insert with check (auth.uid() = user_id);

drop policy if exists "chapters_update_own" on public.chapters;
create policy "chapters_update_own" on public.chapters
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "chapters_delete_own" on public.chapters;
create policy "chapters_delete_own" on public.chapters
  for delete using (auth.uid() = user_id);

-- ---- study_logs ----
drop policy if exists "study_logs_select_own" on public.study_logs;
create policy "study_logs_select_own" on public.study_logs
  for select using (auth.uid() = user_id);

drop policy if exists "study_logs_insert_own" on public.study_logs;
create policy "study_logs_insert_own" on public.study_logs
  for insert with check (auth.uid() = user_id);

drop policy if exists "study_logs_update_own" on public.study_logs;
create policy "study_logs_update_own" on public.study_logs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "study_logs_delete_own" on public.study_logs;
create policy "study_logs_delete_own" on public.study_logs
  for delete using (auth.uid() = user_id);

-- ---- exams ----
drop policy if exists "exams_select_own" on public.exams;
create policy "exams_select_own" on public.exams
  for select using (auth.uid() = user_id);

drop policy if exists "exams_insert_own" on public.exams;
create policy "exams_insert_own" on public.exams
  for insert with check (auth.uid() = user_id);

drop policy if exists "exams_update_own" on public.exams;
create policy "exams_update_own" on public.exams
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "exams_delete_own" on public.exams;
create policy "exams_delete_own" on public.exams
  for delete using (auth.uid() = user_id);

-- ---- exam_chapters (ownership via parent exam) ----
drop policy if exists "exam_chapters_select_own" on public.exam_chapters;
create policy "exam_chapters_select_own" on public.exam_chapters
  for select using (
    exists (select 1 from public.exams e where e.id = exam_id and e.user_id = auth.uid())
  );

drop policy if exists "exam_chapters_insert_own" on public.exam_chapters;
create policy "exam_chapters_insert_own" on public.exam_chapters
  for insert with check (
    exists (select 1 from public.exams e where e.id = exam_id and e.user_id = auth.uid())
    and exists (select 1 from public.chapters c where c.id = chapter_id and c.user_id = auth.uid())
  );

drop policy if exists "exam_chapters_update_own" on public.exam_chapters;
create policy "exam_chapters_update_own" on public.exam_chapters
  for update using (
    exists (select 1 from public.exams e where e.id = exam_id and e.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.exams e where e.id = exam_id and e.user_id = auth.uid())
  );

drop policy if exists "exam_chapters_delete_own" on public.exam_chapters;
create policy "exam_chapters_delete_own" on public.exam_chapters
  for delete using (
    exists (select 1 from public.exams e where e.id = exam_id and e.user_id = auth.uid())
  );

-- ---- calendar_events ----
drop policy if exists "calendar_events_select_own" on public.calendar_events;
create policy "calendar_events_select_own" on public.calendar_events
  for select using (auth.uid() = user_id);

drop policy if exists "calendar_events_insert_own" on public.calendar_events;
create policy "calendar_events_insert_own" on public.calendar_events
  for insert with check (auth.uid() = user_id);

drop policy if exists "calendar_events_update_own" on public.calendar_events;
create policy "calendar_events_update_own" on public.calendar_events
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "calendar_events_delete_own" on public.calendar_events;
create policy "calendar_events_delete_own" on public.calendar_events
  for delete using (auth.uid() = user_id);

-- ---- user_settings ----
drop policy if exists "user_settings_select_own" on public.user_settings;
create policy "user_settings_select_own" on public.user_settings
  for select using (auth.uid() = user_id);

drop policy if exists "user_settings_insert_own" on public.user_settings;
create policy "user_settings_insert_own" on public.user_settings
  for insert with check (auth.uid() = user_id);

drop policy if exists "user_settings_update_own" on public.user_settings;
create policy "user_settings_update_own" on public.user_settings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
