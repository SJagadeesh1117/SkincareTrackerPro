export interface Task {
  id: string;
  name: string;
  subtitle: string;
  instructions: string;
  section: 'morning' | 'night_normal' | 'weekly';
  isRequired: boolean;
  isOptional: boolean;
  stepOrder: number;
  source: 'default' | 'ordered' | 'custom' | 'tracked';
  isActive?: boolean;
  trackedStatus?: 'ordered' | 'delivered';
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
export function getTodaySections(): Section[] {
  return [
    { id: 'morning',      label: 'Morning Routine', tasks: MORNING_TASKS },
    { id: 'night_normal', label: 'Evening Routine', tasks: NIGHT_NORMAL_TASKS },
    { id: 'weekly',       label: 'Weekly Care',     tasks: WEEKLY_TASKS },
  ];
}
