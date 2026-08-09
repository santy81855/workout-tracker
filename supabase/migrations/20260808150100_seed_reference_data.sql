begin;

insert into public.muscle_groups (slug, name, display_order) values
  ('chest', 'Chest', 1),
  ('back', 'Back', 2),
  ('quads', 'Quads', 3),
  ('hamstrings', 'Hamstrings', 4),
  ('glutes', 'Glutes', 5),
  ('shoulders', 'Shoulders', 6),
  ('biceps', 'Biceps', 7),
  ('triceps', 'Triceps', 8),
  ('calves', 'Calves', 9),
  ('abs', 'Abs', 10);

insert into public.exercises (
  id, slug, name, equipment_type, load_basis, default_increment_tenths_lb,
  default_rest_seconds, guidance, technique_check, is_curated
) values
  ('10000000-0000-4000-8000-000000000001', 'incline-dumbbell-press', 'Incline Dumbbell Press', 'dumbbell', 'per_dumbbell', 25, 180, '{}', null, true),
  ('10000000-0000-4000-8000-000000000002', 'seated-machine-chest-press', 'Seated Machine Chest Press', 'machine', 'external_total', 50, 180, '{}', null, true),
  ('10000000-0000-4000-8000-000000000003', 'chest-fly', 'Chest Fly', 'machine-or-cable', 'external_total', 25, 105, '{}', null, true),
  ('10000000-0000-4000-8000-000000000004', 'hack-squat', 'Hack Squat', 'machine', 'external_total', 100, 180, '{}', null, true),
  ('10000000-0000-4000-8000-000000000005', 'leg-extension', 'Leg Extension', 'machine', 'external_total', 50, 105, '{}', null, true),
  ('10000000-0000-4000-8000-000000000006', 'ez-bar-preacher-curl', 'EZ-Bar Preacher Curl', 'ez-bar', 'external_total', 25, 105, '{}', null, true),
  ('10000000-0000-4000-8000-000000000007', 'weighted-pull-up', 'Weighted Pull-Up', 'bodyweight', 'added_bodyweight', 25, 180, array['If added weight prevents twelve clean reps, switch to bodyweight-only mode.'], null, true),
  ('10000000-0000-4000-8000-000000000008', 'pull-up', 'Pull-Up', 'bodyweight', 'bodyweight_only', 25, 180, '{}', null, true),
  ('10000000-0000-4000-8000-000000000009', 'seated-row', 'Seated Row', 'machine-or-cable', 'external_total', 50, 180, '{}', null, true),
  ('10000000-0000-4000-8000-000000000010', 'lying-leg-curl', 'Lying Leg Curl', 'machine', 'external_total', 50, 105, '{}', null, true),
  ('10000000-0000-4000-8000-000000000011', 'high-cable-rear-delt-sweep', 'High-Cable Rear-Delt Sweep', 'cable', 'external_total', 25, 105, '{}', null, true),
  ('10000000-0000-4000-8000-000000000012', 'skull-crushers', 'Skull Crushers', 'ez-bar', 'external_total', 25, 105, '{}', null, true),
  ('10000000-0000-4000-8000-000000000013', 'back-squat', 'Back Squat', 'barbell', 'external_total', 100, 210, array['Depth and technique take precedence over reaching the top of the rep range.', 'Record whether the limiting factor was cardiovascular or muscular.'], 'squat', true),
  ('10000000-0000-4000-8000-000000000014', 'seated-shoulder-press', 'Seated Shoulder Press', 'machine-or-dumbbell', 'external_total', 50, 180, '{}', null, true),
  ('10000000-0000-4000-8000-000000000015', 'lateral-raise', 'Lateral Raise', 'dumbbell-or-cable', 'per_dumbbell', 25, 105, '{}', null, true),
  ('10000000-0000-4000-8000-000000000016', 'dumbbell-hammer-curl', 'Dumbbell Hammer Curl', 'dumbbell', 'per_dumbbell', 25, 105, '{}', null, true),
  ('10000000-0000-4000-8000-000000000017', 'standing-weighted-calf-raise', 'Standing Weighted Calf Raise', 'machine', 'external_total', 50, 105, '{}', null, true),
  ('10000000-0000-4000-8000-000000000018', 'metal-bar-cable-triceps-pushdown', 'Metal-Bar Cable Triceps Pushdown', 'cable', 'external_total', 25, 105, '{}', null, true),
  ('10000000-0000-4000-8000-000000000019', 'cable-crunch', 'Cable Crunch', 'cable', 'external_total', 25, 105, '{}', null, true),
  ('10000000-0000-4000-8000-000000000020', 'romanian-deadlift', 'Romanian Deadlift', 'barbell', 'external_total', 100, 210, array['Use a controlled eccentric, stable torso, hamstring stretch, and glute engagement.', 'Track hamstring/glute stimulus and lower-back fatigue.'], 'rdl', true);

with mappings(exercise_slug, muscle_slug, contribution_tenths, role) as (values
  ('incline-dumbbell-press', 'chest', 10, 'primary'), ('incline-dumbbell-press', 'shoulders', 5, 'secondary'), ('incline-dumbbell-press', 'triceps', 5, 'secondary'),
  ('seated-machine-chest-press', 'chest', 10, 'primary'), ('seated-machine-chest-press', 'shoulders', 5, 'secondary'), ('seated-machine-chest-press', 'triceps', 5, 'secondary'),
  ('chest-fly', 'chest', 10, 'primary'), ('hack-squat', 'quads', 10, 'primary'), ('hack-squat', 'glutes', 5, 'secondary'),
  ('leg-extension', 'quads', 10, 'primary'), ('ez-bar-preacher-curl', 'biceps', 10, 'primary'),
  ('weighted-pull-up', 'back', 10, 'primary'), ('weighted-pull-up', 'biceps', 5, 'secondary'),
  ('pull-up', 'back', 10, 'primary'), ('pull-up', 'biceps', 5, 'secondary'),
  ('seated-row', 'back', 10, 'primary'), ('seated-row', 'biceps', 5, 'secondary'),
  ('lying-leg-curl', 'hamstrings', 10, 'primary'),
  ('high-cable-rear-delt-sweep', 'shoulders', 10, 'primary'), ('high-cable-rear-delt-sweep', 'back', 5, 'secondary'),
  ('skull-crushers', 'triceps', 10, 'primary'),
  ('back-squat', 'quads', 10, 'primary'), ('back-squat', 'glutes', 10, 'primary'), ('back-squat', 'hamstrings', 5, 'secondary'),
  ('seated-shoulder-press', 'shoulders', 10, 'primary'), ('seated-shoulder-press', 'triceps', 5, 'secondary'),
  ('lateral-raise', 'shoulders', 10, 'primary'), ('dumbbell-hammer-curl', 'biceps', 10, 'primary'),
  ('standing-weighted-calf-raise', 'calves', 10, 'primary'),
  ('metal-bar-cable-triceps-pushdown', 'triceps', 10, 'primary'), ('cable-crunch', 'abs', 10, 'primary'),
  ('romanian-deadlift', 'hamstrings', 10, 'primary'), ('romanian-deadlift', 'glutes', 10, 'primary'), ('romanian-deadlift', 'back', 5, 'secondary')
)
insert into public.exercise_muscles (exercise_id, muscle_group_id, owner_user_id, contribution_tenths, role)
select exercises.id, muscle_groups.id, null, mappings.contribution_tenths, mappings.role
from mappings
join public.exercises on exercises.slug = mappings.exercise_slug and exercises.owner_user_id is null
join public.muscle_groups on muscle_groups.slug = mappings.muscle_slug;

commit;
