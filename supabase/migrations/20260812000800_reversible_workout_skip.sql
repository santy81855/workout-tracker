begin;

create function public.skip_scheduled_workout(p_scheduled_workout_id uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  target_sequence integer;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;

  select sequence_in_cycle into target_sequence
  from public.scheduled_workouts
  where id = p_scheduled_workout_id
    and user_id = owner_id
    and cycle_id = (select id from public.program_cycles where user_id = owner_id and status = 'active' limit 1)
    and status = 'queued'
  for update;

  if target_sequence is null then raise exception 'Queued workout not found'; end if;
  if exists (
    select 1 from public.scheduled_workouts
    where user_id = owner_id
      and cycle_id = (select id from public.program_cycles where user_id = owner_id and status = 'active' limit 1)
      and status = 'queued' and sequence_in_cycle < target_sequence
  ) then raise exception 'Only the next workout can be skipped'; end if;

  update public.scheduled_workouts
  set status = 'skipped', skipped_reason = 'user_skipped', updated_at = now()
  where id = p_scheduled_workout_id and user_id = owner_id;
  return true;
end;
$$;

create function public.get_recoverable_skipped_workout()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce((
    select jsonb_build_object(
      'scheduledWorkoutId', skipped.id,
      'sequenceInCycle', skipped.sequence_in_cycle,
      'programWeek', skipped.program_week_number,
      'templateSequence', templates.sequence_in_week,
      'templateName', templates.name,
      'scheduledDate', skipped.current_scheduled_date
    )
    from public.scheduled_workouts skipped
    join public.workout_templates templates on templates.id = skipped.template_id
    where skipped.user_id = auth.uid()
      and skipped.cycle_id = (select id from public.program_cycles where user_id = auth.uid() and status = 'active' limit 1)
      and skipped.status = 'skipped'
      and skipped.skipped_reason = 'user_skipped'
      and not exists (
        select 1 from public.scheduled_workouts later
        where later.cycle_id = skipped.cycle_id
          and later.user_id = skipped.user_id
          and later.sequence_in_cycle > skipped.sequence_in_cycle
          and later.status in ('completed', 'partial')
      )
    order by skipped.sequence_in_cycle desc
    limit 1
  ), 'null'::jsonb);
$$;

create function public.unskip_scheduled_workout(p_scheduled_workout_id uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  target_sequence integer;
  active_cycle uuid;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  select id into active_cycle from public.program_cycles where user_id = owner_id and status = 'active' limit 1;

  select sequence_in_cycle into target_sequence
  from public.scheduled_workouts
  where id = p_scheduled_workout_id and user_id = owner_id and cycle_id = active_cycle
    and status = 'skipped' and skipped_reason = 'user_skipped'
  for update;
  if target_sequence is null then raise exception 'Recoverable skipped workout not found'; end if;
  if exists (
    select 1 from public.scheduled_workouts
    where user_id = owner_id and cycle_id = active_cycle
      and sequence_in_cycle > target_sequence and status in ('completed', 'partial')
  ) then raise exception 'This workout can no longer be restored because a later workout is complete'; end if;

  update public.scheduled_workouts
  set status = 'queued', skipped_reason = null, updated_at = now()
  where id = p_scheduled_workout_id and user_id = owner_id;
  return true;
end;
$$;

revoke all on function public.skip_scheduled_workout(uuid) from public, anon;
revoke all on function public.get_recoverable_skipped_workout() from public, anon;
revoke all on function public.unskip_scheduled_workout(uuid) from public, anon;
grant execute on function public.skip_scheduled_workout(uuid) to authenticated;
grant execute on function public.get_recoverable_skipped_workout() to authenticated;
grant execute on function public.unskip_scheduled_workout(uuid) to authenticated;

commit;
