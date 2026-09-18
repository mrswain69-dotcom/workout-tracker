# Phase 5 / Stage 0 — Dashboard + Navigation Architecture

## Purpose

Turn Workout Tracker's authenticated landing experience into a concise performance dashboard rather than dropping directly into data entry.

## Primary navigation

The permanent athlete-facing navigation is:

- Dashboard
- Log
- Progress
- Rewards

Groups remains behind the people icon next to the active profile. Plan, Assessments, Connections and application/account controls remain behind Settings.

## Dashboard contract

Dashboard answers:

1. What should I do today?
2. How am I doing this week?
3. What happened recently that matters?

It contains:

- deterministic Performance Coach message;
- Today / Plan Streak / XP This Week / Next Reward orientation metrics;
- today's active plan with direct Log entry;
- weekly XP and completed/active/recovery-day summary;
- progress highlights;
- group membership context when present;
- connected/verified activity context when present;
- assessment/upcoming context when present;
- Rewards route.

Empty optional surfaces do not occupy space.

## XP hierarchy

Weekly XP is the primary short-horizon number on Dashboard and Rewards. Lifetime XP remains visible as secondary context and continues to be the authority for avatar/reward unlocks.

## Motivation/streak placement

The former global streak/motivator strip is removed from Log, Progress and Settings. Coaching/motivation appears on Dashboard. Streak remains visible on Dashboard and Rewards where it is directly relevant.

## Settings information architecture

Settings sub-navigation is:

- People
- Plan
- Assessments
- Connections
- App

The user-facing word "Manage" is retired from navigation.

## Safety / authority

Stage 0 does not invent Smart Performance conclusions. The first Performance Coach messages are deterministic summaries from existing trusted state: recovery mode, today's plan status, current streak, current-week XP and completed plan days.

Group, connected-activity and assessment cards are read-only context. No scoring, XP, plan or history authority changes are introduced by Dashboard.
