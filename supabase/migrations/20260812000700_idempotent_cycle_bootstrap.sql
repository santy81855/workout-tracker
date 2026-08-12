begin;

create or replace function public.bootstrap_program_cycle(p_document jsonb, p_starts_on date)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  v_cycle_id uuid;
  v_revision_id uuid;
  v_week_count integer := (p_document->>'weekCount')::integer;
  v_workouts_per_week integer := (p_document->>'workoutsPerWeek')::integer;
  v_template_count integer := jsonb_array_length(p_document->'workoutTemplates');
  legacy_document jsonb;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;

  -- Sync calls bootstrap defensively. An existing cycle must be returned without
  -- rebuilding its mutable queue, which may already be reordered or referenced.
  select id into v_cycle_id from public.program_cycles
  where user_id = owner_id and status = 'active' limit 1;
  if v_cycle_id is not null then return v_cycle_id; end if;

  if v_template_count not between 1 and 7 then raise exception 'Programs must contain between 1 and 7 workout templates'; end if;
  legacy_document := jsonb_set(jsonb_set(p_document, '{workoutsPerWeek}', to_jsonb(v_template_count)), '{trainingDaysPerWeek}', to_jsonb(v_workouts_per_week));
  v_cycle_id := public.bootstrap_program_cycle_fixed_templates(legacy_document, p_starts_on);

  select program_revision_id into v_revision_id from public.program_cycles where id = v_cycle_id and user_id = owner_id;
  delete from public.scheduled_workouts where cycle_id = v_cycle_id and user_id = owner_id;
  insert into public.scheduled_workouts (
    user_id, cycle_id, program_week_number, template_id, sequence_in_cycle,
    original_scheduled_date, current_scheduled_date, status
  )
  select owner_id, v_cycle_id,
    (((session_number - 1) / v_workouts_per_week) + 1)::smallint,
    templates.id, session_number,
    p_starts_on + ((((session_number - 1) / v_workouts_per_week) * 7) + ((session_number - 1) % v_workouts_per_week))::integer,
    p_starts_on + ((((session_number - 1) / v_workouts_per_week) * 7) + ((session_number - 1) % v_workouts_per_week))::integer,
    'queued'
  from generate_series(1, v_week_count * v_workouts_per_week) session_number
  join public.workout_templates templates on templates.program_revision_id = v_revision_id
    and templates.sequence_in_week = (((session_number - 1) % v_template_count) + 1);
  return v_cycle_id;
end;
$$;

create function public.align_scheduled_workout_slot(p_sequence_in_cycle integer, p_program_week integer, p_template_name text)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare
  owner_id uuid := auth.uid(); active_cycle uuid; target_id uuid; target_template uuid;
  desired_template uuid; other_id uuid;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  select id into active_cycle from public.program_cycles where user_id = owner_id and status = 'active' limit 1;
  select id, template_id into target_id, target_template from public.scheduled_workouts
  where user_id = owner_id and cycle_id = active_cycle and sequence_in_cycle = p_sequence_in_cycle for update;
  select id into desired_template from public.workout_templates
  where user_id = owner_id and program_revision_id = (select program_revision_id from public.program_cycles where id = active_cycle)
    and name = p_template_name limit 1;
  if target_id is null or desired_template is null then raise exception 'Scheduled workout slot or template not found'; end if;
  if target_template = desired_template then return true; end if;

  select id into other_id from public.scheduled_workouts
  where user_id = owner_id and cycle_id = active_cycle and program_week_number = p_program_week
    and template_id = desired_template and id <> target_id limit 1 for update;
  if other_id is not null then update public.scheduled_workouts set template_id = target_template where id = other_id and user_id = owner_id; end if;
  update public.scheduled_workouts set template_id = desired_template where id = target_id and user_id = owner_id;
  return true;
end;
$$;

revoke all on function public.align_scheduled_workout_slot(integer, integer, text) from public, anon;
grant execute on function public.align_scheduled_workout_slot(integer, integer, text) to authenticated;

commit;
