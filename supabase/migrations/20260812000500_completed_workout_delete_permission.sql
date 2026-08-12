begin;

grant delete on public.workout_sessions to authenticated;
drop policy if exists workout_sessions_delete_own on public.workout_sessions;
create policy workout_sessions_delete_own on public.workout_sessions for delete to authenticated using (user_id = auth.uid());

commit;
