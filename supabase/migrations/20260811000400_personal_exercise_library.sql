begin;

create function public.get_exercise_library()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'slug', exercises.slug, 'name', exercises.name, 'equipment', exercises.equipment_type,
    'loadBasis', exercises.load_basis::text, 'defaultIncrementTenthsLb', exercises.default_increment_tenths_lb,
    'defaultRestSeconds', exercises.default_rest_seconds, 'guidance', exercises.guidance,
    'isCustom', exercises.owner_user_id is not null,
    'muscles', coalesce((select jsonb_agg(jsonb_build_object('muscle', groups.slug, 'contribution', case when mappings.contribution_tenths = 10 then 1 else 0.5 end) order by mappings.contribution_tenths desc, groups.name)
      from public.exercise_muscles mappings join public.muscle_groups groups on groups.id = mappings.muscle_group_id
      where mappings.exercise_id = exercises.id), '[]'::jsonb)
  ) order by exercises.owner_user_id is not null, exercises.name), '[]'::jsonb)
  from public.exercises exercises
  where exercises.is_curated or exercises.owner_user_id = auth.uid();
$$;

create function public.create_custom_exercise(
  p_name text, p_equipment text, p_load_basis public.load_basis,
  p_increment_tenths_lb integer, p_rest_seconds integer, p_primary_muscle text
)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare owner_id uuid := auth.uid(); exercise_id uuid; exercise_slug text; muscle_id smallint;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  if length(trim(p_name)) not between 2 and 120 then raise exception 'Exercise name must contain 2 to 120 characters'; end if;
  if length(trim(p_equipment)) not between 2 and 80 then raise exception 'Equipment must contain 2 to 80 characters'; end if;
  if p_increment_tenths_lb <= 0 then raise exception 'Load increment must be positive'; end if;
  if p_rest_seconds not between 30 and 600 then raise exception 'Rest time must be between 30 and 600 seconds'; end if;
  select id into muscle_id from public.muscle_groups where slug = p_primary_muscle;
  if muscle_id is null then raise exception 'Unknown primary muscle'; end if;
  exercise_slug := trim(both '-' from regexp_replace(lower(trim(p_name)), '[^a-z0-9]+', '-', 'g')) || '-' || substr(gen_random_uuid()::text, 1, 8);
  insert into public.exercises (owner_user_id, slug, name, equipment_type, load_basis, default_increment_tenths_lb, default_rest_seconds, is_curated)
  values (owner_id, exercise_slug, trim(p_name), trim(p_equipment), p_load_basis, p_increment_tenths_lb, p_rest_seconds, false) returning id into exercise_id;
  insert into public.exercise_muscles (exercise_id, muscle_group_id, owner_user_id, contribution_tenths, role)
  values (exercise_id, muscle_id, owner_id, 10, 'primary');
  return jsonb_build_object('slug', exercise_slug, 'name', trim(p_name), 'equipment', trim(p_equipment), 'loadBasis', p_load_basis::text,
    'defaultIncrementTenthsLb', p_increment_tenths_lb, 'defaultRestSeconds', p_rest_seconds, 'guidance', '[]'::jsonb,
    'isCustom', true, 'muscles', jsonb_build_array(jsonb_build_object('muscle', p_primary_muscle, 'contribution', 1)));
end;
$$;

revoke all on function public.get_exercise_library() from public, anon;
revoke all on function public.create_custom_exercise(text, text, public.load_basis, integer, integer, text) from public, anon;
grant execute on function public.get_exercise_library() to authenticated;
grant execute on function public.create_custom_exercise(text, text, public.load_basis, integer, integer, text) to authenticated;

commit;
