# Kids Workout Tracker (local-only, tablet-friendly)

## What it does
- Mon/Wed/Fri: HIIT/Strength (3 movements x 3 sets; reps + optional weight OR time)
- Tue: Run (distance + time; avg speed auto)
- Thu: Boxercise (3 movements x 3 x 60s; editable; optional count like hits/rounds)
- Stats: streak, top effort day, most improved this month, PRs
- Charts: weekly trend, per-exercise progress, run progress
- Fun: whoosh/bling per set, level-ups, badges, reward shop (sound themes)

## Requirements
Install Node.js (LTS) on your computer.

## Run locally (on your laptop/PC)
1) Open a terminal in this folder
2) Install deps:
   npm install
3) Run:
   npm run dev
4) Open the printed URL on your computer, OR on the tablets (same Wi‑Fi):
   - Vite prints something like: http://YOUR-LAPTOP-IP:5173
   - Open that URL in Chrome on each Samsung tablet.

## Deploy (so it works like an installed app on tablets)
Use any static host (HTTPS):
- Netlify, Vercel, Cloudflare Pages, GitHub Pages

Steps (typical):
1) Build:
   npm run build
2) Upload the `dist/` folder to your host

## Install on Samsung tablet (PWA)
1) Open the site in Chrome
2) Menu (⋮) → Add to Home screen
3) Launch from icon — feels like an app

## Notes
- Data is stored on each device (localStorage). No logins/cloud sync yet.
- Export/import JSON is available in Settings for backup.


## Online version (Parent login + Profiles)

This version supports a **single parent login** and multiple **profiles** (Wilf, Xander, etc.) under that account.

### Supabase setup (Auth + Database)
1) Create a Supabase project
2) Enable Email/Password auth
3) Create tables + RLS (SQL below)
4) Put your URL + anon key into `.env.local` (copy from `.env.example`)
5) `npm install` then `npm run dev`

### Deploy (recommended)
- Deploy to Vercel/Netlify (build: `npm run build`)
- Add the same environment variables in the host's dashboard

