begin;

create or replace function public.get_program_library()
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
  where cycles.user_id = auth.uid()
    and cycles.status <> 'abandoned';
$$;

create function public.remove_program_cycle(p_cycle_id uuid, p_confirm_in_progress boolean default false)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  selected_status public.cycle_status;
  completed_count integer;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;

  select cycles.status,
    (select count(*) from public.workout_sessions sessions where sessions.cycle_id = cycles.id and sessions.user_id = owner_id and sessions.status in ('completed', 'partial'))
  into selected_status, completed_count
  from public.program_cycles cycles
  where cycles.id = p_cycle_id and cycles.user_id = owner_id and cycles.status <> 'abandoned';

  if selected_status is null then raise exception 'Plan not found'; end if;
  if exists (select 1 from public.workout_sessions where cycle_id = p_cycle_id and user_id = owner_id and status = 'active') then
    raise exception 'Cancel or finish this plan''s active workout before removing it';
  end if;
  if (selected_status = 'active' or completed_count > 0) and not p_confirm_in_progress then
    raise exception 'Confirmation is required to remove an active or in-progress plan';
  end if;

  update public.scheduled_workouts
  set status = 'skipped', skipped_reason = 'Plan removed from library'
  where cycle_id = p_cycle_id and user_id = owner_id and status = 'queued';

  update public.program_cycles
  set status = 'abandoned', completed_at = coalesce(completed_at, now())
  where id = p_cycle_id and user_id = owner_id;
  return true;
end;
$$;

revoke all on function public.remove_program_cycle(uuid, boolean) from public, anon;
grant execute on function public.remove_program_cycle(uuid, boolean) to authenticated;

commit;
