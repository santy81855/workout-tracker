begin;

create function public.get_workout_history()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_agg(session_document order by started_at desc), '[]'::jsonb)
  from (
    select
      sessions.started_at,
      jsonb_build_object(
        'id', sessions.id,
        'schemaVersion', 1,
        'status', sessions.status::text,
        'programSlug', revisions.source_json->>'slug',
        'cycleStartsOn', cycles.starts_on,
        'sequenceInCycle', scheduled.sequence_in_cycle,
        'programWeek', sessions.program_week_number,
        'templateSequence', ((scheduled.sequence_in_cycle - 1) % 5) + 1,
        'phase', sessions.phase_name_snapshot,
        'templateName', sessions.template_name_snapshot,
        'targetRirLabel', case
          when sessions.target_rir_min_snapshot = sessions.target_rir_max_snapshot
            then sessions.target_rir_min_snapshot::text
          else sessions.target_rir_min_snapshot::text || '–' || sessions.target_rir_max_snapshot::text
        end,
        'startedAt', sessions.started_at,
        'finishedAt', sessions.finished_at,
        'bodyweightTenthsLb', sessions.bodyweight_tenths_lb,
        'energyRating', sessions.energy_rating,
        'discomfortLevel', sessions.discomfort_level,
        'discomfortNotes', coalesce(sessions.discomfort_notes, ''),
        'sessionNotes', coalesce(sessions.notes, ''),
        'nextTimeAdjustment', coalesce(sessions.next_time_adjustment, ''),
        'updatedAt', sessions.updated_at,
        'serverRevision', sessions.revision,
        'activeExerciseIndex', 0,
        'restEndsAt', null,
        'syncStatus', 'synced',
        'exercises', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id', session_exercises.id,
              'prescribedExerciseSlug', prescribed.slug,
              'performedExerciseSlug', performed.slug,
              'replacementReason', session_exercises.replacement_reason,
              'name', session_exercises.exercise_name_snapshot,
              'repMin', session_exercises.rep_min_snapshot,
              'repMax', session_exercises.rep_max_snapshot,
              'targetRirLabel', case
                when sessions.target_rir_min_snapshot = sessions.target_rir_max_snapshot
                  then sessions.target_rir_min_snapshot::text
                else sessions.target_rir_min_snapshot::text || '–' || sessions.target_rir_max_snapshot::text
              end,
              'loadBasis', session_exercises.load_basis_snapshot::text,
              'incrementTenthsLb', session_exercises.increment_tenths_lb_snapshot,
              'restSeconds', session_exercises.rest_seconds_snapshot,
              'notes', coalesce(session_exercises.exercise_notes, ''),
              'sets', coalesce((
                select jsonb_agg(
                  jsonb_build_object(
                    'id', sets.id,
                    'setNumber', sets.set_number,
                    'status', sets.status::text,
                    'loadMode', sets.load_mode::text,
                    'loadTenthsLb', sets.load_tenths_lb,
                    'reps', sets.reps,
                    'rirOnTarget', sets.rir_on_target,
                    'actualRir', case
                      when sets.actual_rir_over_six then to_jsonb('6+'::text)
                      when sets.actual_rir_unsure then to_jsonb('unsure'::text)
                      else to_jsonb(sets.actual_rir)
                    end,
                    'completedAt', sets.completed_at
                  ) order by sets.set_number
                )
                from public.exercise_sets sets
                where sets.session_exercise_id = session_exercises.id
                  and sets.user_id = auth.uid()
                  and sets.status <> 'deleted'
              ), '[]'::jsonb)
            ) order by session_exercises.sequence_number
          )
          from public.session_exercises
          join public.exercises prescribed on prescribed.id = session_exercises.prescribed_exercise_id
          join public.exercises performed on performed.id = session_exercises.performed_exercise_id
          where session_exercises.session_id = sessions.id
            and session_exercises.user_id = auth.uid()
        ), '[]'::jsonb)
      ) as session_document
    from public.workout_sessions sessions
    join public.scheduled_workouts scheduled on scheduled.id = sessions.scheduled_workout_id
    join public.program_cycles cycles on cycles.id = sessions.cycle_id
    join public.program_revisions revisions on revisions.id = sessions.program_revision_id
    where sessions.user_id = auth.uid()
      and sessions.status <> 'abandoned'
  ) history;
$$;

revoke all on function public.get_workout_history() from public, anon;
grant execute on function public.get_workout_history() to authenticated;

commit;
