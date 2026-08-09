begin;

create or replace function public.get_weekly_checkins()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', checkins.id,
    'programWeek', checkins.program_week_number,
    'overallRecovery', checkins.overall_recovery,
    'averageSleepHoursTenths', checkins.average_sleep_hours_tenths,
    'energy', checkins.energy,
    'overallSoreness', checkins.overall_soreness,
    'jointDiscomfort', checkins.joint_discomfort,
    'jointDiscomfortNotes', coalesce(checkins.joint_discomfort_notes, ''),
    'motivation', checkins.motivation,
    'biggestImprovement', coalesce(checkins.biggest_improvement, ''),
    'recoveryFactors', coalesce(checkins.recovery_factors, ''),
    'nextWeekActions', checkins.next_week_actions,
    'notes', coalesce(checkins.notes, ''),
    'updatedAt', checkins.updated_at
  ) order by checkins.program_week_number), '[]'::jsonb)
  from public.weekly_checkins checkins
  where checkins.user_id = auth.uid();
$$;

create or replace function public.upsert_weekly_checkin(checkin jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  active_cycle_id uuid;
  saved public.weekly_checkins;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  select id into active_cycle_id
  from public.program_cycles
  where user_id = owner_id and status = 'active'
  order by starts_on desc limit 1;
  if active_cycle_id is null then raise exception 'No active program cycle'; end if;

  insert into public.weekly_checkins (
    user_id, cycle_id, program_week_number, overall_recovery,
    average_sleep_hours_tenths, energy, overall_soreness, joint_discomfort,
    joint_discomfort_notes, motivation, biggest_improvement, recovery_factors,
    next_week_actions, notes
  ) values (
    owner_id, active_cycle_id, (checkin->>'programWeek')::smallint,
    nullif(checkin->>'overallRecovery', '')::smallint,
    nullif(checkin->>'averageSleepHoursTenths', '')::smallint,
    nullif(checkin->>'energy', '')::smallint,
    nullif(checkin->>'overallSoreness', '')::smallint,
    nullif(checkin->>'jointDiscomfort', ''),
    nullif(checkin->>'jointDiscomfortNotes', ''),
    nullif(checkin->>'motivation', '')::smallint,
    nullif(checkin->>'biggestImprovement', ''),
    nullif(checkin->>'recoveryFactors', ''),
    coalesce(array(select jsonb_array_elements_text(checkin->'nextWeekActions')), '{}'),
    nullif(checkin->>'notes', '')
  )
  on conflict (cycle_id, program_week_number) do update set
    overall_recovery = excluded.overall_recovery,
    average_sleep_hours_tenths = excluded.average_sleep_hours_tenths,
    energy = excluded.energy,
    overall_soreness = excluded.overall_soreness,
    joint_discomfort = excluded.joint_discomfort,
    joint_discomfort_notes = excluded.joint_discomfort_notes,
    motivation = excluded.motivation,
    biggest_improvement = excluded.biggest_improvement,
    recovery_factors = excluded.recovery_factors,
    next_week_actions = excluded.next_week_actions,
    notes = excluded.notes,
    updated_at = now()
  returning * into saved;

  return jsonb_build_object('id', saved.id, 'programWeek', saved.program_week_number, 'updatedAt', saved.updated_at);
end;
$$;

revoke all on function public.get_weekly_checkins() from public, anon;
revoke all on function public.upsert_weekly_checkin(jsonb) from public, anon;
grant execute on function public.get_weekly_checkins() to authenticated;
grant execute on function public.upsert_weekly_checkin(jsonb) to authenticated;

commit;
