begin;

alter function public.bootstrap_program_cycle(jsonb, date) rename to bootstrap_program_cycle_fixed_templates;

create function public.bootstrap_program_cycle(p_document jsonb, p_starts_on date)
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
  if v_template_count not between 1 and 7 then raise exception 'Programs must contain between 1 and 7 workout templates'; end if;

  -- Reuse the validated program persistence path, then replace its fixed weekly
  -- schedule with a cadence that can rotate through a different template count.
  legacy_document := jsonb_set(jsonb_set(p_document, '{workoutsPerWeek}', to_jsonb(v_template_count)), '{trainingDaysPerWeek}', to_jsonb(v_workouts_per_week));
  v_cycle_id := public.bootstrap_program_cycle_fixed_templates(legacy_document, p_starts_on);

  select program_revision_id into v_revision_id
  from public.program_cycles where id = v_cycle_id and user_id = owner_id;

  delete from public.scheduled_workouts where cycle_id = v_cycle_id and user_id = owner_id;

  insert into public.scheduled_workouts (
    user_id, cycle_id, program_week_number, template_id, sequence_in_cycle,
    original_scheduled_date, current_scheduled_date, status
  )
  select owner_id, v_cycle_id,
    (((session_number - 1) / v_workouts_per_week) + 1)::smallint,
    templates.id,
    session_number,
    p_starts_on + ((((session_number - 1) / v_workouts_per_week) * 7) + ((session_number - 1) % v_workouts_per_week))::integer,
    p_starts_on + ((((session_number - 1) / v_workouts_per_week) * 7) + ((session_number - 1) % v_workouts_per_week))::integer,
    'queued'
  from generate_series(1, v_week_count * v_workouts_per_week) session_number
  join public.workout_templates templates
    on templates.program_revision_id = v_revision_id
   and templates.sequence_in_week = (((session_number - 1) % v_template_count) + 1);

  return v_cycle_id;
end;
$$;

revoke all on function public.bootstrap_program_cycle_fixed_templates(jsonb, date) from public, anon, authenticated;
revoke all on function public.bootstrap_program_cycle(jsonb, date) from public, anon;
grant execute on function public.bootstrap_program_cycle(jsonb, date) to authenticated;

create or replace function public.get_program_library()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'cycleId', cycles.id,
    'status', cycles.status::text,
    'startsOn', cycles.starts_on,
    'completedAt', cycles.completed_at,
    'document', case when revisions.source_json ? 'trainingDaysPerWeek'
      then jsonb_set(revisions.source_json, '{workoutsPerWeek}', revisions.source_json->'trainingDaysPerWeek')
      else revisions.source_json end,
    'completedSessions', (select count(*) from public.workout_sessions sessions where sessions.cycle_id = cycles.id and sessions.user_id = auth.uid() and sessions.status in ('completed', 'partial'))
  ) order by cycles.created_at desc), '[]'::jsonb)
  from public.program_cycles cycles
  join public.program_revisions revisions on revisions.id = cycles.program_revision_id
  where cycles.user_id = auth.uid() and cycles.status <> 'abandoned';
$$;

commit;
