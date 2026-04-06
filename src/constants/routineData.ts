export interface Task {
  id: string;
  name: string;
  subtitle: string;
  instructions: string;
  section: 'morning' | 'night_normal' | 'night_retinol' | 'weekly';
  isRequired: boolean;
  isOptional: boolean;
  stepOrder: number;
  source: 'default' | 'ordered' | 'custom';
}

export interface Section {
  id: string;
  label: string;
  tasks: Task[];
}

// ── Morning (4 tasks) ─────────────────────────────────────
export const MORNING_TASKS: Task[] = [
  {
    id: 'm1',
    name: 'Cleanser',
    subtitle: 'First step — clean canvas',
    instructions:
      'Wet face, apply pea-sized amount, massage 30 seconds in circular motions, rinse with lukewarm water',
    section: 'morning',
    isRequired: true,
    isOptional: false,
    stepOrder: 1,
    source: 'default',
  },
  {
    id: 'm2',
    name: 'Niacinamide Serum',
    subtitle: 'Targets pores and pigmentation',
    instructions:
      'Apply 2-3 drops on damp skin, pat gently, do not rub',
    section: 'morning',
    isRequired: true,
    isOptional: false,
    stepOrder: 2,
    source: 'default',
  },
  {
    id: 'm3',
    name: 'Moisturizer',
    subtitle: 'Lock in hydration',
    instructions:
      'Apply a coin-sized amount, spread upward in gentle strokes',
    section: 'morning',
    isRequired: true,
    isOptional: false,
    stepOrder: 3,
    source: 'default',
  },
  {
    id: 'm4',
    name: 'Sunscreen SPF 50',
    subtitle: 'Final step — non-negotiable',
    instructions:
      'Apply generously 15 min before sun exposure, reapply every 2 hours outdoors',
    section: 'morning',
    isRequired: true,
    isOptional: false,
    stepOrder: 4,
    source: 'default',
  },
];

// ── Night – normal nights (3 tasks) ───────────────────────
export const NIGHT_NORMAL_TASKS: Task[] = [
  {
    id: 'n1',
    name: 'Cleanser',
    subtitle: 'First step — clean canvas',
    instructions:
      'Wet face, apply pea-sized amount, massage 30 seconds in circular motions, rinse with lukewarm water',
    section: 'night_normal',
    isRequired: true,
    isOptional: false,
    stepOrder: 1,
    source: 'default',
  },
  {
    id: 'n2',
    name: 'Niacinamide Serum',
    subtitle: 'Targets pores and pigmentation',
    instructions:
      'Apply 2-3 drops on damp skin, pat gently, do not rub',
    section: 'night_normal',
    isRequired: true,
    isOptional: false,
    stepOrder: 2,
    source: 'default',
  },
  {
    id: 'n3',
    name: 'Moisturizer',
    subtitle: 'Lock in hydration',
    instructions:
      'Apply a coin-sized amount, spread upward in gentle strokes',
    section: 'night_normal',
    isRequired: true,
    isOptional: false,
    stepOrder: 3,
    source: 'default',
  },
];

// ── Night – retinol nights (Wed + Sun) (4 tasks) ──────────
export const NIGHT_RETINOL_TASKS: Task[] = [
  {
    id: 'r1',
    name: 'Cleanser',
    subtitle: 'First step — clean canvas',
    instructions:
      'Wet face, apply pea-sized amount, massage 30 seconds in circular motions, rinse with lukewarm water',
    section: 'night_retinol',
    isRequired: true,
    isOptional: false,
    stepOrder: 1,
    source: 'default',
  },
  {
    id: 'r2',
    name: 'Moisturizer',
    subtitle: 'Buffer — thin layer before retinol',
    instructions:
      'Apply a thin layer of moisturizer as a buffer. Wait 5 minutes before applying retinol to reduce potential irritation',
    section: 'night_retinol',
    isRequired: true,
    isOptional: false,
    stepOrder: 2,
    source: 'default',
  },
  {
    id: 'r3',
    name: 'Retinol',
    subtitle: 'Use only on retinol nights',
    instructions:
      'Apply pea-sized amount only on completely dry skin. Avoid eye area and corners of nose and mouth. Pat gently — do not rub',
    section: 'night_retinol',
    isRequired: true,
    isOptional: false,
    stepOrder: 3,
    source: 'default',
  },
  {
    id: 'r4',
    name: 'Moisturizer',
    subtitle: 'Seal — thicker layer on top',
    instructions:
      'Apply a generous layer of moisturizer to seal in retinol and reduce irritation. This is the final step — do not add anything on top',
    section: 'night_retinol',
    isRequired: true,
    isOptional: false,
    stepOrder: 4,
    source: 'default',
  },
];

// ── Weekly care (3 tasks) ─────────────────────────────────
export const WEEKLY_TASKS: Task[] = [
  {
    id: 'w1',
    name: 'Exfoliation',
    subtitle: '2-3x per week max',
    instructions:
      'Apply exfoliant on damp skin, gentle circular motions 60 seconds, rinse thoroughly, follow with moisturizer',
    section: 'weekly',
    isRequired: false,
    isOptional: true,
    stepOrder: 1,
    source: 'default',
  },
  {
    id: 'w2',
    name: 'Clay Mask',
    subtitle: 'Deep cleanse and pore minimizer',
    instructions:
      'Apply an even layer to clean skin, avoid eye area. Leave on for 10-15 minutes until dry. Rinse with lukewarm water and follow with moisturizer',
    section: 'weekly',
    isRequired: false,
    isOptional: true,
    stepOrder: 2,
    source: 'default',
  },
  {
    id: 'w3',
    name: 'Cold Compress',
    subtitle: 'De-puff and brighten eye area',
    instructions:
      'Wrap ice cubes in a clean cloth or use cold spoons. Gently press around eye area for 1-2 minutes each side. Helps reduce puffiness and dark circles',
    section: 'weekly',
    isRequired: false,
    isOptional: true,
    stepOrder: 3,
    source: 'default',
  },
];

// ── Today's sections ──────────────────────────────────────
// Wed (3) and Sun (0) → retinol night; all other days → normal night
export function getTodaySections(): Section[] {
  const day = new Date().getDay();
  const isRetinolNight = day === 3 || day === 0;

  return [
    { id: 'morning', label: 'Morning Routine', tasks: MORNING_TASKS },
    isRetinolNight
      ? { id: 'night_retinol', label: 'Night Routine', tasks: NIGHT_RETINOL_TASKS }
      : { id: 'night_normal', label: 'Night Routine', tasks: NIGHT_NORMAL_TASKS },
    { id: 'weekly', label: 'Weekly Care', tasks: WEEKLY_TASKS },
  ];
}
