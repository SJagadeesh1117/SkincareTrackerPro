import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

import {
  MORNING_TASKS,
  NIGHT_NORMAL_TASKS,
  WEEKLY_TASKS,
} from '../constants/routineData';
import type { Task } from '../constants/routineData';
import { useRoutineStore } from '../store/routineStore';
import type { TrackedProduct } from '../types';

type SectionKey = Task['section'];

type RoutineConfig = Record<SectionKey, Task[]>;

const EMPTY_ROUTINE_CONFIG: RoutineConfig = {
  morning: [],
  night_normal: [],
  weekly: [],
};

// Routines are built from products — no pre-filled defaults
export const DEFAULT_ROUTINE_TASKS: RoutineConfig = {
  morning: [],
  night_normal: [],
  weekly: [],
};

export const mapSlotToSections = (routineSlot: string): SectionKey[] => {
  switch (routineSlot) {
    case 'morning':
      return ['morning'];
    case 'night':
      return ['night_normal'];
    case 'both':
      return ['morning', 'night_normal'];
    case 'weekly':
      return ['weekly'];
    default:
      return ['morning'];
  }
};

export const getRoutineSlotLabel = (routineSlot: string): string => {
  switch (routineSlot) {
    case 'morning':
      return 'Morning routine';
    case 'night':
      return 'Night routine';
    case 'both':
      return 'Morning + Night routines';
    case 'weekly':
      return 'Weekly extras';
    default:
      return 'Morning routine';
  }
};

const getRoutineConfigRef = (uid: string) =>
  firestore()
    .collection('users')
    .doc(uid)
    .collection('routineConfig')
    .doc('config');

const dedupeTasks = (tasks: Task[]): Task[] => {
  const seen = new Set<string>();
  const merged: Task[] = [];

  tasks.forEach(task => {
    if (seen.has(task.id)) {
      return;
    }
    seen.add(task.id);
    merged.push(task);
  });

  return merged;
};

export const loadRoutineConfigFromFirestore = async (): Promise<RoutineConfig> => {
  const uid = auth().currentUser?.uid;
  if (!uid) {
    throw new Error('Not authenticated');
  }

  const configDoc = await getRoutineConfigRef(uid).get();
  const config = configDoc.exists()
    ? (configDoc.data() as Partial<RoutineConfig>)
    : EMPTY_ROUTINE_CONFIG;

  return {
    morning: dedupeTasks([
      ...DEFAULT_ROUTINE_TASKS.morning,
      ...(config.morning ?? []),
    ]),
    night_normal: dedupeTasks([
      ...DEFAULT_ROUTINE_TASKS.night_normal,
      ...(config.night_normal ?? []),
    ]),
    weekly: dedupeTasks([
      ...DEFAULT_ROUTINE_TASKS.weekly,
      ...(config.weekly ?? []),
    ]),
  };
};

export const addProductToRoutine = async (
  product: TrackedProduct,
): Promise<RoutineConfig> => {
  const uid = auth().currentUser?.uid;
  if (!uid) {
    throw new Error('Not authenticated');
  }

  const sections = mapSlotToSections(product.routineSlot);
  const ingredients = product.keyIngredients.join(', ');
  const instructions = ingredients
    ? `${product.whyItWorks}\n\nKey ingredients: ${ingredients}`
    : product.whyItWorks;

  const configDoc = await getRoutineConfigRef(uid).get();
  const existingConfig = configDoc.exists()
    ? (configDoc.data() as Partial<RoutineConfig>)
    : EMPTY_ROUTINE_CONFIG;

  const updatedConfig: RoutineConfig = {
    morning: [...(existingConfig.morning ?? [])],
    night_normal: [...(existingConfig.night_normal ?? [])],
    weekly: [...(existingConfig.weekly ?? [])],
  };

  for (const section of sections) {
    const sectionTasks = updatedConfig[section] ?? [];
    const taskId = `tracked_${product.id}_${section}`;
    const alreadyExists = sectionTasks.some(task => task.id === taskId);

    if (alreadyExists) {
      continue;
    }

    updatedConfig[section] = [
      ...sectionTasks,
      {
        id: taskId,
        name: product.name,
        subtitle: product.brand,
        instructions,
        section,
        isRequired: true,
        isOptional: false,
        stepOrder: product.stepOrder,
        source: 'tracked',
        isActive: true,
      },
    ];
  }

  await getRoutineConfigRef(uid).set(updatedConfig, { merge: false });

  const mergedForStore: RoutineConfig = {
    morning: dedupeTasks([
      ...DEFAULT_ROUTINE_TASKS.morning,
      ...updatedConfig.morning,
    ]),
    night_normal: dedupeTasks([
      ...DEFAULT_ROUTINE_TASKS.night_normal,
      ...updatedConfig.night_normal,
    ]),
    weekly: dedupeTasks([
      ...DEFAULT_ROUTINE_TASKS.weekly,
      ...updatedConfig.weekly,
    ]),
  };

  await useRoutineStore.getState().setRoutineConfig(mergedForStore);

  return mergedForStore;
};
