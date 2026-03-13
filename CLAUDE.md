# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Environment Variables & Secrets

- Never read, modify, or commit `.env` or `.env.local` files
- All environment variable names are documented in `.env.example` files
- When writing code that uses env variables, reference the names from
  `.env.example` — never hardcode values
- If a new variable is needed, add the name (with no value) to `.env.example`
  and tell the user to populate `.env` themselves

## Project Overview

A web-based fitness tracking app where users can log workouts, track progress over time, and visualize their data through charts. Cross-platform via browser (iOS-friendly). Data is persisted remotely in a PostgreSQL database so progress is accessible from any device.

---

## Maintaining This File

This CLAUDE.md is the single source of truth for the project. When making
changes that affect architecture, tech stack, folder structure, or conventions,
update this file as part of the same task — not as an afterthought.

Changes that should trigger a CLAUDE.md update:
- Adding or removing a package or library
- Changing the folder structure
- Adding new environment variables (add to .env.example too)
- Adding new pages or major features
- Any change to the database schema
- Changing build or deployment configuration

---

## Commands

All commands run from the repo root unless noted.

```bash
npm run dev          # start packages/client dev server (Vite HMR, port 5173)
npm run build        # tsc -b type-check then vite production build
npm run typecheck --workspace=packages/client   # type-check only
npm run lint --workspace=packages/client        # ESLint
```

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite 7 + TypeScript 5 (strict) + Tailwind CSS v4 |
| Routing | React Router v7 |
| Database & Auth | Supabase (PostgreSQL + Auth + RLS) |
| Charts | Recharts |
| Hosting | Netlify (frontend) |

---

## TypeScript Config

- `tsconfig.base.json` (root) — shared strict options; all packages extend this
- `packages/client/tsconfig.json` — app source (`src/`), `noEmit`, references `tsconfig.node.json`
- `packages/client/tsconfig.node.json` — `vite.config.ts` only, `composite: true`
- Build uses `tsc -b` (project-references mode), not `tsc --noEmit`

## Architecture

### Current

```
[React App — Netlify]
        │
        │  Supabase JS SDK
        ▼
[Supabase]
  ├── PostgreSQL DB       (workouts, sets, exercises)
  ├── Auth                (email/password)
  └── Row-Level Security  (users only access their own data)
```

No custom backend server. The React frontend communicates directly with Supabase.

### Future (when a backend is added)

```
[React App — Netlify]
        │
        │  REST / fetch
        ▼
[Express API — Railway/Render]
        │
        │  Supabase JS SDK (server-side)
        ▼
[Supabase — PostgreSQL]
```

The `packages/server/` directory is already scaffolded for this. See the **Adding a Backend** section below.

---

## Folder Structure

The project uses a monorepo layout with npm workspaces so a backend can be added later without moving files around. Currently only `packages/client` is active.

```
MyFitnessApp/
├── package.json                     # Root workspace config (packages/*, shared)
├── tsconfig.base.json               # Shared TS compiler options
├── packages/
│   ├── client/                      # ← Active: React SPA
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── ProtectedRoute.tsx  # Redirects unauthenticated users to /auth
│   │   │   │   ├── ui/              # Reusable: Button, Input, Modal, Card (planned)
│   │   │   │   ├── workouts/        # WorkoutCard, WorkoutForm, WorkoutList (planned)
│   │   │   │   ├── exercises/       # ExerciseSelector, ExerciseCard (planned)
│   │   │   │   ├── charts/          # VolumeChart, PRChart, ProgressChart (planned)
│   │   │   │   └── layout/          # Navbar, Sidebar, PageWrapper (planned)
│   │   │   ├── context/
│   │   │   │   └── AuthContext.tsx  # AuthProvider + useAuth(); user, loading, signIn/Up/Out
│   │   │   ├── lib/
│   │   │   │   └── supabase.ts      # Supabase client singleton
│   │   │   ├── pages/
│   │   │   │   ├── Auth.tsx         # Login/signup toggle; redirects if already authed
│   │   │   │   ├── Dashboard.tsx    # Overview + recent workouts (planned)
│   │   │   │   ├── LogWorkout.tsx   # Active workout logging (planned)
│   │   │   │   ├── History.tsx      # Past workouts (planned)
│   │   │   │   ├── Progress.tsx     # Charts & visualizations (planned)
│   │   │   │   └── Metrics.tsx      # Body metrics logging + progress chart
│   │   │   ├── hooks/               # useWorkouts, useExercises, useBodyMetrics
│   │   │   ├── vite-env.d.ts        # Typed ImportMetaEnv for VITE_ vars
│   │   │   ├── App.tsx              # Route definitions
│   │   │   └── main.tsx             # Entry: BrowserRouter > AuthProvider > App
│   │   ├── public/
│   │   │   └── _redirects           # Netlify client-side routing fix
│   │   ├── .env                     # VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY (git-ignored)
│   │   ├── .env.example             # Variable names without values
│   │   ├── tsconfig.json            # App source tsconfig (noEmit, references node)
│   │   ├── tsconfig.node.json       # vite.config.ts tsconfig (composite)
│   │   ├── vite.config.ts
│   │   └── package.json
│   │
│   └── server/                      # ← Placeholder: not active yet
│       └── .gitkeep
│
└── shared/                          # ← Placeholder: shared types across packages
    └── .gitkeep
```

### Auth Flow

- `AuthProvider` calls `supabase.auth.getSession()` on mount, then subscribes to `onAuthStateChange`
- `loading: true` until the initial session resolves — `ProtectedRoute` and `Auth` both return `null` while loading
- Unauthenticated users hitting any protected route → redirect to `/auth`
- Authenticated users hitting `/auth` → redirect to `/`
- Route layout in `App.tsx`: `/auth` (public), `/` (protected), `*` → `/`

---

## Database Schema

Run this in the Supabase SQL editor to set up the database.

```sql
-- Exercise library (built-in + user-created)
CREATE TABLE exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  muscle_group TEXT,
  type TEXT DEFAULT 'strength', -- 'strength' | 'cardio' | 'bodyweight'
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- NULL = built-in default
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see shared and own exercises"
  ON exercises FOR SELECT
  USING (user_id IS NULL OR auth.uid() = user_id);

CREATE POLICY "Users insert own exercises"
  ON exercises FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own exercises"
  ON exercises FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own exercises"
  ON exercises FOR DELETE
  USING (auth.uid() = user_id);

-- Workout sessions (one per gym visit)
CREATE TABLE workouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  title TEXT,
  notes TEXT,
  duration_minutes INT,
  is_rest_day BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Individual sets within a workout
CREATE TABLE workout_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id UUID REFERENCES workouts(id) ON DELETE CASCADE,
  exercise_id UUID REFERENCES exercises(id),
  set_number INT,
  reps INT,
  weight_kg NUMERIC(6,2),
  duration_seconds INT,
  distance_meters NUMERIC(8,2),
  rpe INT CHECK (rpe BETWEEN 1 AND 10),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own workouts"
  ON workouts FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users see own sets"
  ON workout_sets FOR ALL
  USING (workout_id IN (SELECT id FROM workouts WHERE user_id = auth.uid()));

-- Body metrics (weight, height, body fat %, muscle mass)
CREATE TABLE body_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  weight_kg NUMERIC(5,2),
  height_cm NUMERIC(5,1),
  body_fat_pct NUMERIC(4,1),
  muscle_mass_kg NUMERIC(5,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE body_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own body metrics"
  ON body_metrics FOR ALL USING (auth.uid() = user_id);

-- Workout templates
CREATE TABLE workout_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE workout_template_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES workout_templates(id) ON DELETE CASCADE,
  exercise_id UUID REFERENCES exercises(id),
  order_index INT NOT NULL,
  default_sets INT NOT NULL DEFAULT 1
);

ALTER TABLE workout_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_template_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own templates"
  ON workout_templates FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users see own template exercises"
  ON workout_template_exercises FOR ALL
  USING (template_id IN (SELECT id FROM workout_templates WHERE user_id = auth.uid()));

-- Muscle groups (shared defaults + user custom)
CREATE TABLE muscle_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- NULL = built-in default
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE muscle_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see defaults and own muscle groups"
  ON muscle_groups FOR SELECT
  USING (user_id IS NULL OR auth.uid() = user_id);

CREATE POLICY "Users insert own muscle groups"
  ON muscle_groups FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own muscle groups"
  ON muscle_groups FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own muscle groups"
  ON muscle_groups FOR DELETE
  USING (auth.uid() = user_id);

-- Seed default muscle groups
INSERT INTO muscle_groups (name, user_id) VALUES
  ('chest', NULL), ('back', NULL), ('shoulders', NULL),
  ('biceps', NULL), ('triceps', NULL), ('legs', NULL),
  ('core', NULL), ('cardio', NULL);

-- Seed common exercises
INSERT INTO exercises (name, muscle_group, type) VALUES
  ('Bench Press', 'chest', 'strength'),
  ('Squat', 'legs', 'strength'),
  ('Deadlift', 'back', 'strength'),
  ('Pull Up', 'back', 'bodyweight'),
  ('Overhead Press', 'shoulders', 'strength'),
  ('Barbell Row', 'back', 'strength'),
  ('Dumbbell Curl', 'biceps', 'strength'),
  ('Tricep Pushdown', 'triceps', 'strength'),
  ('Running', NULL, 'cardio'),
  ('Cycling', NULL, 'cardio');
```

---

## Pages & Features

### Dashboard (`/`)
- Summary stats: workouts this week, total volume, current streak
- Recent workout cards
- Quick-log button

### Log Workout (`/log`)
- Pick date and optional title
- Search and select exercises from the library
- Add sets with reps, weight (or duration/distance for cardio)
- Optional RPE per set
- Save entire session in one action

### History (`/history`)
- List of all past workouts, sorted by date
- Click to expand and see full set breakdown

### Progress (`/progress`)
- Line chart: total weekly volume over last 12 weeks
- Per-exercise personal record tracker
- (Future) body weight trend if logging is added

### Metrics (`/metrics`)
- Log body measurements: weight (kg), height (cm), body fat %, muscle mass (kg)
- All fields optional except date — log just what you track
- Latest snapshot cards showing most recent value per metric
- Line chart (Recharts) with toggle between weight / body fat / muscle mass
- History table of all past entries

### Auth (`/auth`)
- Email/password sign up and login via Supabase Auth
- Redirect to Dashboard on success

---

## Build Order (remaining)

1. **Log Workout** — the core loop: select exercise → log sets → save
2. **History** — read back what was logged
3. **Progress** — visualize the data with Recharts

---

## Netlify Configuration

Point Netlify at the `packages/client` subfolder:

```
Base directory:  packages/client
Build command:   npm run build
Publish dir:     packages/client/dist
```

The `public/_redirects` file handles client-side routing:
```
/*  /index.html  200
```

Set environment variables in *Netlify Dashboard → Site Settings → Environment Variables*.

---

## Environment Variables

```
# packages/client/.env   (git-ignored; copy from .env.example)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Only `VITE_` prefixed vars are exposed to the browser bundle. Never commit `.env`.

---

---

## Suggested Claude Code Prompts

```
# 1. Project setup
"Scaffold a Vite + React project inside packages/client. Install and
configure Supabase, React Router v6, and Tailwind CSS."

# 2. Auth
"Create an AuthContext in packages/client/src/context/AuthContext.jsx
that exposes the current user, signIn, signOut, and signUp using the
Supabase client in src/lib/supabase.js"

# 3. Core logging feature
"Build a LogWorkout page where I can pick a date, add exercises from a
searchable list, and log sets with reps and weight. Save to Supabase
using the workouts and workout_sets tables."

# 4. Visualizations
"Create a Progress page with a Recharts line chart showing total weekly
volume (sum of reps × weight_kg) over the last 12 weeks, fetched from Supabase"
```

---

## Adding a Backend (Future)

When ready to introduce a backend, no files in `packages/client` need to move. Steps:

1. Scaffold an Express app inside `packages/server/`
2. Move Supabase queries from the client into server route handlers
3. Update the client to call `fetch('/api/...')` instead of Supabase directly
4. Update root `package.json` dev script to run both packages with `concurrently`
5. Move any shared TypeScript types into `shared/types/` and import from both packages

The frontend and backend remain fully independent — they only share code via `shared/`.

---

## Future Feature Ideas

- Body weight logging + trend chart
- Workout templates / programs
- Rest timer between sets
- AI-generated workout suggestions via Claude API
- Export data to CSV

## Git Workflow

- After completing each task, stage and commit the changes with a 
  descriptive commit message following conventional commits format:
  feat: add auth context and protected routes
  fix: correct Supabase client initialisation
  chore: update CLAUDE.md to reflect TypeScript migration

- Never push automatically — always stop after committing and let 
  the user push manually
- Never commit .env.local or any secrets
- Never commit directly to main — if a task is large, create a 
  feature branch first and tell the user