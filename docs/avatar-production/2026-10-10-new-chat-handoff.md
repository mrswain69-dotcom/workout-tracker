# Paired sport avatars — new-chat handover, 10 October 2026

## User request and scope

Paul asked to finish every remaining sport collection, following the saved paired-avatar briefs. Continue autonomously, saving each reviewed pair to GitHub, then integrate, test, merge and verify production per complete collection. Do not restart completed art. This handover was requested because the chat became long, not because the work was cancelled. No further image generation was completed after the user interrupted Outdoor Rowing Silver male.

## Exact starting point

- Repository: `mrswain69-dotcom/workout-tracker`.
- Main at handover: `52c58b992560d6ea074267c3ac39a57634224284`.
- Working branch: `feature/outdoor-rowing-paired-avatars`.
- Branch checkpoint before this document: `bf4948f16e5eb7ecaccd8a3cf084bfecc40346b6`.
- Local repo: `/workspace/scratch/9a67ab8401a0/workout-tracker`. Scratch may disappear; GitHub is the durable source. Fetch current branch/main before continuing and inspect intervening changes.
- Outdoor Rowing has FOUR completed originals: Bronze male/female and Unreal male/female, all saved, validated and recorded. See `outdoor_rowing-production-record.json` and `production-status.json`.
- NEXT: Outdoor Rowing **Silver male**, then female. Its interrupted generation produced no saved result and no record entry. Do not assume a Silver asset exists.
- Then Gold, Platinum, Diamond, Elite, Champion pairs: twelve middle-tier portraits total. Complete and release Outdoor Rowing.
- Finally Yoga: all sixteen portraits. These are the only two collections remaining.
- Outdoor Rowing is not yet enabled in the app or database; no migration or PR exists for it.

## Completed and verified releases

Eleven collections are released: Football, Rugby, Cricket, Basketball, Tennis, Badminton, Netball, Hockey, Fencing, Martial Arts, Indoor Rowing.

Most recent releases:

| Collection | PR | Merge commit |
| --- | --- | --- |
| Fencing | 94 | `f4d0f282e32da6a4d22f1dd1650e79e6c9f1b581` |
| Martial Arts | 95 | `af3e8d2558cb362ce5e94f58c483ec6bbd2ac59e` |
| Indoor Rowing | 96 | `52c58b992560d6ea074267c3ac39a57634224284` |

Martial Arts and Indoor Rowing each passed: all sixteen PNG dimension/RGBA/alpha/hash checks; 196 test files / 1,191 tests in UTC; production build; rollback-only live database regression; GitHub CI; Vercel preview; production deployment. All sixteen live asset SHA-256 hashes matched each collection's saved originals. Prior releases were also verified; do not regenerate them.

## Read these canonical sources first

- `paired-sport-avatar-briefs.md` and `.json` (v1.2).
- `age-and-pose-refinement.md`.
- `remaining-sport-avatar-batches.md` and `.json`.
- `sol-light-production-handoff.md` — chronological checkpoints, some earlier counts are historical.
- `production-status.json` and the sport's production record.
- `scripts/sport_avatar_prompt.py` generates prompts locally; it does NOT call an image API.

Prompt example: `python scripts/sport_avatar_prompt.py --sport outdoor_rowing --tier silver --variant male`.

Tier order is Bronze, Silver, Gold, Platinum, Diamond, Elite, Champion, Unreal. There is no Pro avatar tier. Session thresholds remain 40/80/120/160/200/240/280/320. Claim XP remains 25/35/50/70/95/125/160/200. Both appearances share ONE existing logical reward key and one claim; no new XP.

Age targets: Bronze12–14; Silver15–17; Gold18–22; Platinum23–27; Diamond26–30; Elite28–33; Champion30–36; Unreal32–40. Preserve the individual's recognisable eyes, hair and skin while ageing face anatomy, not just adding muscle, beard or suit. Adult tiers must lose baby-faced proportions. Each tier needs a distinct pose/silhouette: introduction, medal recognition, readiness, walking, captain, celebration, awards group, formal portrait. Equal kit quality and award prestige across male/female; original varied character identities across sports.

## Outdoor Rowing direction

Male: light olive skin, short dark curly hair, hazel eyes. Female: light olive skin, dark curly hair tied back, hazel eyes. Their own saved Bronze and Unreal portraits establish identity and mature endpoint. Junior white/navy kit grows to navy/gold racing kit. Full sculling oar, asymmetric spoon blade and shaft within canvas, never a kayak paddle. No ergometer, boat or water scene.

Silver: older teen; neater white/navy academy kit, improved shoes, small silver local regatta medal, navy cap held; recognition pose different from Bronze, upright oar safely beside athlete. Gold: young adult premium navy/white kit, regional cup waist-height. Platinum: mature adult refined navy kit/white piping, national cup and oar, walking/presentation posture. Diamond: championship navy/silver/gold seams, continental cup and medal, captain pose. Elite: navy/gold, world medal and cup, restrained celebration. Champion: two cups plus worn gold medal maximum three awards, calm leader pose. Unreal already completed: navy club-style trouser suit, original abstract silver/gold oar-and-wave honour, mature face, head-to-mid-thigh.

Use own Bronze alone for Silver so it remains teenage. Use own Bronze + Unreal or adult references for later tiers. Female may also reference the matching male for kit/award only. Avoid copying the same pose or forcing male face onto female. For equipment-free tiers, explicitly replace the generic equipment paragraph: reference equipment otherwise sometimes leaks into generated art.

## Image production and checks

Use the built-in image generation tool, one portrait per call. Read/apply imagegen skill. Do not silently switch to CLI/API. Do not claim to change model to Sol Light; user controls model selection. Always request transparent background. Visually inspect every result. Correct clipping, wrong equipment, award count or age before saving. Python/Pillow is for validation and copying ORIGINAL bytes only, not image edits. Use imagegen for corrections.

Save accepted original to `public/avatars/sport/<sport>_<tier>_<male|female>_v2.png`. Do not overwrite accepted originals. Football/Rugby Gold through Unreal use their existing v3 refinements; new collections use v2. Each PNG square >=1024, RGBA, alpha extrema0..255. Full head/hands/feet/equipment through Champion; Unreal deliberate head-to-mid-thigh. Clear transparent margins, no text/logos/official trophy inscriptions/background/extra people.

Record path, SHA-256, dimensions, full prompt, actual references, timestamp and review in `<sport>-production-record.json`. Mark matching `production-status.json` rows ready with path, awaiting complete release. Checkpoint each pair to GitHub to avoid losing work after disconnects.

Current scratch helpers: `/workspace/scratch/9a67ab8401a0/avatar_checkpoint.py` records/validates a pair; `/workspace/scratch/9a67ab8401a0/avatar-runtime-checkpoint.json` contains earlier JS publish/generate/save helpers. These may be stale or pruned, so do not trust stored branch/head over GitHub. Connector Git blob/tree/commit/ref calls were used to publish; direct local git push lacks credentials. Use expected SHA leases. Local connector-created commits differ in metadata from local commits but should have equal trees; after merging fetch main, check tree equality, then `git reset --soft origin/main` to align, and create next branch. Do not hard reset user changes.

## Integration and release checklist

Only enable a collection once all sixteen portraits pass review and file checks.

1. Add sport to `PAIRED_SPORT_AVATAR_ARTWORK_READY` in `src/config/sportAvatarArtwork.js`. Preserve legacy defaults and football/rugby refinements.
2. Existing tests loop all ready collections. Move unfinished sentinel in `sportAvatarArtwork.test.js` from Outdoor Rowing to Yoga; after final Yoga use an explicitly unknown unsupported sport rather than rejecting a now-complete sport.
3. Create migration with Supabase CLI `migration new <sport>_paired_avatar_appearance`; never invent timestamp. Latest committed migration: `20261010123045_indoor_rowing_paired_avatar_appearance.sql`. Copy its RPC and append ONLY completed sport to allowed regex. Preserve owner-family auth.uid check, profile lock, claimed reward check, two-field appearance sanitisation, empty search_path and anon/public revoke/authenticated grant. Logical selection history remains owned by existing identity RPC.
4. Update unfinished sentinel across ALL `supabase/tests/*avatar_appearance.sql` (includes original paired test). Add new sport rollback regression based on latest. After Yoga retain invalid/unsupported rejection using unknown sport.
5. Supabase project `chdoyavyydwaewpuzbsb`. Read Supabase skill/current docs; apply migration via connector, execute rollback-only SQL tests, check advisors. Authenticated-only SECURITY DEFINER advisory is intentional for this existing owner-checked RPC, not newly public access. No relevant performance advisory in recent checks. Never disclose athlete data or secrets.
6. `TZ=UTC npm test -- --maxWorkers=2`, `npm run build`, `git diff --check`. Existing build chunk-size warning is unrelated. Run required checks and inspect final results before reporting passes.
7. Write `<sport>-paired-release.md` and update handoff. Publish integration, create PR. Wait for exact-head Workout Tracker CI and Vercel success, then merge with expected head SHA. User authorized releases; no repeat confirmation.
8. Vercel target `pauls-projects-9d62e071/workout-tracker`; main auto deploys. Live URL `https://workout-tracker-ivory-tau.vercel.app`. Confirm merge production status, fetch all16 `/avatars/sport/...` live files and compare recorded SHA-256 (ThreadPool8 timeout25 worked). Do not report preview as production.
9. Start next sport while CI builds if useful, but save it on its own new branch after preceding merge, not the previous collection's PR.
10. After Yoga, reconcile final thirteen-collection completion counts/status in the canonical handoff and verify no remaining missing paths. Do not claim unrelated badges, education, shop or feature roadmap work complete.

No manual Galaxy Fold QA was performed during these image batches. No subagents were used; do not spawn unless explicitly authorized by current instructions. Keep concise progress updates during the work and clearly distinguish saved artwork, merged code and verified live releases.
