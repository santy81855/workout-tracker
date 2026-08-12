begin;

create or replace function public.swap_upcoming_workouts(p_first_id uuid, p_second_id uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  first_template uuid;
  second_template uuid;
  active_cycle uuid;
  first_week integer;
  second_week integer;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;

  select id into active_cycle
  from public.program_cycles
  where user_id = owner_id and status = 'active'
  limit 1;

  select template_id, program_week_number into first_template, first_week
  from public.scheduled_workouts
  where id = p_first_id and user_id = owner_id and cycle_id = active_cycle and status = 'queued'
  for update;

  select template_id, program_week_number into second_template, second_week
  from public.scheduled_workouts
  where id = p_second_id and user_id = owner_id and cycle_id = active_cycle and status = 'queued'
  for update;

  if first_template is null or second_template is null then
    raise exception 'Both workouts must be upcoming queued sessions';
  end if;

  if exists (
    select 1 from public.scheduled_workouts
    where cycle_id = active_cycle
      and program_week_number = first_week
      and template_id = second_template
      and id not in (p_first_id, p_second_id)
  ) or exists (
    select 1 from public.scheduled_workouts
    where cycle_id = active_cycle
      and program_week_number = second_week
      and template_id = first_template
      and id not in (p_first_id, p_second_id)
  ) then
    raise exception 'That swap would duplicate a workout inside one program week';
  end if;

  update public.scheduled_workouts
  set template_id = case id
    when p_first_id then second_template
    else first_template
  end
  where id in (p_first_id, p_second_id) and user_id = owner_id;

  return true;
end;
$$;

revoke all on function public.swap_upcoming_workouts(uuid, uuid) from public, anon;
grant execute on function public.swap_upcoming_workouts(uuid, uuid) to authenticated;

commit;
