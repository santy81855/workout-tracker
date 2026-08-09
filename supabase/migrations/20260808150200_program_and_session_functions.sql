begin;

create function public.bootstrap_program_cycle(p_document jsonb, p_starts_on date)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  existing_cycle_id uuid;
  new_program_id uuid;
  new_revision_id uuid;
  new_cycle_id uuid;
  week_rule jsonb;
  template_record record;
  prescribed jsonb;
  new_template_id uuid;
  exercise_id uuid;
  source_checksum text;
begin
  if owner_id is null then
    raise exception 'Authentication required';
  end if;

  if p_document->>'schemaVersion' <> '1.0' then
    raise exception 'Unsupported program schema version';
  end if;

  if (p_document->>'weekCount')::integer <> 12 or (p_document->>'workoutsPerWeek')::integer <> 5 then
    raise exception 'The initial program must contain twelve weeks and five workouts per week';
  end if;

  select id into existing_cycle_id
  from public.program_cycles
  where user_id = owner_id and status = 'active'
  limit 1;

  if existing_cycle_id is not null then
    return existing_cycle_id;
  end if;

  source_checksum := encode(extensions.digest(convert_to(p_document::text, 'UTF8'), 'sha256'), 'hex');

  insert into public.programs (user_id, name, description, source_format_version)
  values (owner_id, p_document->>'name', p_document->>'description', p_document->>'schemaVersion')
  returning id into new_program_id;

  insert into public.program_revisions (
    user_id, program_id, revision_number, source_json, source_checksum,
    week_count, workouts_per_week, status, published_at
  ) values (
    owner_id, new_program_id, 1, p_document, source_checksum,
    (p_document->>'weekCount')::smallint, (p_document->>'workoutsPerWeek')::smallint,
    'published', now()
  ) returning id into new_revision_id;

  for week_rule in select value from jsonb_array_elements(p_document->'weekRules')
  loop
    insert into public.program_week_rules (
      user_id, program_revision_id, week_number, phase_name,
      target_rir_min, target_rir_max, is_deload,
      load_reduction_min_percent, load_reduction_max_percent, guidance
    ) values (
      owner_id,
      new_revision_id,
      (week_rule->>'week')::smallint,
      week_rule->>'phase',
      (week_rule->'targetRir'->>'min')::smallint,
      (week_rule->'targetRir'->>'max')::smallint,
      (week_rule->>'isDeload')::boolean,
      case when (week_rule->>'isDeload')::boolean then 10 else null end,
      case when (week_rule->>'isDeload')::boolean then 20 else null end,
      null
    );

    insert into public.program_set_rules (
      user_id, program_revision_id, week_number, peak_sets, prescribed_sets, optional_additional_sets
    ) values
      (owner_id, new_revision_id, (week_rule->>'week')::smallint, 2,
        (week_rule->'setRules'->'peak2'->>'required')::smallint,
        (week_rule->'setRules'->'peak2'->>'optional')::smallint),
      (owner_id, new_revision_id, (week_rule->>'week')::smallint, 3,
        (week_rule->'setRules'->'peak3'->>'required')::smallint,
        (week_rule->'setRules'->'peak3'->>'optional')::smallint),
      (owner_id, new_revision_id, (week_rule->>'week')::smallint, 4,
        (week_rule->'setRules'->'peak4'->>'required')::smallint,
        (week_rule->'setRules'->'peak4'->>'optional')::smallint);
  end loop;

  for template_record in
    select value as document, ordinality::smallint as sequence_number
    from jsonb_array_elements(p_document->'workoutTemplates') with ordinality
  loop
    insert into public.workout_templates (
      user_id, program_revision_id, sequence_in_week, name, original_day_label
    ) values (
      owner_id,
      new_revision_id,
      (template_record.document->>'sequence')::smallint,
      template_record.document->>'name',
      template_record.document->>'originalDayLabel'
    ) returning id into new_template_id;

    for prescribed in select value from jsonb_array_elements(template_record.document->'exercises')
    loop
      select id into exercise_id
      from public.exercises
      where slug = prescribed->>'exercise' and owner_user_id is null and is_curated
      limit 1;

      if exercise_id is null then
        raise exception 'Unknown curated exercise: %', prescribed->>'exercise';
      end if;

      insert into public.workout_template_exercises (
        user_id, workout_template_id, exercise_id, sequence_number,
        peak_sets, rep_min, rep_max, increment_tenths_lb, rest_seconds, guidance, technique_check
      )
      select
        owner_id,
        new_template_id,
        exercise_id,
        exercise_ordinality::smallint,
        (prescribed->>'peakSets')::smallint,
        (prescribed->>'repMin')::smallint,
        (prescribed->>'repMax')::smallint,
        coalesce((prescribed->>'incrementTenthsLb')::integer, exercises.default_increment_tenths_lb),
        coalesce((prescribed->>'restSeconds')::integer, exercises.default_rest_seconds),
        coalesce(array(select jsonb_array_elements_text(prescribed->'guidance')), '{}'),
        exercises.technique_check
      from public.exercises
      cross join lateral (
        select ordinality as exercise_ordinality
        from jsonb_array_elements(template_record.document->'exercises') with ordinality
        where value = prescribed
        limit 1
      ) position
      where exercises.id = exercise_id;
    end loop;
  end loop;

  insert into public.program_cycles (
    user_id, program_revision_id, name, starts_on, timezone, status, current_week_number
  ) values (
    owner_id, new_revision_id, p_document->>'name', p_starts_on, 'America/Chicago', 'active', 1
  ) returning id into new_cycle_id;

  insert into public.scheduled_workouts (
    user_id, cycle_id, program_week_number, template_id, sequence_in_cycle,
    original_scheduled_date, current_scheduled_date, status
  )
  select
    owner_id,
    new_cycle_id,
    week_number,
    templates.id,
    ((week_number - 1) * 5) + templates.sequence_in_week,
    p_starts_on + (((week_number - 1) * 7) + templates.sequence_in_week - 1),
    p_starts_on + (((week_number - 1) * 7) + templates.sequence_in_week - 1),
    'queued'
  from generate_series(1, 12) as week_number
  cross join public.workout_templates templates
  where templates.program_revision_id = new_revision_id;

  return new_cycle_id;
end;
$$;

create function public.sync_workout_session(p_session jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  active_cycle_id uuid;
  revision_id uuid;
  scheduled_id uuid;
  session_id uuid := (p_session->>'id')::uuid;
  session_state public.session_status;
  exercise_record record;
  set_record record;
  prescribed_id uuid;
  performed_id uuid;
  exercise_state public.session_exercise_status;
  synced_exercises integer := 0;
  synced_sets integer := 0;
  client_revision integer := coalesce((p_session->>'serverRevision')::integer, 0);
  existing_revision integer;
begin
  if owner_id is null then
    raise exception 'Authentication required';
  end if;

  select cycles.id, cycles.program_revision_id
  into active_cycle_id, revision_id
  from public.program_cycles cycles
  where cycles.user_id = owner_id and cycles.status = 'active'
  limit 1;

  if active_cycle_id is null then
    raise exception 'An active program cycle is required before session synchronization';
  end if;

  select scheduled.id into scheduled_id
  from public.scheduled_workouts scheduled
  join public.workout_templates templates on templates.id = scheduled.template_id
  where scheduled.user_id = owner_id
    and scheduled.cycle_id = active_cycle_id
    and scheduled.program_week_number = (p_session->>'programWeek')::smallint
    and templates.name = p_session->>'templateName'
  limit 1;

  if scheduled_id is null then
    raise exception 'No scheduled workout matches this session';
  end if;

  session_state := case p_session->>'status'
    when 'completed' then 'completed'::public.session_status
    when 'partial' then 'partial'::public.session_status
    else 'active'::public.session_status
  end;

  select sessions.revision into existing_revision
  from public.workout_sessions sessions
  where sessions.id = session_id and sessions.user_id = owner_id
  for update;

  if existing_revision is not null and existing_revision <> client_revision then
    raise exception 'SYNC_CONFLICT: server revision %, client revision %', existing_revision, client_revision;
  end if;

  insert into public.workout_sessions (
    id, user_id, scheduled_workout_id, cycle_id, program_revision_id, program_week_number,
    template_name_snapshot, phase_name_snapshot, target_rir_min_snapshot, target_rir_max_snapshot,
    status, started_at, finished_at, performed_local_date, timezone,
    bodyweight_tenths_lb, energy_rating, discomfort_level, discomfort_notes, notes, next_time_adjustment,
    revision, client_created_at, updated_at
  ) values (
    session_id,
    owner_id,
    scheduled_id,
    active_cycle_id,
    revision_id,
    (p_session->>'programWeek')::smallint,
    p_session->>'templateName',
    p_session->>'phase',
    split_part(replace(p_session->>'targetRirLabel', '–', '-'), '-', 1)::smallint,
    case
      when position('-' in replace(p_session->>'targetRirLabel', '–', '-')) > 0
        then split_part(replace(p_session->>'targetRirLabel', '–', '-'), '-', 2)::smallint
      else (p_session->>'targetRirLabel')::smallint
    end,
    session_state,
    (p_session->>'startedAt')::timestamptz,
    case when session_state = 'active' then null else coalesce((p_session->>'finishedAt')::timestamptz, (p_session->>'updatedAt')::timestamptz) end,
    ((p_session->>'startedAt')::timestamptz at time zone 'America/Chicago')::date,
    'America/Chicago',
    nullif(p_session->>'bodyweightTenthsLb', '')::integer,
    nullif(p_session->>'energyRating', '')::smallint,
    nullif(p_session->>'discomfortLevel', ''),
    nullif(p_session->>'discomfortNotes', ''),
    nullif(p_session->>'sessionNotes', ''),
    nullif(p_session->>'nextTimeAdjustment', ''),
    client_revision + 1,
    (p_session->>'startedAt')::timestamptz,
    (p_session->>'updatedAt')::timestamptz
  )
  on conflict (id) do update set
    status = excluded.status,
    finished_at = excluded.finished_at,
    bodyweight_tenths_lb = excluded.bodyweight_tenths_lb,
    energy_rating = excluded.energy_rating,
    discomfort_level = excluded.discomfort_level,
    discomfort_notes = excluded.discomfort_notes,
    notes = excluded.notes,
    next_time_adjustment = excluded.next_time_adjustment,
    revision = public.workout_sessions.revision + 1,
    updated_at = excluded.updated_at;

  for exercise_record in
    select value as document, ordinality::smallint as sequence_number
    from jsonb_array_elements(p_session->'exercises') with ordinality
  loop
    select id into prescribed_id from public.exercises
    where slug = exercise_record.document->>'prescribedExerciseSlug'
      and (owner_user_id is null or owner_user_id = owner_id)
    order by owner_user_id nulls last limit 1;

    select id into performed_id from public.exercises
    where slug = exercise_record.document->>'performedExerciseSlug'
      and (owner_user_id is null or owner_user_id = owner_id)
    order by owner_user_id nulls last limit 1;

    if prescribed_id is null or performed_id is null then
      raise exception 'Session contains an unknown exercise';
    end if;

    exercise_state := case
      when not exists (
        select 1 from jsonb_array_elements(exercise_record.document->'sets') set_document
        where set_document->>'status' not in ('completed', 'skipped')
      ) then 'completed'::public.session_exercise_status
      else 'active'::public.session_exercise_status
    end;

    insert into public.session_exercises (
      id, user_id, session_id, sequence_number, prescribed_exercise_id, performed_exercise_id,
      replacement_reason, exercise_name_snapshot, load_basis_snapshot,
      rep_min_snapshot, rep_max_snapshot, prescribed_sets_snapshot, optional_sets_snapshot,
      increment_tenths_lb_snapshot, rest_seconds_snapshot, status, exercise_notes, revision
    ) values (
      (exercise_record.document->>'id')::uuid,
      owner_id,
      session_id,
      exercise_record.sequence_number,
      prescribed_id,
      performed_id,
      exercise_record.document->>'replacementReason',
      exercise_record.document->>'name',
      (exercise_record.document->>'loadBasis')::public.load_basis,
      (exercise_record.document->>'repMin')::smallint,
      (exercise_record.document->>'repMax')::smallint,
      jsonb_array_length(exercise_record.document->'sets')::smallint,
      0,
      (exercise_record.document->>'incrementTenthsLb')::integer,
      (exercise_record.document->>'restSeconds')::integer,
      exercise_state,
      nullif(exercise_record.document->>'notes', ''),
      1
    )
    on conflict (id) do update set
      performed_exercise_id = excluded.performed_exercise_id,
      replacement_reason = excluded.replacement_reason,
      exercise_name_snapshot = excluded.exercise_name_snapshot,
      load_basis_snapshot = excluded.load_basis_snapshot,
      status = excluded.status,
      exercise_notes = excluded.exercise_notes,
      revision = public.session_exercises.revision + 1,
      updated_at = now();

    synced_exercises := synced_exercises + 1;

    for set_record in
      select value as document from jsonb_array_elements(exercise_record.document->'sets')
    loop
      insert into public.exercise_sets (
        id, user_id, session_exercise_id, set_number, set_kind, status,
        load_mode, load_tenths_lb, reps, target_rir_min_snapshot, target_rir_max_snapshot,
        rir_on_target, actual_rir, actual_rir_over_six, actual_rir_unsure,
        completed_at, client_mutation_id, revision
      ) values (
        (set_record.document->>'id')::uuid,
        owner_id,
        (exercise_record.document->>'id')::uuid,
        (set_record.document->>'setNumber')::smallint,
        'working',
        case set_record.document->>'status'
          when 'completed' then 'completed'::public.exercise_set_status
          when 'skipped' then 'skipped'::public.exercise_set_status
          else 'draft'::public.exercise_set_status
        end,
        (set_record.document->>'loadMode')::public.load_basis,
        (set_record.document->>'loadTenthsLb')::integer,
        (set_record.document->>'reps')::smallint,
        split_part(replace(exercise_record.document->>'targetRirLabel', '–', '-'), '-', 1)::smallint,
        case
          when position('-' in replace(exercise_record.document->>'targetRirLabel', '–', '-')) > 0
            then split_part(replace(exercise_record.document->>'targetRirLabel', '–', '-'), '-', 2)::smallint
          else (exercise_record.document->>'targetRirLabel')::smallint
        end,
        (set_record.document->>'rirOnTarget')::boolean,
        case when set_record.document->>'actualRir' ~ '^[0-6]$' then (set_record.document->>'actualRir')::smallint else null end,
        coalesce(set_record.document->>'actualRir' = '6+', false),
        coalesce(set_record.document->>'actualRir' = 'unsure', false),
        (set_record.document->>'completedAt')::timestamptz,
        (set_record.document->>'id')::uuid,
        1
      )
      on conflict (id) do update set
        status = excluded.status,
        load_mode = excluded.load_mode,
        load_tenths_lb = excluded.load_tenths_lb,
        reps = excluded.reps,
        rir_on_target = excluded.rir_on_target,
        actual_rir = excluded.actual_rir,
        actual_rir_over_six = excluded.actual_rir_over_six,
        actual_rir_unsure = excluded.actual_rir_unsure,
        completed_at = excluded.completed_at,
        revision = public.exercise_sets.revision + 1,
        updated_at = now();

      synced_sets := synced_sets + 1;
    end loop;
  end loop;

  update public.scheduled_workouts
  set status = case session_state
    when 'completed' then 'completed'::public.scheduled_workout_status
    when 'partial' then 'partial'::public.scheduled_workout_status
    else 'active'::public.scheduled_workout_status
  end
  where id = scheduled_id and user_id = owner_id;

  return jsonb_build_object(
    'sessionId', session_id,
    'serverRevision', (select revision from public.workout_sessions where id = session_id),
    'exercises', synced_exercises,
    'sets', synced_sets
  );
end;
$$;

revoke all on function public.bootstrap_program_cycle(jsonb, date) from public, anon;
revoke all on function public.sync_workout_session(jsonb) from public, anon;
grant execute on function public.bootstrap_program_cycle(jsonb, date) to authenticated;
grant execute on function public.sync_workout_session(jsonb) to authenticated;

commit;
