begin;

grant delete on public.workout_sessions to authenticated;
create policy workout_sessions_delete_own on public.workout_sessions for delete to authenticated using (user_id = auth.uid());

create function public.remove_completed_workout(p_session_id uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  scheduled_id uuid;
  prior_status public.session_status;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  select scheduled_workout_id, status into scheduled_id, prior_status
  from public.workout_sessions
  where id = p_session_id and user_id = owner_id and status in ('completed', 'partial')
  for update;
  if scheduled_id is null then raise exception 'Completed workout not found'; end if;

  insert into public.edit_audit_events (user_id, entity_type, entity_id, action, before_values, after_values, reason, client_mutation_id)
  values (owner_id, 'workout_session', p_session_id, 'remove_completed_workout', jsonb_build_object('status', prior_status), jsonb_build_object('deleted', true), 'user_deleted_workout', gen_random_uuid());
  delete from public.workout_sessions where id = p_session_id and user_id = owner_id;
  update public.scheduled_workouts set status = 'queued', updated_at = now()
  where id = scheduled_id and user_id = owner_id;
  return true;
end;
$$;

revoke all on function public.remove_completed_workout(uuid) from public, anon;
grant execute on function public.remove_completed_workout(uuid) to authenticated;

commit;
