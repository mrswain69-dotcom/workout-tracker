# Verification Integrations — Stage 7.2 Interaction & Control

## Purpose

Stage 7.2 makes verification understandable and reversible in day-to-day use without changing Workout Tracker history authority or reward authority.

The everyday UI should remain quiet. A compact verification indicator carries the normal state; provenance, manual matching, source checks and destructive controls live behind deliberate clicks.

## Authority rules

- Workout Tracker plans/logs remain the training record.
- External provider observations remain evidence about real-world activity.
- Verification stays reward-neutral (`0` bonus XP; multiplier `1`).
- A user may resolve ambiguity but may not override incompatibility.
- One physical verified activity may claim at most one Workout Tracker target.
- Cross-provider duplicates remain one canonical physical activity.
- Provider removal/deletion must never erase genuinely manual Workout Tracker edits.

## Verification display model

Primary block-level states:

- `verified` — all verification-eligible components are supported.
- `partial` — some components or only the overall session are externally supported.
- `unverified` — no compatible external evidence is currently attached.

Detail can expose component/session scope, providers, objective metrics, performed date and match method.

## Matching dates

Three times are distinct:

1. scheduled Workout Tracker date;
2. Workout Tracker completion/entry time;
3. external performed time.

Automatic same-day matching remains safest. User-assisted catch-up matching may use a maximum ±2-day schedule window. A later stage will use block completion timestamps as an additional automatic confidence signal.

## Manual source check

A connected athlete may request a provider check, but the server enforces a five-minute cooldown. Browser disabling is convenience only; the server timestamp is authoritative. Re-imports remain idempotent.

## Connection history controls

Connection preferences separate:

- provider history imported on connect/reconnect: now, 7, 30, 90 or 365 days;
- recent Workout Tracker log auto-population window reserved for Stage 7.3: today through the previous 0–3 days.

Importing evidence does not itself authorize historical Workout Tracker log creation.

## Reversible controls

The interaction layer supports:

- ignore/unignore an external physical activity;
- detach a verification match and suppress immediate automatic reattachment;
- user-confirm a compatible match;
- disconnect while retaining evidence/history;
- disconnect and remove that provider's stored evidence;
- retain a server-only audit trail of these actions.

If other providers still support the same physical activity, removing one provider does not invalidate the remaining evidence.

## Stage 7.3 hand-off

Stage 7.3 may populate compatible empty planned blocks and create additional verified blocks. Every imported field/block must carry provenance so it can be undone independently of manual data.

`+ Extra block for today` must also expose structured Sessions; provider evidence must not silently create a structured Session.
