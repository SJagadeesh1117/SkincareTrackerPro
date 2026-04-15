import firestore from '@react-native-firebase/firestore';

import type { Task } from '../constants/routineData';
import type { CatalogProduct, Order, RoutineSlot } from '../types';

type SectionKey = Task['section'];

export interface RoutineMapperResult {
  sectionTasks: Record<string, Task[]>;
  addedTasksBySection: Record<SectionKey, Task[]>;
  addedTaskCount: number;
  firestoreSyncFailed: boolean;
}

const SECTION_KEYS: SectionKey[] = [
  'morning',
  'night_normal',
  'weekly',
];

function cloneSectionTasks(
  sectionTasks: Record<string, Task[]>,
): Record<string, Task[]> {
  return SECTION_KEYS.reduce<Record<string, Task[]>>((acc, key) => {
    acc[key] = [...(sectionTasks[key] ?? [])];
    return acc;
  }, {});
}

function emptyAddedTasks(): Record<SectionKey, Task[]> {
  return {
    morning: [],
    night_normal: [],
    weekly: [],
  };
}

function getSectionsForSlot(slot: RoutineSlot): SectionKey[] {
  switch (slot) {
    case 'morning':
      return ['morning'];
    case 'night':
      return ['night_normal'];
    case 'both':
      return ['morning', 'night_normal'];
    case 'weekly':
      return ['weekly'];
    default:
      return [];
  }
}

function createOrderedTask(product: CatalogProduct, section: SectionKey): Task {
  const isWeekly = section === 'weekly';

  return {
    id: `ordered_${product.id}_${section}`,
    name: product.name,
    subtitle: product.brand,
    instructions: product.instructions,
    section,
    isRequired: !isWeekly,
    isOptional: isWeekly,
    stepOrder: product.stepOrder,
    source: 'ordered',
  };
}

async function syncTaskOrderToFirestore(
  uid: string,
  sectionTasks: Record<string, Task[]>,
): Promise<void> {
  const taskOrder = SECTION_KEYS.reduce<Record<string, string[]>>((acc, key) => {
    acc[key] = (sectionTasks[key] ?? []).map(task => task.id);
    return acc;
  }, {});

  await firestore()
    .collection('users')
    .doc(uid)
    .set({ routineConfig: { taskOrder } }, { merge: true });
}

export async function mapOrderToRoutine(params: {
  uid: string;
  orderId: string;
  currentSectionTasks: Record<string, Task[]>;
}): Promise<RoutineMapperResult> {
  const { uid, orderId, currentSectionTasks } = params;

  const orderDoc = await firestore()
    .collection('orders')
    .doc(uid)
    .collection('orders')
    .doc(orderId)
    .get();

  if (!orderDoc.exists()) {
    throw new Error('Order not found');
  }

  const order = orderDoc.data() as Order | undefined;
  const products = [...(order?.products ?? [])].sort(
    (a, b) => a.stepOrder - b.stepOrder,
  );

  const mergedSectionTasks = cloneSectionTasks(currentSectionTasks);
  const addedTasksBySection = emptyAddedTasks();

  for (const product of products) {
    for (const section of getSectionsForSlot(product.routineSlot)) {
      const task = createOrderedTask(product, section);
      const sectionTasks = mergedSectionTasks[section] ?? [];
      const exists = sectionTasks.some(existingTask => existingTask.id === task.id);

      if (exists) {
        continue;
      }

      mergedSectionTasks[section] = [...sectionTasks, task];
      addedTasksBySection[section].push(task);
    }
  }

  let firestoreSyncFailed = false;
  try {
    await syncTaskOrderToFirestore(uid, mergedSectionTasks);
  } catch {
    firestoreSyncFailed = true;
  }

  const addedTaskCount = SECTION_KEYS.reduce(
    (total, key) => total + addedTasksBySection[key].length,
    0,
  );

  return {
    sectionTasks: mergedSectionTasks,
    addedTasksBySection,
    addedTaskCount,
    firestoreSyncFailed,
  };
}
