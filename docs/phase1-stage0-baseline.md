# Phase 1 Sessions — Stage 0 Baseline

Captured: 2026-09-08

## GitHub baseline

- Repository: `mrswain69-dotcom/workout-tracker`
- Production branch: `main`
- Baseline commit: `448505f8e9df3633d783a6f917e33fc8501e4e7d`
- Baseline commit message: `Avatar background prestige`
- Feature branch: `feature/phase1-sessions`

## Supabase baseline

Project: `Workout Tracker`

- Existing workout logs: **499**
- Block-based logs: **467**
- Legacy/non-block logs: **32**
- First log date: **2025-12-29**
- Last log date: **2026-08-31**
- Aggregate historical log checksum: `543a03189e05aee5c16cfc2521561c2c`

### Profile snapshots

| Profile | Logs | First | Last | Plan hash | Log hash |
| --- | ---: | --- | --- | --- | --- |
| Paul | 152 | 2026-01-06 | 2026-08-31 | `a715c519932be388cebe88722439de8b` | `67e339ad7023b7e521a6449436ef0ac1` |
| Wilf | 161 | 2025-12-29 | 2026-08-11 | `de573b2c54289bf663a71bdd3831ff7a` | `a9bab85a52dfd4a528400bf31733b605` |
| Xander | 186 | 2025-12-29 | 2026-07-20 | `cc670b7811e0768f2ec6252030b9b371` | `0396a5c68afdf248f676138cac7645c6` |

## Stage 1 migration verification

Migration: `phase1_session_foundation`

Created additive tables:

- `programmes`
- `movements`
- `session_templates`
- `session_template_movements`
- `development_tags`
- `movement_development_tags`

All six tables have Row Level Security enabled.

The migration also pins `public.set_updated_at()` to `search_path = public`, clearing the previous Supabase security-advisor warning for a mutable function search path.

Immediately after migration, the historical logs remained at 499 records and the aggregate checksum remained:

`543a03189e05aee5c16cfc2521561c2c`

This proves the Stage 1 schema migration did not modify historical workout log JSON.

## Build verification note

The current execution sandbox cannot resolve `github.com` for a direct `git clone`, so a local `npm ci && npm run build` baseline could not be run from that sandbox. GitHub source access and writes are available through the connected GitHub integration. Build verification remains a required gate before merging/deploying application-code changes.
