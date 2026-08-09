begin;

create or replace function public.abandon_workout_session(p_session_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  scheduled_id uuid;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;

  update public.workout_sessions
  set status = 'abandoned', finished_at = now(), revision = revision + 1, updated_at = now()
  where id = p_session_id and user_id = owner_id and status = 'active'
  returning scheduled_workout_id into scheduled_id;

  if scheduled_id is null then
    return not exists (
      select 1 from public.workout_sessions
      where id = p_session_id and user_id = owner_id and status <> 'abandoned'
    );
  end if;

  update public.scheduled_workouts
  set status = 'queued', skipped_reason = null, updated_at = now()
  where id = scheduled_id and user_id = owner_id;

  return true;
end;
$$;

revoke all on function public.abandon_workout_session(uuid) from public, anon;
grant execute on function public.abandon_workout_session(uuid) to authenticated;

commit;
