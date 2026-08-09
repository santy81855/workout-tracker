begin;

update public.program_revisions
set source_json = jsonb_set(source_json, '{splitType}', '"Five-day mixed muscle-group split"'::jsonb),
    source_checksum = encode(extensions.digest(convert_to(jsonb_set(source_json, '{splitType}', '"Five-day mixed muscle-group split"'::jsonb)::text, 'UTF8'), 'sha256'), 'hex')
where source_json->>'slug' = 'hypertrophy-12-week-v1'
  and source_json->>'splitType' = 'Full-body hypertrophy split';

create function public.complete_finished_program_cycle()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.status in ('completed', 'partial') and not exists (
    select 1 from public.scheduled_workouts remaining
    where remaining.cycle_id = new.cycle_id and remaining.user_id = new.user_id
      and remaining.status in ('queued', 'active')
  ) then
    update public.program_cycles set status = 'completed', completed_at = now()
    where id = new.cycle_id and user_id = new.user_id and status = 'active';
  end if;
  return new;
end; $$;

create trigger scheduled_workout_maybe_complete_cycle
after update of status on public.scheduled_workouts
for each row execute function public.complete_finished_program_cycle();

commit;
