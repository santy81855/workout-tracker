begin;

create or replace function public.activate_program_cycle(p_document jsonb, p_starts_on date)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare owner_id uuid := auth.uid(); new_cycle_id uuid;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  if p_starts_on is null then raise exception 'A program cycle requires a start date'; end if;
  if exists (select 1 from public.workout_sessions where user_id = owner_id and status = 'active') then raise exception 'Finish or abandon the active workout before changing plans'; end if;
  update public.program_cycles set status = 'planned' where user_id = owner_id and status = 'active';
  new_cycle_id := public.bootstrap_program_cycle(p_document, p_starts_on);
  return new_cycle_id;
end; $$;

create or replace function public.save_program_to_library(p_document jsonb, p_starts_on date)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare owner_id uuid := auth.uid(); prior_active_id uuid; saved_cycle_id uuid;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  if p_starts_on is null then raise exception 'A program cycle requires a start date'; end if;
  select id into prior_active_id from public.program_cycles where user_id = owner_id and status = 'active' limit 1;
  if prior_active_id is not null then update public.program_cycles set status = 'planned' where id = prior_active_id; end if;
  saved_cycle_id := public.bootstrap_program_cycle(p_document, p_starts_on);
  update public.program_cycles set status = 'planned' where id = saved_cycle_id and user_id = owner_id;
  if prior_active_id is not null then update public.program_cycles set status = 'active' where id = prior_active_id; end if;
  return saved_cycle_id;
end; $$;

revoke all on function public.activate_program_cycle(jsonb, date) from public, anon;
revoke all on function public.save_program_to_library(jsonb, date) from public, anon;
grant execute on function public.activate_program_cycle(jsonb, date) to authenticated;
grant execute on function public.save_program_to_library(jsonb, date) to authenticated;

commit;
