begin;

grant delete on public.scheduled_rest_days to authenticated;
create policy scheduled_rest_days_delete_own on public.scheduled_rest_days for delete to authenticated using (user_id = auth.uid());

create function public.remove_scheduled_rest_day(p_rest_day_id uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare owner_id uuid := auth.uid(); active_cycle uuid; from_sequence integer;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  select id into active_cycle from public.program_cycles where user_id = owner_id and status = 'active' limit 1;
  delete from public.scheduled_rest_days
  where id = p_rest_day_id and user_id = owner_id and cycle_id = active_cycle
  returning before_sequence_in_cycle into from_sequence;
  if from_sequence is null then raise exception 'Rest day not found'; end if;
  update public.scheduled_workouts set current_scheduled_date = current_scheduled_date - 1
  where user_id = owner_id and cycle_id = active_cycle and status = 'queued' and sequence_in_cycle >= from_sequence;
  return true;
end;
$$;

-- Replace only the original automatic palette. User-selected custom colors remain untouched.
alter table public.program_revisions disable trigger prevent_published_program_revision_update;
update public.program_revisions revisions
set source_json = jsonb_set(revisions.source_json, '{workoutTemplates}', (
  select jsonb_agg((template.value || jsonb_build_object('color',
    case template.value->>'color'
      when '#2563EB' then '#00B8F0'
      when '#DC2626' then '#FF9F0A'
      when '#16A34A' then '#64D23D'
      when '#9333EA' then '#A855F7'
      when '#EA580C' then '#FF3B7D'
      when '#0891B2' then '#FFD60A'
      when '#CA8A04' then '#5E5CE6'
      else template.value->>'color'
    end
  )) order by template.ordinality)
  from jsonb_array_elements(revisions.source_json->'workoutTemplates') with ordinality template(value, ordinality)
))
where exists (select 1 from jsonb_array_elements(revisions.source_json->'workoutTemplates') template
  where template->>'color' in ('#2563EB','#DC2626','#16A34A','#9333EA','#EA580C','#0891B2','#CA8A04'));
alter table public.program_revisions enable trigger prevent_published_program_revision_update;

revoke all on function public.remove_scheduled_rest_day(uuid) from public, anon;
grant execute on function public.remove_scheduled_rest_day(uuid) to authenticated;

commit;
