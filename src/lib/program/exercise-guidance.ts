import type { ProgramDocument } from "./schema";

type Exercise = ProgramDocument["exercises"][number];

const starterGuidance: Record<string, string[]> = {
  "incline-dumbbell-press": ["Keep your shoulder blades set and wrists stacked.", "Lower the dumbbells under control through a comfortable range."],
  "seated-machine-chest-press": ["Keep your torso stable against the pad.", "Use a controlled range without letting your shoulders roll forward."],
  "chest-fly": ["Keep a soft, fixed bend in your elbows.", "Control the stretch and bring your upper arms together without bouncing."],
  "hack-squat": ["Keep your feet planted and knees tracking with your toes.", "Use the deepest comfortable range you can control."],
  "leg-extension": ["Align your knee with the machine pivot.", "Lift smoothly and avoid swinging the weight."],
  "ez-bar-preacher-curl": ["Keep your upper arms planted on the pad.", "Control the bottom position without letting your shoulders take over."],
  "weighted-pull-up": ["Use a full, controlled range and avoid swinging.", "Drive your elbows down; switch to bodyweight if added load compromises clean reps."],
  "pull-up": ["Use a full, controlled range and avoid swinging.", "Drive your elbows down while keeping your ribs controlled."],
  "seated-row": ["Keep your torso stable and shoulders away from your ears.", "Pull your elbows back without turning the rep into a body swing."],
  "lying-leg-curl": ["Keep your hips against the pad.", "Curl smoothly and control the lowering phase."],
  "high-cable-rear-delt-sweep": ["Lead with your elbows and avoid shrugging.", "Use a controlled path near shoulder height."],
  "skull-crushers": ["Keep your upper arms relatively still.", "Lower under control to a comfortable triceps stretch."],
  "back-squat": ["Depth and technique take precedence over reaching the rep target.", "Brace before each rep and keep your feet firmly planted."],
  "seated-shoulder-press": ["Brace your torso and keep your forearms stacked.", "Avoid turning the final reps into an excessive back arch."],
  "lateral-raise": ["Lead with your elbows and keep your shoulders down.", "Control the lowering phase instead of dropping the weight."],
  "dumbbell-hammer-curl": ["Keep your elbows close to your sides and wrists neutral.", "Avoid using torso momentum."],
  "standing-weighted-calf-raise": ["Use a full controlled stretch at the bottom.", "Pause briefly at the top without bouncing."],
  "metal-bar-cable-triceps-pushdown": ["Keep your elbows pinned near your sides.", "Reach full extension without swinging your torso."],
  "cable-crunch": ["Flex through your spine using your abs.", "Keep your hips relatively still instead of turning it into a hip hinge."],
  "romanian-deadlift": ["Keep a stable torso and push your hips back.", "Control the eccentric and stop where you can maintain hamstring tension without excess lower-back fatigue."],
};

export function getExerciseGuidance(exercise: Exercise | undefined): string[] {
  if (!exercise) return [];
  return exercise.guidance.length > 0 ? exercise.guidance : (starterGuidance[exercise.slug] ?? []);
}
