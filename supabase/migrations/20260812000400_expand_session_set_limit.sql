begin;

alter table public.session_exercises drop constraint session_exercises_prescribed_sets_snapshot_check;
alter table public.session_exercises add constraint session_exercises_prescribed_sets_snapshot_check
check (prescribed_sets_snapshot between 1 and 20);

commit;
