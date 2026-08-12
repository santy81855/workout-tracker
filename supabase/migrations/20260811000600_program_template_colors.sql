begin;

-- Older program documents predate per-workout calendar colors. Add stable defaults
-- without changing any other part of their immutable training prescription.
alter table public.program_revisions disable trigger prevent_published_program_revision_update;

update public.program_revisions revisions
set source_json = jsonb_set(
  revisions.source_json,
  '{workoutTemplates}',
  (
    select jsonb_agg(
      case when template.value ? 'color' then template.value
      else template.value || jsonb_build_object(
        'color', (array['#2563EB', '#DC2626', '#16A34A', '#9333EA', '#EA580C', '#0891B2', '#CA8A04'])[template.ordinality::integer]
      ) end
      order by template.ordinality
    )
    from jsonb_array_elements(revisions.source_json->'workoutTemplates') with ordinality as template(value, ordinality)
  )
)
where jsonb_typeof(revisions.source_json->'workoutTemplates') = 'array'
  and exists (
    select 1
    from jsonb_array_elements(revisions.source_json->'workoutTemplates') template
    where not (template ? 'color')
  );

alter table public.program_revisions enable trigger prevent_published_program_revision_update;

commit;
