begin;

create or replace function public.audit_completed_set_correction()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.status = 'completed' and (
    old.load_mode is distinct from new.load_mode or
    old.load_tenths_lb is distinct from new.load_tenths_lb or
    old.reps is distinct from new.reps or
    old.rir_on_target is distinct from new.rir_on_target or
    old.actual_rir is distinct from new.actual_rir or
    old.actual_rir_over_six is distinct from new.actual_rir_over_six or
    old.actual_rir_unsure is distinct from new.actual_rir_unsure
  ) then
    insert into public.edit_audit_events (
      user_id, entity_type, entity_id, action, before_values, after_values, reason, client_mutation_id
    ) values (
      new.user_id, 'exercise_set', new.id, 'correct_completed_set',
      jsonb_build_object('loadMode', old.load_mode, 'loadTenthsLb', old.load_tenths_lb, 'reps', old.reps, 'rirOnTarget', old.rir_on_target, 'actualRir', old.actual_rir, 'actualRirOverSix', old.actual_rir_over_six, 'actualRirUnsure', old.actual_rir_unsure),
      jsonb_build_object('loadMode', new.load_mode, 'loadTenthsLb', new.load_tenths_lb, 'reps', new.reps, 'rirOnTarget', new.rir_on_target, 'actualRir', new.actual_rir, 'actualRirOverSix', new.actual_rir_over_six, 'actualRirUnsure', new.actual_rir_unsure),
      'post_completion_correction', gen_random_uuid()
    );
  end if;
  return new;
end;
$$;

create trigger exercise_sets_audit_completed_correction
after update on public.exercise_sets
for each row execute function public.audit_completed_set_correction();

create or replace function public.audit_completed_exercise_notes()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.exercise_notes is distinct from new.exercise_notes and exists (
    select 1 from public.workout_sessions sessions
    where sessions.id = new.session_id and sessions.user_id = new.user_id and sessions.status in ('completed', 'partial')
  ) then
    insert into public.edit_audit_events (
      user_id, entity_type, entity_id, action, before_values, after_values, reason, client_mutation_id
    ) values (
      new.user_id, 'session_exercise', new.id, 'correct_exercise_notes',
      jsonb_build_object('notes', old.exercise_notes), jsonb_build_object('notes', new.exercise_notes),
      'post_completion_correction', gen_random_uuid()
    );
  end if;
  return new;
end;
$$;

create trigger session_exercises_audit_completed_notes
after update on public.session_exercises
for each row execute function public.audit_completed_exercise_notes();

create or replace function public.audit_completed_session_details()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.status in ('completed', 'partial') and (
    old.bodyweight_tenths_lb is distinct from new.bodyweight_tenths_lb or
    old.energy_rating is distinct from new.energy_rating or
    old.discomfort_level is distinct from new.discomfort_level or
    old.discomfort_notes is distinct from new.discomfort_notes or
    old.notes is distinct from new.notes or
    old.next_time_adjustment is distinct from new.next_time_adjustment
  ) then
    insert into public.edit_audit_events (
      user_id, entity_type, entity_id, action, before_values, after_values, reason, client_mutation_id
    ) values (
      new.user_id, 'workout_session', new.id, 'correct_session_details',
      jsonb_build_object('bodyweightTenthsLb', old.bodyweight_tenths_lb, 'energyRating', old.energy_rating, 'discomfortLevel', old.discomfort_level, 'discomfortNotes', old.discomfort_notes, 'notes', old.notes, 'nextTimeAdjustment', old.next_time_adjustment),
      jsonb_build_object('bodyweightTenthsLb', new.bodyweight_tenths_lb, 'energyRating', new.energy_rating, 'discomfortLevel', new.discomfort_level, 'discomfortNotes', new.discomfort_notes, 'notes', new.notes, 'nextTimeAdjustment', new.next_time_adjustment),
      'post_completion_correction', gen_random_uuid()
    );
  end if;
  return new;
end;
$$;

create trigger workout_sessions_audit_completed_details
after update on public.workout_sessions
for each row execute function public.audit_completed_session_details();

revoke all on function public.audit_completed_set_correction() from public, anon, authenticated;
revoke all on function public.audit_completed_exercise_notes() from public, anon, authenticated;
revoke all on function public.audit_completed_session_details() from public, anon, authenticated;

commit;
