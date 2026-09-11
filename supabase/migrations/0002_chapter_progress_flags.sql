-- ============================================================================
-- PREPIFY — Migration 0002: replace tri-state progress_level with three
-- independent per-chapter flags: lectures_done, notes_done, revision_done.
-- Run this in the Supabase SQL Editor after 0001_init.sql.
-- ============================================================================

alter table public.chapters
  drop constraint if exists chapter_progress_valid;

alter table public.chapters
  drop column if exists progress_level;

alter table public.chapters
  add column if not exists lectures_done boolean not null default false;

alter table public.chapters
  add column if not exists notes_done boolean not null default false;

alter table public.chapters
  add column if not exists revision_done boolean not null default false;

-- No RLS changes needed — existing chapter policies already cover the whole
-- row (including these new columns) based on user_id / auth.uid().
