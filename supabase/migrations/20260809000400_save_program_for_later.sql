begin;

create function public.save_program_to_library(p_document jsonb, p_starts_on date)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare owner_id uuid := auth.uid(); prior_active_id uuid; saved_cycle_id uuid;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  if extract(isodow from p_starts_on) <> 1 then raise exception 'A program cycle must start on Monday'; end if;
  select id into prior_active_id from public.program_cycles where user_id = owner_id and status = 'active' limit 1;
  if prior_active_id is not null then update public.program_cycles set status = 'planned' where id = prior_active_id; end if;
  saved_cycle_id := public.bootstrap_program_cycle(p_document, p_starts_on);
  update public.program_cycles set status = 'planned' where id = saved_cycle_id and user_id = owner_id;
  if prior_active_id is not null then update public.program_cycles set status = 'active' where id = prior_active_id; end if;
  return saved_cycle_id;
end; $$;

revoke all on function public.save_program_to_library(jsonb, date) from public, anon;
grant execute on function public.save_program_to_library(jsonb, date) to authenticated;

commit;
