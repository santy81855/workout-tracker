# Workout Tracker PWA — Implementation Plan

Status: approved product and architecture plan. The application is an ordered workout-program engine, not a weekday calendar: execution dates may shift, while workout identity and prescription remain stable.

## 1. Product vision

### Problem

General-purpose tools make gym entry feel like spreadsheet administration. The product must make one-handed set entry fast, show useful prior performance, guide the active twelve-week program, preserve data during network interruptions, and provide explainable progression guidance without pressuring unsafe completion.

### Primary user

One authenticated user, primarily on an installed iPhone PWA in the gym and occasionally on desktop for history and analytics. The initial unit is pounds.

### Goals

- Reach an active workout from launch with minimal friction.
- Make ordinary set entry possible without opening the keyboard.
- Preserve active-workout data through temporary loss of connectivity.
- Use previous performance to reduce repeated entry.
- Roll missed workouts forward without changing their program prescription.
- Support intentional volume reduction, skipping, and exercise substitution.
- Explain every progression recommendation.
- Preserve historical prescriptions and performed exercise identities.
- Provide portable JSON and CSV exports.
- Deliver a polished Safari Add to Home Screen experience.

### Non-goals

- Public or social fitness platform
- App Store distribution
- Coaching or medical advice
- Program marketplace
- Full visual program builder in the MVP
- Notion integration
- Runtime dependency on an external exercise API
- Gamification or unsafe streak pressure
- Scientifically authoritative stimulus or recovery estimates

### Principles

1. The active-workout experience wins every tradeoff.
2. Every mutation has a visible saved, unsynced, failed, or undone state.
3. Programmed volume is a ceiling, not an obligation.
4. Dates may move; prescription identity must not.
5. Recommendations are advisory and explainable.
6. Historical data is never silently reinterpreted.
7. Equipment-specific load semantics remain explicit.
8. Analytics compare like with like and disclose limitations.
9. Security is enforced with database Row Level Security.
10. Offline behavior must not depend on unreliable background execution.

### MVP

- Email/password authentication
- Initial twelve-week program and ordered rollover scheduling
- Today screen and one active workout at a time
- Focused exercise/set entry and RIR confirmation
- Previous-performance display and exercise replacement
- In-app rest timer
- Durable active-workout offline operation and synchronization
- Workout summary and weekly check-in
- Session history, corrections, and audit events
- Basic exercise analytics and muscle-group heat map
- Installable PWA with system-aware light/dark themes
- JSON/CSV export and versioned program JSON import
- Unit, integration, RLS, end-to-end, accessibility, and real-iPhone QA

### Deferred

- Visual program builder
- Push-based rest alerts and reminders
- Multiple simultaneous sessions
- Estimated one-rep max
- Automatic load changes
- Advanced recovery correlations
- Cross-exercise volume rankings
- Public sharing, multiple units, and additional program families

### Success criteria

- A normal set can be logged with a few thumb taps and no keyboard.
- Network loss does not lose the active workout.
- Reopening the PWA restores the workout and timer.
- Progression explanations identify the exact supporting rules and history.
- Rollover never changes the workout's program week or prescription.
- Template changes never rewrite history.
- Cross-user RLS tests pass for every user-owned table.
- A complete export can reconstruct programs and workout history.
- The critical workflow passes on a physical iPhone in standalone mode.

## 2. Functional specification

### Navigation

Use four persistent bottom destinations: Today, Program, History, and Progress. Settings is accessed from the top bar. During an active workout, use a workout-specific navigation surface with minimize/exit, progress, timer, and session menu.

### Today states

Scheduled state shows the next queued workout, cycle, program week, phase, RIR, template identity, current scheduled date, muscle groups, status, rollover context, and Start Workout.

Active state makes Resume Workout dominant and shows elapsed time, current exercise, completed sets, timer, and pending sync count.

Completed-week state shows the next program week and any outstanding weekly check-in without inventing another workout.

### Scheduling and rollover

- Cycle 1 begins Monday, August 10, 2026.
- A program week contains five ordered workouts.
- The week advances only after all five are completed, partial, or explicitly skipped.
- A missed workout remains first in the queue and shifts later unresolved workouts forward.
- Saturday and Sunday are valid rollover dates.
- The template identity and program-week prescription never change with the date.
- Recovery-spacing conflicts warn but never block.
- Skipping is explicit; no workout is silently discarded.

### Active-workout state machine

```text
scheduled --start--> active --complete--> completed
    |                  |--finish early--> partial
    |                  `--abandon-------> abandoned
    `--skip-----------------------------> skipped

completed/partial --correct--> same terminal state plus audit event
```

Only one session may be active per user.

### Exercise card

Show exercise name, rep range, required and optional sets, target RIR, completed count, rest target, guidance, replacement action, immediately previous performance, recent best, and suggested load with explanation. All set rows remain visible compactly; only the active set expands into large controls.

### Set entry

- Large load display with exercise-specific decrement/increment controls
- Tap load for a valid-load picker; manual exact input remains an escape hatch
- Large rep display with -1/+1 controls and exact entry
- Prominent Complete Set action
- Secondary Skip Set action
- Minimum 44px targets; prefer 48–56px for primary gym controls

Load semantics:

- Dumbbells store weight per dumbbell.
- Barbells store total weight including the bar.
- Weighted pull-ups store added load.
- Bodyweight-only pull-ups use an explicit mode, never numeric zero.
- First occurrence begins unset; later occurrences use history.

### Set completion and RIR

Completing a set validates input, generates an idempotency ID, commits to IndexedDB, updates optimistically, starts the rest timer, and attempts synchronization. Duplicate taps are blocked in the UI and by database uniqueness.

After completion, show inline confirmation rather than a modal:

```text
Target: 2 RIR
[ Yes, on target ] [ No ]
```

If No, accept 0–5, 6+, or Unsure. A target range accepts either endpoint.

### Undo and corrections

- Show a short-lived Undo action.
- Completed sets remain expandable for correction.
- Completed-session load, reps, RIR, technique flags, and notes are editable.
- Corrections create append-only audit events.
- Correcting performed exercise identity uses a separate explicit flow.
- Conflicted offline corrections are never silently overwritten.

### Exercise replacement

Offer compatible substitutions first, then the curated catalog and user-created exercises. Record prescribed exercise, performed exercise, reason, and performed load semantics. Use the replacement exercise's own history for prior values.

### Rest timer

- Starts after a completed set.
- Uses exercise-specific defaults.
- Is timestamp-based so it restores after navigation, refresh, backgrounding, or wake.
- Supports pause, resume, +30 seconds, skip, and dismiss.
- Locked-screen notification is deferred and not promised.

### Completion and weekly check-in

The workout summary includes exercises, working sets, reps, exercise-specific volume, records, bodyweight, energy, discomfort, notes, progression considerations, and sync status.

After the fifth workout resolves, prompt for a non-blocking weekly check-in: recovery, sleep, energy, soreness, joint discomfort, motivation, per-muscle recovery, strongest lift, worst exercise, improvement, recovery factors, actions, and notes.

### History and progress

History uses mobile cards and drill-down detail with date, exercise, week, template, and status filters. Progress includes exercise history, highest load, most reps at a selected load, best set/session volume, muscle set exposure, bodyweight trend, and program outcomes.

### Empty/error/offline states

Every screen defines loading, empty, recoverable error, offline-stale, unsynced, authentication-expired, and no-history states. Expired auth never erases local workout data.

## 3. UX specification

Use a hybrid minimal-performance-dashboard and high-contrast-gym-utility direction: restrained dark surfaces, strong numeric hierarchy, one accent, tabular numerals, and bright primary controls. Support system light/dark themes with a dark gym bias.

Form controls remain at least 16px to avoid iOS zoom. Use `inputmode="decimal"` for weight and `inputmode="numeric"` for reps. Respect `viewport-fit=cover` and iPhone safe-area insets. Bottom controls remain above the Home indicator.

Accessibility requirements:

- VoiceOver labels include action, value, unit, and set position.
- State is never communicated only by color.
- Reduced motion disables nonessential transitions and pulses.
- Focus is not moved by background synchronization.
- All desktop operations are keyboard accessible.
- Charts have text equivalents.
- Landscape never requires horizontal scrolling for the workout flow.
- Destructive actions have confirmation or undo.

## 4. Architecture

### Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase Postgres and Auth
- Vercel
- Zod for boundary validation
- IndexedDB through a small typed wrapper
- A chart library only after bundle-size and accessibility review

### Component boundaries

Server Components render authenticated page shells, Today initial state, Program, History lists, Progress summaries, and Settings. Client Components own the active workout, local offline state, set controls, timer, charts, replacement search, theme, and update prompts.

Route handlers or server operations own complete exports, transactional program import, cycle creation, sensitive account operations, and complex aggregates.

### Supabase clients

1. Browser client with publishable key and user session
2. Server request client with cookie-based user session
3. Narrow server-only privileged client only where genuinely required

Normal user operations run as the authenticated user so RLS remains active. No elevated key appears in browser code.

### Mutations and conflicts

Offline-capable mutations include client mutation ID, client-generated entity ID, base revision, payload, client timestamp, server receipt timestamp, device ID, and mutation type. Server application is idempotent.

If the server revision differs from the base revision, mark a conflict and show local/server choices. Never use unannounced last-write-wins for workout records.

### Caching and PWA

- Cache hashed static assets aggressively.
- Never service-worker-cache authenticated Supabase responses or exports.
- Store active workout data in IndexedDB, not Cache Storage.
- Purge user-scoped local data on logout.
- Do not apply an update reload while unsynced work exists.

The service worker caches the versioned shell and offline navigation fallback. IndexedDB stores the active snapshot, set drafts, completed local sets, outbox, sync state, timer timestamps, next queued workout, and relevant exercise history.

Sync runs after each mutation, on reconnect, foreground, launch, and manual retry. It does not depend on Background Sync.

Guaranteed offline scope is the already downloaded active workout. First-time login, uncached history, imports, and exports require connectivity.

### Deployment

One-user usage should remain comfortably inside Vercel Hobby and Supabase Free limits. The material free-tier risks are inactivity and backup guarantees, not capacity. Maintain user exports, migrations, and periodic off-site logical database dumps.

## 5. Database design

Use UUID primary keys, `timestamptz` server timestamps, and an explicit timezone/local date where calendar semantics matter. Denormalize `user_id` onto operational tables for simple RLS and enforce ownership consistency between parent and child rows.

Store weights as integer tenths of a pound: 135 lb is `1350`, 2.5 lb is `25`.

### Tables

#### `profiles`

`id uuid PK/FK auth.users`, `display_name text?`, `timezone text default America/Chicago`, timestamps. Owner-only select/update.

#### `user_preferences`

`user_id PK`, `weight_unit lb`, `default_increment_tenths 25`, theme, reduced-motion override, timer sound/vibration, timestamps. Owner only.

#### `muscle_groups`

Seeded reference rows with small integer ID, unique slug/name, and display order. Authenticated read-only.

#### `exercises`

UUID ID, nullable owner for curated/custom distinction, name, equipment type, load basis, default rep range, increment, load bounds/list, rest, guidance, curated/active flags, timestamps. Curated rows are read-only; users own custom rows.

Load bases: `external_total`, `per_dumbbell`, `added_bodyweight`, `bodyweight_only`, `assistance`, `repetition_only`.

#### `exercise_muscles`

Exercise and muscle composite key with contribution tenths (`10` primary, `5` secondary) and role.

#### `exercise_substitutions`

Source/replacement pair, compatibility rank, notes, and optional owner for curated plus user-specific mappings.

#### `programs` and `program_revisions`

Programs are user-owned logical identities. Revisions store immutable, versioned imported JSON, checksum, week/workout counts, validation/publication state, and timestamps. Published revisions cannot mutate.

#### `program_week_rules`

Revision/week unique rows containing phase, RIR min/max, deload flag, load-reduction guidance, and text guidance.

#### `program_set_rules`

Revision/week/peak-set unique rows containing required and optional sets. Week 12 peak-three means one required plus one optional.

#### `workout_templates`

Revision-owned ordered templates with name, original day label, and guidance.

#### `workout_template_exercises`

Ordered exercise prescription with peak sets, rep range, optional increment/rest override, guidance, and technique-check type.

#### `program_cycles`

User, revision, name, start date, timezone, status, current week, completion timestamp. Partial unique index permits one active cycle per user.

#### `scheduled_workouts`

Concrete cycle instance with program week, template, cycle sequence, original/current dates, status, rollover count, skip reason, and timestamps.

#### `workout_sessions`

User, scheduled workout, cycle/revision/week, template/phase/RIR snapshots, status, timestamps, local date/timezone, bodyweight, energy, notes, reduced-volume reason, revision, and client/server timestamps. Partial unique index permits one active session.

#### `session_exercises`

Session sequence; prescribed and performed exercise; replacement reason; name, load basis, rep range, set count, increment, rest, and guidance snapshots; technique/pain/fatigue flags; notes; progression decision/override; revision and timestamps.

#### `exercise_sets`

Session exercise, set number/kind/status, load mode/value, reps, target RIR snapshot, target confirmation, actual RIR representation, notes, completion timestamp, unique client mutation ID, revision, soft-delete timestamp, and timestamps.

Completed working sets require reps; load modes constrain whether a load is present; set position and mutation IDs are unique.

#### `edit_audit_events`

Append-only entity type/ID, action, before/after JSON, reason, timestamp, and mutation ID. Owner-readable and not client-editable.

#### `weekly_checkins` and `weekly_muscle_recovery`

One check-in per cycle/week with overall fields and normalized per-muscle rating rows for queryable trends.

#### `body_metrics`

Measured timestamp, weight, source/source ID, notes, and timestamps.

### Recommendations and history

Do not persist a separate recommendation table in MVP. Compute from immutable facts and store only the user's decision/override. This prevents stale recommendations after corrections.

Use soft deletion for sets and archival/terminal statuses for sessions, cycles, and programs. Hard deletion is limited to an explicit account-deletion workflow.

### RLS

For each user-owned table:

- SELECT where `user_id = auth.uid()`
- INSERT with check `user_id = auth.uid()`
- UPDATE using and with check `user_id = auth.uid()`
- Ordinary client DELETE disallowed

Use invoker-security views or keep internal views out of the exposed schema. Test every table with two synthetic users.

### Seed data

Versioned migrations seed muscle groups, curated exercises, muscle mappings, substitutions, and the initial immutable program revision. Generate scheduled workout instances; do not seed sixty static workout pages.

## 6. Program engine

Program weeks are completion-based, never calculated from elapsed calendar weeks.

Phases:

- Weeks 1–3 Reacclimation
- Weeks 4–6 Volume Build
- Weeks 7–9 Full Volume
- Weeks 10–11 Peak
- Week 12 Deload

Target RIR by week: `4–5, 4, 3–4, 3, 2–3, 2, 2, 1–2, 1–2, 1, 1, 4–5`.

Working sets:

| Week | Peak 4 | Peak 3 | Peak 2 |
|---:|---:|---:|---:|
| 1 | 1 | 1 | 1 |
| 2 | 2 | 1 | 1 |
| 3 | 2 | 2 | 1 |
| 4 | 3 | 2 | 1 |
| 5 | 3 | 2 | 2 |
| 6 | 3 | 3 | 2 |
| 7–11 | 4 | 3 | 2 |
| 12 | 2 | 1 required + 1 optional | 1 |

Starting a cycle validates the immutable revision, creates 60 scheduled instances, assigns program sequence/week/original date, and creates no set rows until session start.

Spacing warnings initially cover incline press to shoulder press, shoulder press to chest pressing, and squat to RDL when under roughly 48 hours. They identify the prior lift and elapsed time, then offer Continue or Back.

## 7. Progression engine

Recommendation states are `eligible to increase`, `maintain and build`, and `review/reduce`. Recommendations never automatically change load.

Base eligibility requires a non-deload exercise occurrence, all required sets completed at the upper rep target, no pain or technique flag, and no actual RIR of zero when the target is above zero.

Lenient RIR rule:

- All but at most one required set must be on target.
- One exception may be no more than one RIR harder.
- Unsure yields “possible progression—review.”
- Two off-target or one substantially harder set means maintain.
- Easier-than-target work does not disqualify progression.

Upper targets are 20 for ordinary hypertrophy movements, 12 clean for squat, and 15 controlled for RDL. Deload, skipped, abandoned, missing-required-set, pain, technique-compromised, and unresolved-conflict data are excluded.

A partial workout may qualify a fully completed exercise. Suggested weight is last valid load plus the exercise increment, snapped upward to a configured available load. If qualifying sets use materially different loads, show eligibility without inventing a numeric suggestion.

Previous display uses the most recent occurrence of the performed exercise across templates. Suggestions use the most recent valid non-deload occurrence with matching load basis/equipment and resolved data. Extra newly prescribed sets reuse prior load but do not fabricate prior reps or RIR.

## 8. Analytics

MVP metrics:

- Highest completed working-set load for exact exercise/load mode
- Most reps at a selected load
- Best set volume: recorded load × reps
- Best session volume: sum of completed working-set recorded load × reps
- Recent exercise load/reps/RIR history
- Bodyweight trend
- Program outcome counts
- Muscle-group set exposure

Per-dumbbell volume retains the per-dumbbell convention. Added-weight pull-up volume includes added load only and is labeled. Bodyweight-only sets have reps but no numeric load volume.

Muscle exposure per completed working set is 1.0 for primary and 0.5 for secondary muscles. Completed mode uses performed sets; Expected mode uses required programmed sets. Group by active program week and show against a configurable 15-set reference. Label it as estimated set exposure, not measured stimulus.

Avoid MVP estimated 1RM, strength scores, calorie claims, cross-exercise volume leaderboards, recovery predictions, and RIR accuracy scores.

## 9. Security

- Supabase email/password; no anonymous sign-in
- Cookie-based SSR session and protected layout
- RLS and explicit grants on every exposed object
- Publishable key browser-safe; elevated key server-only if needed
- Shared schema validation plus database constraints
- Version/size/depth limits on program import
- No arbitrary HTML in notes or guidance
- Fresh authentication for export; private/no-store response
- Clear IndexedDB/Cache Storage user data on logout
- No sensitive workout payloads in logs or session-replay tooling

Primary threats are stolen authenticated device, weak password, RLS error, exposed elevated key, unsafe shared caching, malicious import, retained offline data, and cross-device overwrite.

## 10. Test strategy

### Unit

Test every week/peak-set combination, phase/RIR mapping, cycle generation, rollover, skipping, week advancement, spacing warnings, load increments, dumbbell/bodyweight semantics, volume/muscle formulas, prior-session selection, deload exclusions, lenient progression, technique exclusions, cycle completion, and JSON validation.

### Integration

Test snapshot creation, idempotent set completion, single active session, audited correction, replacement, rollover, weekly check-in eligibility, atomic import rejection, complete export, and analytics recalculation.

### RLS

With two users, prove cross-user read/insert/update/reference failure; audit immutability; curated reference immutability; view safety; and absence of elevated keys from the client.

### End-to-end

Test login through completion, rollover, offline continuation/reconnect, refresh with unsynced data, replacement, partial workout, weekly check-in, correction/analytics, PWA standalone launch, and logout purge.

### Real iPhone

Verify Add to Home Screen, standalone safe areas, keyboard/no zoom, thumb reach, VoiceOver, lock/wake timer restoration, network loss, updates, IndexedDB persistence, orientation, backgrounding, and light/dark changes.

## 11. Implementation milestones

1. Decision artifacts and executable contracts
2. Next.js/TypeScript/Tailwind foundation
3. Database schema, migrations, seed data, and RLS
4. Authentication and protected shell
5. Program engine and cycle scheduling
6. Today and online workout skeleton
7. Set-entry interaction
8. Offline outbox, idempotent sync, and conflicts
9. Timer and exercise replacement
10. Completion, weekly check-in, history, and audit
11. Progress analytics
12. Program import and data export
13. PWA hardening and real-device QA
14. Release candidate, backup runbook, and regression review

Each milestone must define user-visible outcome, dependencies, affected systems, tests, acceptance criteria, risks, and review owner. Offline synchronization, RLS, history snapshots, progression logic, analytics validity, and pre-release security require strongest-model review.

## 12. Model handoff

Keep product judgment, UX review, program/progression invariants, data ownership, RLS, offline conflict design, historical semantics, analytics validity, and release review with GPT-5.6 Sol.

Use GPT-5.6 Terra for bounded implementation milestones, components from approved interaction specs, migrations after schema approval, standard queries/routes, and test implementation.

Use GPT-5.6 Luna for repetitive fixtures, seed formatting, straightforward type definitions, documentation cleanup, and mechanical refactors protected by strong tests.

Every implementation prompt must contain one milestone, explicit scope/non-scope, invariants, required tests, acceptance criteria, prohibited shortcuts, and the current decision log. Bring Sol back whenever schema/history, sync, RLS/auth, analytics definitions, or core workout interaction changes.

## 13. Decision log

### Accepted

- PWA, Next.js App Router, TypeScript, Tailwind, Vercel, and Supabase
- Email/password and RLS everywhere
- August 10, 2026 cycle start
- Completion-based weeks and weekend rollover
- Explicit skip and non-blocking recovery warnings
- Pounds; per-dumbbell and total-barbell semantics
- Added-load/bodyweight-only pull-up modes
- Exercise-specific increments and unset first occurrence
- Inline per-set RIR confirmation with conditional actual RIR
- Lenient advisory progression
- One active session and audited corrections
- Compatible plus catalog-wide exercise replacement
- Versioned JSON program interchange
- Durable active-workout offline support
- In-app timer; locked-screen notification deferred
- Weekly check-in
- Completed/expected heat map with 1.0/0.5 muscle credit
- System-aware themes with dark gym bias
- Compact set list with only the active set expanded

### Rejected

- Calendar-only week advancement
- Sixty static workout pages
- Mandatory typed RIR
- Modal after every set
- Runtime external exercise API
- Universal increment
- Bodyweight represented as zero
- Automatic progression changes
- All-server or all-browser data access
- Authenticated service-worker response caching
- Background Sync as the reliability mechanism
- Estimated 1RM in MVP
- Muscle fractions more precise than 1.0/0.5

### Deferred

- Final palette/iconography
- Push and reminders
- Visual program builder
- Multiple units/program families
- Advanced recovery analytics
- Automated off-site backups
- Partial-adherence scoring

### Validate during implementation

- Week 12 optional second-set usability
- RIR confirmation repetition cost
- Usefulness of 1.0/0.5 muscle mapping
- Recovery warning thresholds
- iOS storage behavior
- Curated substitution coverage
- Lenient progression threshold

No deployment or external resource provisioning is implied by this document. Those actions require a separate, explicit execution decision at the relevant milestone.
