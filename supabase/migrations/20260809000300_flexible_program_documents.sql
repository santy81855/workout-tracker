begin;

create or replace function public.bootstrap_program_cycle(p_document jsonb, p_starts_on date)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  owner_id uuid := auth.uid(); existing_cycle_id uuid; new_program_id uuid; new_revision_id uuid; new_cycle_id uuid;
  week_rule jsonb; template_record record; prescribed_record record; exercise_document jsonb; muscle_document jsonb;
  new_template_id uuid; exercise_id uuid; source_checksum text; week_count integer; workouts_per_week integer;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  if p_document->>'schemaVersion' <> '1.0' then raise exception 'Unsupported program schema version'; end if;
  week_count := (p_document->>'weekCount')::integer;
  workouts_per_week := (p_document->>'workoutsPerWeek')::integer;
  if week_count not between 1 and 52 then raise exception 'Programs must contain between 1 and 52 weeks'; end if;
  if workouts_per_week not between 1 and 7 then raise exception 'Programs must contain between 1 and 7 workouts per week'; end if;
  if jsonb_array_length(p_document->'weekRules') <> week_count then raise exception 'Week-rule count must match weekCount'; end if;
  if jsonb_array_length(p_document->'workoutTemplates') <> workouts_per_week then raise exception 'Template count must match workoutsPerWeek'; end if;

  select id into existing_cycle_id from public.program_cycles where user_id = owner_id and status = 'active' limit 1;
  if existing_cycle_id is not null then return existing_cycle_id; end if;

  source_checksum := encode(extensions.digest(convert_to(p_document::text, 'UTF8'), 'sha256'), 'hex');
  insert into public.programs (user_id, name, description, source_format_version)
  values (owner_id, p_document->>'name', p_document->>'description', p_document->>'schemaVersion') returning id into new_program_id;
  insert into public.program_revisions (user_id, program_id, revision_number, source_json, source_checksum, week_count, workouts_per_week, status, published_at)
  values (owner_id, new_program_id, 1, p_document, source_checksum, week_count, workouts_per_week, 'published', now()) returning id into new_revision_id;

  for exercise_document in select value from jsonb_array_elements(p_document->'exercises') loop
    select id into exercise_id from public.exercises
    where slug = exercise_document->>'slug' and (owner_user_id is null or owner_user_id = owner_id)
    order by (owner_user_id is null) desc limit 1;
    if exercise_id is null then
      insert into public.exercises (owner_user_id, slug, name, equipment_type, load_basis, default_increment_tenths_lb, default_rest_seconds, guidance, technique_check, is_curated)
      values (owner_id, exercise_document->>'slug', exercise_document->>'name', exercise_document->>'equipment', (exercise_document->>'loadBasis')::public.load_basis,
        (exercise_document->>'defaultIncrementTenthsLb')::integer, (exercise_document->>'defaultRestSeconds')::integer,
        coalesce(array(select jsonb_array_elements_text(exercise_document->'guidance')), '{}'), nullif(exercise_document->>'techniqueCheck', ''), false)
      returning id into exercise_id;
      for muscle_document in select value from jsonb_array_elements(exercise_document->'muscles') loop
        insert into public.exercise_muscles (exercise_id, muscle_group_id, owner_user_id, contribution_tenths, role)
        select exercise_id, groups.id, owner_id,
          case when (muscle_document->>'contribution')::numeric = 1 then 10 else 5 end,
          case when (muscle_document->>'contribution')::numeric = 1 then 'primary' else 'secondary' end
        from public.muscle_groups groups where groups.slug = muscle_document->>'muscle';
      end loop;
    end if;
  end loop;

  for week_rule in select value from jsonb_array_elements(p_document->'weekRules') loop
    insert into public.program_week_rules (user_id, program_revision_id, week_number, phase_name, target_rir_min, target_rir_max, is_deload, load_reduction_min_percent, load_reduction_max_percent)
    values (owner_id, new_revision_id, (week_rule->>'week')::smallint, week_rule->>'phase', (week_rule->'targetRir'->>'min')::smallint,
      (week_rule->'targetRir'->>'max')::smallint, (week_rule->>'isDeload')::boolean,
      case when (week_rule->>'isDeload')::boolean then 10 else null end, case when (week_rule->>'isDeload')::boolean then 20 else null end);
    insert into public.program_set_rules (user_id, program_revision_id, week_number, peak_sets, prescribed_sets, optional_additional_sets) values
      (owner_id, new_revision_id, (week_rule->>'week')::smallint, 2, (week_rule->'setRules'->'peak2'->>'required')::smallint, (week_rule->'setRules'->'peak2'->>'optional')::smallint),
      (owner_id, new_revision_id, (week_rule->>'week')::smallint, 3, (week_rule->'setRules'->'peak3'->>'required')::smallint, (week_rule->'setRules'->'peak3'->>'optional')::smallint),
      (owner_id, new_revision_id, (week_rule->>'week')::smallint, 4, (week_rule->'setRules'->'peak4'->>'required')::smallint, (week_rule->'setRules'->'peak4'->>'optional')::smallint);
  end loop;

  for template_record in select value as document, ordinality::smallint as position from jsonb_array_elements(p_document->'workoutTemplates') with ordinality loop
    insert into public.workout_templates (user_id, program_revision_id, sequence_in_week, name, original_day_label)
    values (owner_id, new_revision_id, (template_record.document->>'sequence')::smallint, template_record.document->>'name', template_record.document->>'originalDayLabel')
    returning id into new_template_id;
    for prescribed_record in select value as document, ordinality::smallint as position from jsonb_array_elements(template_record.document->'exercises') with ordinality loop
      select id into exercise_id from public.exercises where slug = prescribed_record.document->>'exercise' and (owner_user_id is null or owner_user_id = owner_id)
      order by (owner_user_id is null) desc limit 1;
      if exercise_id is null then raise exception 'Unknown exercise: %', prescribed_record.document->>'exercise'; end if;
      insert into public.workout_template_exercises (user_id, workout_template_id, exercise_id, sequence_number, peak_sets, rep_min, rep_max, increment_tenths_lb, rest_seconds, guidance, technique_check)
      select owner_id, new_template_id, exercise_id, prescribed_record.position, (prescribed_record.document->>'peakSets')::smallint,
        (prescribed_record.document->>'repMin')::smallint, (prescribed_record.document->>'repMax')::smallint,
        coalesce((prescribed_record.document->>'incrementTenthsLb')::integer, exercises.default_increment_tenths_lb),
        coalesce((prescribed_record.document->>'restSeconds')::integer, exercises.default_rest_seconds),
        coalesce(array(select jsonb_array_elements_text(prescribed_record.document->'guidance')), '{}'), exercises.technique_check
      from public.exercises where exercises.id = exercise_id;
    end loop;
  end loop;

  insert into public.program_cycles (user_id, program_revision_id, name, starts_on, timezone, status, current_week_number)
  values (owner_id, new_revision_id, p_document->>'name', p_starts_on, 'America/Chicago', 'active', 1) returning id into new_cycle_id;
  insert into public.scheduled_workouts (user_id, cycle_id, program_week_number, template_id, sequence_in_cycle, original_scheduled_date, current_scheduled_date, status)
  select owner_id, new_cycle_id, week_number, templates.id, ((week_number - 1) * workouts_per_week) + templates.sequence_in_week,
    p_starts_on + (((week_number - 1) * 7) + templates.sequence_in_week - 1), p_starts_on + (((week_number - 1) * 7) + templates.sequence_in_week - 1), 'queued'
  from generate_series(1, week_count) week_number cross join public.workout_templates templates where templates.program_revision_id = new_revision_id;
  return new_cycle_id;
end; $$;

commit;
