begin;

create table public.scheduled_rest_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  cycle_id uuid not null,
  before_sequence_in_cycle integer not null check (before_sequence_in_cycle > 0),
  rest_date date not null,
  created_at timestamptz not null default now(),
  foreign key (cycle_id, user_id) references public.program_cycles(id, user_id) on delete cascade
);
create index scheduled_rest_days_cycle_idx on public.scheduled_rest_days(cycle_id, before_sequence_in_cycle);
alter table public.scheduled_rest_days enable row level security;
grant select, insert on public.scheduled_rest_days to authenticated;
create policy scheduled_rest_days_select_own on public.scheduled_rest_days for select to authenticated using (user_id = auth.uid());
create policy scheduled_rest_days_insert_own on public.scheduled_rest_days for insert to authenticated with check (user_id = auth.uid());

create function public.insert_rest_day_before_workout(p_scheduled_workout_id uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  active_cycle uuid;
  from_sequence integer;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  select id into active_cycle from public.program_cycles where user_id = owner_id and status = 'active' limit 1;
  select sequence_in_cycle into from_sequence
  from public.scheduled_workouts
  where id = p_scheduled_workout_id and user_id = owner_id and cycle_id = active_cycle and status = 'queued';
  if from_sequence is null then raise exception 'Upcoming workout not found'; end if;

  insert into public.scheduled_rest_days (user_id, cycle_id, before_sequence_in_cycle, rest_date)
  select owner_id, active_cycle, from_sequence, current_scheduled_date
  from public.scheduled_workouts where id = p_scheduled_workout_id;

  update public.scheduled_workouts
  set current_scheduled_date = current_scheduled_date + 1
  where user_id = owner_id and cycle_id = active_cycle and status = 'queued' and sequence_in_cycle >= from_sequence;
  return true;
end;
$$;

create or replace function public.get_upcoming_workout_queue(p_limit integer default 5)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'scheduledWorkoutId', queued.id, 'sequenceInCycle', queued.sequence_in_cycle,
    'programWeek', queued.program_week_number, 'templateSequence', templates.sequence_in_week,
    'templateName', templates.name, 'scheduledDate', queued.current_scheduled_date,
    'restDaysBefore', (select count(*) from public.scheduled_rest_days rests where rests.cycle_id = queued.cycle_id and rests.before_sequence_in_cycle = queued.sequence_in_cycle)
  ) order by queued.sequence_in_cycle), '[]'::jsonb)
  from (
    select * from public.scheduled_workouts
    where user_id = auth.uid() and cycle_id = (select id from public.program_cycles where user_id = auth.uid() and status = 'active' limit 1)
      and status = 'queued'
    order by sequence_in_cycle limit least(greatest(p_limit, 1), 10)
  ) queued
  join public.workout_templates templates on templates.id = queued.template_id;
$$;

revoke all on function public.insert_rest_day_before_workout(uuid) from public, anon;
grant execute on function public.insert_rest_day_before_workout(uuid) to authenticated;

commit;
