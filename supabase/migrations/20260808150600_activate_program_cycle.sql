begin;

create or replace function public.activate_program_cycle(p_document jsonb, p_starts_on date)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  new_cycle_id uuid;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  if extract(isodow from p_starts_on) <> 1 then raise exception 'A program cycle must start on Monday'; end if;
  if exists (select 1 from public.workout_sessions where user_id = owner_id and status = 'active') then
    raise exception 'Finish or abandon the active workout before starting a new cycle';
  end if;

  update public.program_cycles set status = 'completed', completed_at = now()
  where user_id = owner_id and status = 'active';
  update public.scheduled_workouts set status = 'skipped', skipped_reason = 'cycle_replaced'
  where user_id = owner_id and status = 'queued';

  new_cycle_id := public.bootstrap_program_cycle(p_document, p_starts_on);
  return new_cycle_id;
end;
$$;

revoke all on function public.activate_program_cycle(jsonb, date) from public, anon;
grant execute on function public.activate_program_cycle(jsonb, date) to authenticated;

commit;
