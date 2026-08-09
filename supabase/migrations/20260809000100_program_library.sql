begin;

create or replace function public.activate_program_cycle(p_document jsonb, p_starts_on date)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare owner_id uuid := auth.uid(); new_cycle_id uuid;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  if extract(isodow from p_starts_on) <> 1 then raise exception 'A program cycle must start on Monday'; end if;
  if exists (select 1 from public.workout_sessions where user_id = owner_id and status = 'active') then raise exception 'Finish or abandon the active workout before changing plans'; end if;
  update public.program_cycles set status = 'planned' where user_id = owner_id and status = 'active';
  new_cycle_id := public.bootstrap_program_cycle(p_document, p_starts_on);
  return new_cycle_id;
end; $$;

create function public.resume_program_cycle(p_cycle_id uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare owner_id uuid := auth.uid();
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  if exists (select 1 from public.workout_sessions where user_id = owner_id and status = 'active') then raise exception 'Finish or abandon the active workout before changing plans'; end if;
  if not exists (select 1 from public.program_cycles where id = p_cycle_id and user_id = owner_id and status = 'planned') then raise exception 'Paused plan not found'; end if;
  update public.program_cycles set status = 'planned' where user_id = owner_id and status = 'active';
  update public.program_cycles set status = 'active', completed_at = null where id = p_cycle_id and user_id = owner_id;
  return true;
end; $$;

create function public.get_program_library()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'cycleId', cycles.id,
    'status', cycles.status::text,
    'startsOn', cycles.starts_on,
    'completedAt', cycles.completed_at,
    'document', revisions.source_json,
    'completedSessions', (select count(*) from public.workout_sessions sessions where sessions.cycle_id = cycles.id and sessions.user_id = auth.uid() and sessions.status in ('completed', 'partial'))
  ) order by cycles.created_at desc), '[]'::jsonb)
  from public.program_cycles cycles
  join public.program_revisions revisions on revisions.id = cycles.program_revision_id
  where cycles.user_id = auth.uid();
$$;

revoke all on function public.resume_program_cycle(uuid) from public, anon;
revoke all on function public.get_program_library() from public, anon;
grant execute on function public.resume_program_cycle(uuid) to authenticated;
grant execute on function public.get_program_library() to authenticated;

commit;
