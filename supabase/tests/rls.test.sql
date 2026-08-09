begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(28);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('20000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner-a@example.test', '', now(), '{}', '{}', now(), now()),
  ('20000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner-b@example.test', '', now(), '{}', '{}', now(), now());

select is(
  (select count(*)::integer from public.profiles where id in (
    '20000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002'
  )),
  2,
  'auth-user creation provisions both profiles'
);

insert into public.programs (id, user_id, name) values
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Owner A Program'),
  ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'Owner B Program');

set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is((select count(*)::integer from public.profiles), 1, 'user A sees only their profile');
select is((select count(*)::integer from public.programs), 1, 'user A sees only their program');
select is((select name from public.programs), 'Owner A Program', 'user A sees the correct program');
select ok((select count(*) from public.exercises where is_curated) >= 20, 'authenticated users can read curated exercises');

insert into public.exercises (
  id, owner_user_id, name, equipment_type, load_basis, default_increment_tenths_lb, is_curated
) values (
  '40000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  'Owner A Custom Exercise',
  'custom',
  'external_total',
  25,
  false
);

select is(
  (select count(*)::integer from public.exercises where owner_user_id is not null),
  1,
  'user A can read their custom exercise'
);

select throws_ok(
  $$insert into public.programs (user_id, name) values ('20000000-0000-4000-8000-000000000002', 'Cross-owner insert')$$,
  '42501',
  'new row violates row-level security policy for table "programs"',
  'user A cannot insert a program for user B'
);

select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000002', true);

select is((select count(*)::integer from public.programs), 1, 'user B sees only their program');
select is((select name from public.programs), 'Owner B Program', 'user B sees the correct program');
select is(
  (select count(*)::integer from public.exercises where owner_user_id is not null),
  0,
  'user B cannot read user A custom exercises'
);
select ok(
  not has_table_privilege('authenticated', 'public.edit_audit_events', 'UPDATE'),
  'authenticated clients cannot update audit events'
);

select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000001', true);

do $$
declare
  week_rules jsonb;
  templates jsonb;
  document jsonb;
begin
  select jsonb_agg(jsonb_build_object(
    'week', week_number,
    'phase', case when week_number = 12 then 'Deload' else 'Reacclimation' end,
    'targetRir', jsonb_build_object('min', 4, 'max', 5),
    'isDeload', week_number = 12,
    'setRules', jsonb_build_object(
      'peak2', jsonb_build_object('required', 1, 'optional', 0),
      'peak3', jsonb_build_object('required', 1, 'optional', case when week_number = 12 then 1 else 0 end),
      'peak4', jsonb_build_object('required', 1, 'optional', 0)
    )
  ) order by week_number)
  into week_rules
  from generate_series(1, 12) week_number;

  select jsonb_agg(jsonb_build_object(
    'sequence', sequence_number,
    'originalDayLabel', 'Day ' || sequence_number,
    'name', 'Test Day ' || sequence_number,
    'exercises', jsonb_build_array(jsonb_build_object(
      'exercise', 'incline-dumbbell-press',
      'repMin', 12,
      'repMax', 20,
      'peakSets', 4,
      'guidance', jsonb_build_array()
    ))
  ) order by sequence_number)
  into templates
  from generate_series(1, 5) sequence_number;

  document := jsonb_build_object(
    'schemaVersion', '1.0',
    'name', 'RLS Test Program',
    'description', 'Transaction-scoped test program',
    'weekCount', 12,
    'workoutsPerWeek', 5,
    'weekRules', week_rules,
    'workoutTemplates', templates
  );

  perform public.bootstrap_program_cycle(document, '2026-08-10');
end;
$$;

select is((select count(*)::integer from public.program_cycles), 1, 'cycle bootstrap creates one owned active cycle');
select is((select count(*)::integer from public.scheduled_workouts), 60, 'cycle bootstrap creates sixty scheduled workouts');

select lives_ok(
  $$select public.sync_workout_session('{
    "id":"50000000-0000-4000-8000-000000000001",
    "status":"active",
    "programWeek":1,
    "phase":"Reacclimation",
    "templateName":"Test Day 1",
    "targetRirLabel":"4–5",
    "startedAt":"2026-08-10T12:00:00.000Z",
    "finishedAt":null,
    "updatedAt":"2026-08-10T12:05:00.000Z",
    "serverRevision":0,
    "exercises":[{
      "id":"60000000-0000-4000-8000-000000000001",
      "prescribedExerciseSlug":"incline-dumbbell-press",
      "performedExerciseSlug":"incline-dumbbell-press",
      "replacementReason":null,
      "name":"Incline Dumbbell Press",
      "loadBasis":"per_dumbbell",
      "repMin":12,
      "repMax":20,
      "incrementTenthsLb":25,
      "restSeconds":180,
      "notes":"",
      "targetRirLabel":"4–5",
      "sets":[{
        "id":"70000000-0000-4000-8000-000000000001",
        "setNumber":1,
        "status":"completed",
        "loadMode":"per_dumbbell",
        "loadTenthsLb":100,
        "reps":12,
        "rirOnTarget":true,
        "actualRir":null,
        "completedAt":"2026-08-10T12:05:00.000Z"
      }]
    }]
  }'::jsonb)$$,
  'normalized session synchronization succeeds for the owner'
);

select is((select count(*)::integer from public.workout_sessions), 1, 'session synchronization creates one workout session');
select is((select count(*)::integer from public.exercise_sets), 1, 'session synchronization creates the completed set');
select is(jsonb_array_length(public.get_workout_history()), 1, 'owner history projection returns the synchronized session');
select throws_ok(
  $$select public.sync_workout_session('{"id":"50000000-0000-4000-8000-000000000001","status":"active","programWeek":1,"templateName":"Test Day 1","serverRevision":0}'::jsonb)$$,
  'P0001',
  'SYNC_CONFLICT: server revision 1, client revision 0',
  'stale workout revisions are rejected instead of overwriting newer data'
);

update public.workout_sessions set status = 'completed', finished_at = '2026-08-10T13:00:00Z'
where id = '50000000-0000-4000-8000-000000000001';
update public.exercise_sets set reps = 13 where id = '70000000-0000-4000-8000-000000000001';
select is((select count(*)::integer from public.edit_audit_events where action = 'correct_completed_set'), 1, 'completed-set correction creates one audit event');
select is((select before_values->>'reps' from public.edit_audit_events where action = 'correct_completed_set'), '12', 'audit event preserves the prior value');
update public.workout_sessions set energy_rating = 4, notes = 'Corrected session note'
where id = '50000000-0000-4000-8000-000000000001';
select is((select count(*)::integer from public.edit_audit_events where action = 'correct_session_details'), 1, 'completed-session detail correction creates one audit event');
select is((select before_values->>'energyRating' from public.edit_audit_events where action = 'correct_session_details'), null, 'session audit preserves an unset prior energy rating');

select lives_ok(
  $$select public.upsert_weekly_checkin('{"programWeek":1,"overallRecovery":4,"energy":4,"overallSoreness":2,"jointDiscomfort":"none","motivation":5,"nextWeekActions":["maintain_load"]}'::jsonb)$$,
  'owner can save a weekly check-in'
);
select is(jsonb_array_length(public.get_weekly_checkins()), 1, 'owner can read their weekly check-in projection');
select is((public.get_weekly_checkins()->0->>'programWeek')::integer, 1, 'weekly check-in preserves its program week');

select lives_ok(
  $$select public.activate_program_cycle((select source_json from public.program_revisions order by created_at limit 1), '2026-11-02')$$,
  'owner can archive the completed cycle and activate a validated replacement'
);
select is((select count(*)::integer from public.program_cycles where status = 'active'), 1, 'cycle activation leaves exactly one active cycle');
select is((select count(*)::integer from public.program_cycles), 2, 'cycle activation preserves the archived cycle');

select * from finish();
rollback;
