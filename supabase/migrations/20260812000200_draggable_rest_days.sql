begin;

grant update on public.scheduled_rest_days to authenticated;
create policy scheduled_rest_days_update_own on public.scheduled_rest_days for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

create function public.move_scheduled_rest_day(p_rest_day_id uuid, p_before_workout_id uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  active_cycle uuid;
  old_sequence integer;
  new_sequence integer;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  select id into active_cycle from public.program_cycles where user_id = owner_id and status = 'active' limit 1;
  select before_sequence_in_cycle into old_sequence from public.scheduled_rest_days
  where id = p_rest_day_id and user_id = owner_id and cycle_id = active_cycle for update;
  select sequence_in_cycle into new_sequence from public.scheduled_workouts
  where id = p_before_workout_id and user_id = owner_id and cycle_id = active_cycle and status = 'queued';
  if old_sequence is null or new_sequence is null then raise exception 'Rest day or upcoming workout not found'; end if;
  if old_sequence = new_sequence then return true; end if;

  if new_sequence > old_sequence then
    update public.scheduled_workouts set current_scheduled_date = current_scheduled_date - 1
    where user_id = owner_id and cycle_id = active_cycle and status = 'queued'
      and sequence_in_cycle >= old_sequence and sequence_in_cycle < new_sequence;
  else
    update public.scheduled_workouts set current_scheduled_date = current_scheduled_date + 1
    where user_id = owner_id and cycle_id = active_cycle and status = 'queued'
      and sequence_in_cycle >= new_sequence and sequence_in_cycle < old_sequence;
  end if;

  update public.scheduled_rest_days
  set before_sequence_in_cycle = new_sequence,
      rest_date = (select current_scheduled_date - 1 from public.scheduled_workouts where id = p_before_workout_id)
  where id = p_rest_day_id and user_id = owner_id;
  return true;
end;
$$;

create or replace function public.get_upcoming_workout_queue(p_limit integer default 5)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'scheduledWorkoutId', queued.id, 'sequenceInCycle', queued.sequence_in_cycle,
    'programWeek', queued.program_week_number, 'templateSequence', templates.sequence_in_week,
    'templateName', templates.name, 'scheduledDate', queued.current_scheduled_date,
    'restDays', coalesce((select jsonb_agg(jsonb_build_object('id', rests.id, 'restDate', rests.rest_date) order by rests.created_at)
      from public.scheduled_rest_days rests where rests.cycle_id = queued.cycle_id and rests.before_sequence_in_cycle = queued.sequence_in_cycle), '[]'::jsonb)
  ) order by queued.sequence_in_cycle), '[]'::jsonb)
  from (
    select * from public.scheduled_workouts
    where user_id = auth.uid() and cycle_id = (select id from public.program_cycles where user_id = auth.uid() and status = 'active' limit 1)
      and status = 'queued'
    order by sequence_in_cycle limit least(greatest(p_limit, 1), 10)
  ) queued
  join public.workout_templates templates on templates.id = queued.template_id;
$$;

revoke all on function public.move_scheduled_rest_day(uuid, uuid) from public, anon;
grant execute on function public.move_scheduled_rest_day(uuid, uuid) to authenticated;

commit;
