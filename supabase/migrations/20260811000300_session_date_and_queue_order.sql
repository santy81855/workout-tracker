begin;

create function public.correct_workout_performed_date(p_session_id uuid, p_performed_date date)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  prior public.workout_sessions%rowtype;
  new_started_at timestamptz;
  new_finished_at timestamptz;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  if p_performed_date is null or p_performed_date > current_date then raise exception 'Workout date must be today or earlier'; end if;
  select * into prior from public.workout_sessions where id = p_session_id and user_id = owner_id and status in ('completed', 'partial') for update;
  if prior.id is null then raise exception 'Completed workout not found'; end if;

  new_started_at := (p_performed_date + (prior.started_at at time zone prior.timezone)::time) at time zone prior.timezone;
  new_finished_at := case when prior.finished_at is null then null else new_started_at + (prior.finished_at - prior.started_at) end;

  update public.workout_sessions
  set performed_local_date = p_performed_date, started_at = new_started_at, finished_at = new_finished_at,
      revision = revision + 1, updated_at = now()
  where id = p_session_id and user_id = owner_id;

  insert into public.edit_audit_events (user_id, entity_type, entity_id, action, before_values, after_values, reason, client_mutation_id)
  values (owner_id, 'workout_session', p_session_id, 'correct_session_date',
    jsonb_build_object('performedLocalDate', prior.performed_local_date, 'startedAt', prior.started_at, 'finishedAt', prior.finished_at),
    jsonb_build_object('performedLocalDate', p_performed_date, 'startedAt', new_started_at, 'finishedAt', new_finished_at),
    'post_completion_date_correction', gen_random_uuid());

  return jsonb_build_object('serverRevision', prior.revision + 1, 'startedAt', new_started_at, 'finishedAt', new_finished_at);
end;
$$;

create function public.get_upcoming_workout_queue(p_limit integer default 5)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'scheduledWorkoutId', queued.id, 'sequenceInCycle', queued.sequence_in_cycle,
    'programWeek', queued.program_week_number, 'templateSequence', templates.sequence_in_week,
    'templateName', templates.name, 'scheduledDate', queued.current_scheduled_date
  ) order by queued.sequence_in_cycle), '[]'::jsonb)
  from (
    select * from public.scheduled_workouts
    where user_id = auth.uid() and cycle_id = (select id from public.program_cycles where user_id = auth.uid() and status = 'active' limit 1)
      and status = 'queued'
    order by sequence_in_cycle limit least(greatest(p_limit, 1), 10)
  ) queued
  join public.workout_templates templates on templates.id = queued.template_id;
$$;

create function public.swap_upcoming_workouts(p_first_id uuid, p_second_id uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare owner_id uuid := auth.uid(); first_template uuid; second_template uuid; active_cycle uuid; first_week integer; second_week integer;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  select id into active_cycle from public.program_cycles where user_id = owner_id and status = 'active' limit 1;
  select template_id, program_week_number into first_template, first_week from public.scheduled_workouts where id = p_first_id and user_id = owner_id and cycle_id = active_cycle and status = 'queued' for update;
  select template_id, program_week_number into second_template, second_week from public.scheduled_workouts where id = p_second_id and user_id = owner_id and cycle_id = active_cycle and status = 'queued' for update;
  if first_template is null or second_template is null then raise exception 'Both workouts must be upcoming queued sessions'; end if;
  if exists (select 1 from public.scheduled_workouts where cycle_id = active_cycle and program_week_number = first_week and template_id = second_template and id not in (p_first_id, p_second_id))
    or exists (select 1 from public.scheduled_workouts where cycle_id = active_cycle and program_week_number = second_week and template_id = first_template and id not in (p_first_id, p_second_id))
  then raise exception 'That swap would duplicate a workout inside one program week'; end if;
  update public.scheduled_workouts set template_id = case id when p_first_id then second_template else first_template end
  where id in (p_first_id, p_second_id) and user_id = owner_id;
  return true;
end;
$$;

revoke all on function public.correct_workout_performed_date(uuid, date) from public, anon;
revoke all on function public.get_upcoming_workout_queue(integer) from public, anon;
revoke all on function public.swap_upcoming_workouts(uuid, uuid) from public, anon;
grant execute on function public.correct_workout_performed_date(uuid, date) to authenticated;
grant execute on function public.get_upcoming_workout_queue(integer) to authenticated;
grant execute on function public.swap_upcoming_workouts(uuid, uuid) to authenticated;

commit;
