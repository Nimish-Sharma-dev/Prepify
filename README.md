# Prepify

A simple, fast study progress tracker. React + TypeScript + Tailwind CSS on the frontend, Supabase (Auth + Postgres + RLS) on the backend.

No AI features, no gamification beyond the study streak, no social features. Just subjects, chapters, daily logs, exams, and a calendar — all backed by real Supabase data.

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Open the **SQL Editor** and run the entire contents of `supabase/migrations/0001_init.sql`. This creates every table, constraint, index, RLS policy, function, and trigger needed by the app.
3. In **Project Settings → API**, copy your **Project URL** and **anon public key**.
4. In **Authentication → Providers**, make sure **Email** sign-in is enabled (it is by default). You can turn off "Confirm email" under **Authentication → Sign In / Providers → Email** for a smoother signup flow during testing, since usernames map to internal placeholder emails the user never sees.

## 2. Configure the frontend

```bash
cp .env.example .env
```

Fill in:

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

## 3. Install and run

```bash
npm install
npm run dev
```

Open the printed local URL. Create an account from the login screen (username + password), then log in.

## How username login works

Supabase Auth is natively email/password based. To let users log in with just a username:

- On signup, the client generates a deterministic internal email (`username@users.prepify.internal`) that is never shown anywhere in the UI, and calls `supabase.auth.signUp` with it plus the chosen username in user metadata.
- A database trigger (`handle_new_user`) reads that metadata and creates the matching `profiles` row and a default `user_settings` row, inside the same transaction as the auth user — so a duplicate username fails the whole signup atomically.
- On login, the client calls a `SECURITY DEFINER` RPC, `get_email_for_username`, which looks up the internal email for a username. The anon key never gets direct read access to `auth.users`; only this narrow function does, and only to resolve an email for sign-in.
- Passwords are always handled by Supabase Auth itself — the app never sees, stores, or hashes a password.

## Data model

See `supabase/migrations/0001_init.sql` for the full schema. In short:

- `profiles` — one row per user, holds the username.
- `subjects` → `chapters` — user-defined syllabus, chapters have a 0–3 `progress_level`.
- `study_logs` — one row per study session; a date is "active" on the calendar if at least one log exists for it.
- `exams` — exam/main_exam/rest_day entries with date, total marks, and score.
- `exam_chapters` — links chapters to exams for per-chapter syllabus + scores, without duplicating chapter data.
- `calendar_events` — auto-maintained by a trigger whenever an exam/rest day is created or edited, so exams and rest days always show on the calendar.
- `user_settings` — daily/weekly hour targets.

Every table has Row Level Security enabled with policies scoped to `auth.uid()`, so one user can never read or write another user's data — this is enforced at the database level, not just in the frontend.

## Project structure

```
src/
  components/     Layout, nav, loading/error/empty states
  contexts/       AuthContext (session, login, signup, logout)
  pages/          Calendar, Syllabus, Log, Exams, Dashboard, Login
  routes/         ProtectedRoute
  utils/          date helpers, streak/hours calculations
  types/          Row types matching the SQL schema
supabase/
  migrations/0001_init.sql   full schema, RLS, functions, triggers
```

## Notes

- Study streak, daily/weekly hours, and subject progress are all computed from live Supabase data on each page load — nothing is hardcoded or mocked.
- Rest days are stored as an `exams` row with `exam_type = 'rest_day'` (reusing the same table per the spec) and are mirrored onto `calendar_events`; they never touch `study_logs`, so they cannot count toward the streak.
- The three chapter ticks map to `progress_level`: 1 = completed, 2 = completed + revised, 3 = perfected. Clicking a tick sets progress to that tick, clicking an already-active tick clears it and everything after it.
