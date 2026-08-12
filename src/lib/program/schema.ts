import { z } from "zod";

const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const templateColors = ["#2563EB", "#DC2626", "#16A34A", "#9333EA", "#EA580C", "#0891B2", "#CA8A04"] as const;

export const loadBasisSchema = z.enum([
  "external_total",
  "per_dumbbell",
  "added_bodyweight",
  "bodyweight_only",
  "assistance",
  "repetition_only",
]);

export const muscleContributionSchema = z.object({
  muscle: slugSchema,
  contribution: z.union([z.literal(1), z.literal(0.5)]),
});

export const exerciseDefinitionSchema = z
  .object({
    slug: slugSchema,
    name: z.string().trim().min(1).max(120),
    equipment: z.string().trim().min(1).max(80),
    loadBasis: loadBasisSchema,
    defaultIncrementTenthsLb: z.number().int().positive(),
    defaultRestSeconds: z.number().int().min(30).max(600),
    muscles: z.array(muscleContributionSchema).min(1),
    guidance: z.array(z.string().trim().min(1).max(400)).default([]),
    techniqueCheck: z.enum(["squat", "rdl"]).optional(),
  })
  .superRefine((exercise, context) => {
    const muscles = new Set<string>();
    let hasPrimary = false;

    for (const mapping of exercise.muscles) {
      if (muscles.has(mapping.muscle)) {
        context.addIssue({
          code: "custom",
          path: ["muscles"],
          message: `Duplicate muscle mapping: ${mapping.muscle}`,
        });
      }
      muscles.add(mapping.muscle);
      hasPrimary ||= mapping.contribution === 1;
    }

    if (!hasPrimary) {
      context.addIssue({
        code: "custom",
        path: ["muscles"],
        message: "An exercise must have at least one primary muscle contribution",
      });
    }
  });

export const programWeekRuleSchema = z.object({
  week: z.number().int().min(1).max(52),
  phase: z.string().trim().min(1).max(80),
  targetRir: z.object({
    min: z.number().int().min(0).max(6),
    max: z.number().int().min(0).max(6),
  }),
  isDeload: z.boolean(),
  setRules: z.object({
    peak2: z.object({ required: z.number().int().min(1).max(4), optional: z.number().int().min(0).max(1) }),
    peak3: z.object({ required: z.number().int().min(1).max(4), optional: z.number().int().min(0).max(1) }),
    peak4: z.object({ required: z.number().int().min(1).max(4), optional: z.number().int().min(0).max(1) }),
  }),
});

export const workoutTemplateExerciseSchema = z.object({
  exercise: slugSchema,
  repMin: z.number().int().min(1).max(100),
  repMax: z.number().int().min(1).max(100),
  peakSets: z.union([z.literal(2), z.literal(3), z.literal(4)]),
  incrementTenthsLb: z.number().int().positive().optional(),
  restSeconds: z.number().int().min(30).max(600).optional(),
  guidance: z.array(z.string().trim().min(1).max(400)).default([]),
});

export const workoutTemplateSchema = z.object({
  sequence: z.number().int().min(1).max(7),
  originalDayLabel: z.string().trim().min(1).max(20),
  name: z.string().trim().min(1).max(120),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a six-digit hex color such as #2563EB").optional(),
  exercises: z.array(workoutTemplateExerciseSchema).min(1).max(20),
});

export const programDocumentSchema = z
  .object({
    schemaVersion: z.literal("1.0"),
    slug: slugSchema,
    name: z.string().trim().min(1).max(120),
    displayTitle: z.string().trim().min(1).max(80).optional(),
    splitType: z.string().trim().min(1).max(80).optional(),
    description: z.string().trim().min(1).max(1000),
    weekCount: z.number().int().min(1).max(52),
    workoutsPerWeek: z.number().int().min(1).max(7),
    trainingDaysPerWeek: z.number().int().min(1).max(7).optional(),
    defaultIncrementTenthsLb: z.number().int().positive(),
    muscleGroups: z.array(slugSchema).min(1),
    exercises: z.array(exerciseDefinitionSchema).min(1),
    weekRules: z.array(programWeekRuleSchema).min(1).max(52),
    workoutTemplates: z.array(workoutTemplateSchema).min(1).max(7),
  })
  .superRefine((program, context) => {
    const exerciseSlugs = new Set(program.exercises.map((exercise) => exercise.slug));
    const muscleSlugs = new Set(program.muscleGroups);
    const weeks = new Set(program.weekRules.map((rule) => rule.week));
    const templateSequences = new Set(program.workoutTemplates.map((template) => template.sequence));
    const usedPeakSets = new Set(program.workoutTemplates.flatMap((template) => template.exercises.map((exercise) => exercise.peakSets)));

    if (program.weekRules.length !== program.weekCount) {
      context.addIssue({ code: "custom", path: ["weekRules"], message: `Expected exactly ${program.weekCount} week rules` });
    }

    if (exerciseSlugs.size !== program.exercises.length) {
      context.addIssue({ code: "custom", path: ["exercises"], message: "Exercise slugs must be unique" });
    }

    if (muscleSlugs.size !== program.muscleGroups.length) {
      context.addIssue({ code: "custom", path: ["muscleGroups"], message: "Muscle-group slugs must be unique" });
    }

    for (let week = 1; week <= program.weekCount; week += 1) {
      if (!weeks.has(week)) {
        context.addIssue({ code: "custom", path: ["weekRules"], message: `Missing week rule ${week}` });
      }
    }

    for (let sequence = 1; sequence <= program.workoutTemplates.length; sequence += 1) {
      if (!templateSequences.has(sequence)) {
        context.addIssue({
          code: "custom",
          path: ["workoutTemplates"],
          message: `Missing workout template sequence ${sequence}`,
        });
      }
    }

    for (const [exerciseIndex, exercise] of program.exercises.entries()) {
      for (const [muscleIndex, mapping] of exercise.muscles.entries()) {
        if (!muscleSlugs.has(mapping.muscle)) {
          context.addIssue({
            code: "custom",
            path: ["exercises", exerciseIndex, "muscles", muscleIndex, "muscle"],
            message: `Unknown muscle group: ${mapping.muscle}`,
          });
        }
      }
    }

    for (const [templateIndex, template] of program.workoutTemplates.entries()) {
      for (const [exerciseIndex, prescribed] of template.exercises.entries()) {
        if (!exerciseSlugs.has(prescribed.exercise)) {
          context.addIssue({
            code: "custom",
            path: ["workoutTemplates", templateIndex, "exercises", exerciseIndex, "exercise"],
            message: `Unknown exercise: ${prescribed.exercise}`,
          });
        }
        if (prescribed.repMin > prescribed.repMax) {
          context.addIssue({
            code: "custom",
            path: ["workoutTemplates", templateIndex, "exercises", exerciseIndex],
            message: "Minimum reps cannot exceed maximum reps",
          });
        }
      }
    }

    for (const weekRule of program.weekRules) {
      for (const peak of [2, 3, 4] as const) {
        const rule = weekRule.setRules[`peak${peak}`];
        if (usedPeakSets.has(peak) && rule.required + rule.optional > peak) {
          context.addIssue({ code: "custom", path: ["weekRules", weekRule.week - 1, "setRules", `peak${peak}`], message: `Exercises that peak at ${peak} sets cannot be prescribed more than ${peak} sets` });
        }
      }
    }
  })
  .transform((program) => {
    const usedPeakSets = new Set(program.workoutTemplates.flatMap((template) => template.exercises.map((exercise) => exercise.peakSets)));
    const weekRules = program.weekRules.map((weekRule) => ({
      ...weekRule,
      setRules: Object.fromEntries(([2, 3, 4] as const).map((peak) => {
        const key = `peak${peak}` as const;
        const rule = weekRule.setRules[key];
        return [key, usedPeakSets.has(peak) ? rule : { required: Math.min(rule.required, peak), optional: Math.min(rule.optional, Math.max(0, peak - Math.min(rule.required, peak))) }];
      })) as typeof weekRule.setRules,
    }));
    const workoutTemplates = program.workoutTemplates.map((template, index) => ({
      ...template,
      color: template.color ?? templateColors[index % templateColors.length],
    }));
    return { ...program, weekRules, workoutTemplates, workoutsPerWeek: program.trainingDaysPerWeek ?? program.workoutsPerWeek };
  });

export type ProgramDocument = z.infer<typeof programDocumentSchema>;
