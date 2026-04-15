/**
 * routineStore.ts
 *
 * Zustand store for daily routine state + edit mode.
 * - checkedTasks: persisted to AsyncStorage (routine_YYYY-MM-DD)
 * - sectionTasks: ordered task lists for all sections (routine_section_tasks)
 * - Streak logic delegated to streakService
 * - Firestore sync via firestoreSync (debounced, best-effort)
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format } from 'date-fns';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

import {
  updateStreak,
  loadStreakData,
  saveStreakData,
} from '../services/streakService';
import { syncDailyState, mergeWithLocal } from '../services/firestoreSync';
import {
  MORNING_TASKS,
  NIGHT_NORMAL_TASKS,
  WEEKLY_TASKS,
} from '../constants/routineData';
import type { Task } from '../constants/routineData';

// ── Keys ──────────────────────────────────────────────────

function todayDateStr(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

function taskStorageKey(d: string): string {
  return `routine_${d}`;
}

const SECTION_TASKS_KEY = 'routine_section_tasks';
const DELETED_TASK_IDS_KEY = 'routine_deleted_task_ids';

// New users start with empty sections — tasks are added via products / custom steps
const DEFAULT_SECTION_TASKS: Record<string, Task[]> = {
  morning: [],
  night_normal: [],
  weekly: [],
};

// ── Store interface ───────────────────────────────────────

interface RoutineStore {
  // ── Daily check state ───────────────────────────────
  checkedTasks: Record<string, boolean>;
  currentStreak: number;
  bestStreak: number;
  activeDate: string;
  loaded: boolean;

  // ── Edit mode ───────────────────────────────────────
  isEditMode: boolean;
  /** Per-section ordered task arrays covering all 4 sections */
  sectionTasks: Record<string, Task[]>;
  /** IDs of tasks explicitly deleted by the user — filtered out on every setRoutineConfig */
  deletedTaskIds: string[];

  // ── Check actions ───────────────────────────────────
  loadToday: () => Promise<void>;
  toggleTask: (taskId: string) => Promise<void>;
  markAllDone: (taskIds: string[]) => Promise<void>;
  resetDay: () => Promise<void>;
  checkAndUpdateStreak: (requiredTaskIds: string[]) => Promise<void>;
  checkDateChange: () => Promise<boolean>;
  handleForeground: (uid: string, requiredTaskIds: string[]) => Promise<void>;

  // ── Edit mode actions ───────────────────────────────
  setEditMode: (v: boolean) => void;
  setRoutineConfig: (sectionTasks: Record<string, Task[]>) => Promise<void>;
  reorderTasks: (sectionId: string, tasks: Task[]) => Promise<void>;
  deleteTask: (
    sectionId: string,
    taskId: string,
  ) => Promise<{ task: Task; index: number } | null>;
  undoDelete: (sectionId: string, task: Task, index: number) => Promise<void>;
  addCustomTask: (task: Task) => Promise<void>;
  restoreDefaults: () => Promise<void>;
  saveRoutineConfig: () => Promise<void>;
}

// ── Store ─────────────────────────────────────────────────

export const useRoutineStore = create<RoutineStore>((set, get) => ({
  checkedTasks: {},
  currentStreak: 0,
  bestStreak: 0,
  activeDate: '',
  loaded: false,
  isEditMode: false,
  sectionTasks: DEFAULT_SECTION_TASKS,
  deletedTaskIds: [],

  // ────────────────────────────────────────────────────────
  // loadToday — loads check state AND section task order
  // ────────────────────────────────────────────────────────
  loadToday: async () => {
    const today = todayDateStr();

    // Load checked tasks for today
    let checkedTasks: Record<string, boolean> = {};
    try {
      const raw = await AsyncStorage.getItem(taskStorageKey(today));
      if (raw) checkedTasks = JSON.parse(raw);
    } catch { /* start fresh */ }

    // Load deleted task IDs
    let deletedTaskIds: string[] = [];
    try {
      const raw = await AsyncStorage.getItem(DELETED_TASK_IDS_KEY);
      if (raw) deletedTaskIds = JSON.parse(raw);
    } catch { /* use empty */ }

    // Load section task order (custom order + custom tasks), filtered by deleted IDs
    let sectionTasks: Record<string, Task[]> = DEFAULT_SECTION_TASKS;
    try {
      const raw = await AsyncStorage.getItem(SECTION_TASKS_KEY);
      if (raw) {
        const parsed: Record<string, Task[]> = JSON.parse(raw);
        // Re-apply deleted filter in case a previous setRoutineConfig slipped through
        const deletedSet = new Set(deletedTaskIds);
        for (const key of Object.keys(parsed)) {
          parsed[key] = parsed[key].filter(t => !deletedSet.has(t.id));
        }
        sectionTasks = parsed;
      }
    } catch { /* use defaults */ }

    // Load + validate streak (break detection)
    let streakData = await loadStreakData();
    const yesterday = format(
      new Date(new Date().setDate(new Date().getDate() - 1)),
      'yyyy-MM-dd',
    );
    if (
      streakData.lastCompletedDate &&
      streakData.lastCompletedDate !== today &&
      streakData.lastCompletedDate !== yesterday
    ) {
      streakData = { ...streakData, currentStreak: 0 };
      await saveStreakData(streakData);
    }

    set({
      checkedTasks,
      sectionTasks,
      deletedTaskIds,
      currentStreak: streakData.currentStreak,
      bestStreak: streakData.bestStreak,
      activeDate: today,
      loaded: true,
    });
  },

  // ────────────────────────────────────────────────────────
  // toggleTask
  // ────────────────────────────────────────────────────────
  toggleTask: async (taskId: string) => {
    const prev = get().checkedTasks;
    const updated = { ...prev, [taskId]: !prev[taskId] };
    set({ checkedTasks: updated });

    const today = todayDateStr();
    try {
      await AsyncStorage.setItem(taskStorageKey(today), JSON.stringify(updated));
    } catch {
      set({ checkedTasks: prev });
      return;
    }

    const uid = auth().currentUser?.uid;
    if (uid) {
      const ids = Object.keys(updated).filter(id => updated[id]);
      syncDailyState(uid, today, ids, false);
    }
  },

  // ────────────────────────────────────────────────────────
  // markAllDone
  // ────────────────────────────────────────────────────────
  markAllDone: async (taskIds: string[]) => {
    const updated: Record<string, boolean> = { ...get().checkedTasks };
    for (const id of taskIds) updated[id] = true;
    set({ checkedTasks: updated });

    const today = todayDateStr();
    try {
      await AsyncStorage.setItem(taskStorageKey(today), JSON.stringify(updated));
    } catch { /* best-effort */ }

    const uid = auth().currentUser?.uid;
    if (uid) syncDailyState(uid, today, taskIds, true);
  },

  // ────────────────────────────────────────────────────────
  // resetDay
  // ────────────────────────────────────────────────────────
  resetDay: async () => {
    set({ checkedTasks: {} });
    const today = todayDateStr();
    try {
      await AsyncStorage.removeItem(taskStorageKey(today));
    } catch { /* best-effort */ }

    const uid = auth().currentUser?.uid;
    if (uid) syncDailyState(uid, today, [], false);
  },

  // ────────────────────────────────────────────────────────
  // checkAndUpdateStreak
  // ────────────────────────────────────────────────────────
  checkAndUpdateStreak: async (requiredTaskIds: string[]) => {
    if (requiredTaskIds.length === 0) return;

    const { checkedTasks } = get();
    const complete = requiredTaskIds.every(id => !!checkedTasks[id]);

    const data = await updateStreak(complete);
    set({ currentStreak: data.currentStreak, bestStreak: data.bestStreak });

    const uid = auth().currentUser?.uid;
    if (uid) {
      const today = todayDateStr();
      const ids = Object.keys(checkedTasks).filter(id => checkedTasks[id]);
      syncDailyState(uid, today, ids, complete);
    }
  },

  // ────────────────────────────────────────────────────────
  // checkDateChange
  // ────────────────────────────────────────────────────────
  checkDateChange: async () => {
    const today = todayDateStr();
    const { activeDate } = get();

    if (activeDate && activeDate !== today) {
      set({ checkedTasks: {}, activeDate: today });
      try { await AsyncStorage.removeItem(taskStorageKey(today)); } catch { /* */ }
      return true;
    }

    if (!activeDate) set({ activeDate: today });
    return false;
  },

  // ────────────────────────────────────────────────────────
  // handleForeground
  // ────────────────────────────────────────────────────────
  handleForeground: async (uid: string, requiredTaskIds: string[]) => {
    const today = todayDateStr();
    const { checkedTasks: local } = get();

    const merged = await mergeWithLocal(uid, today, local);
    const hasChanges = Object.keys(merged).some(id => merged[id] !== local[id]);
    if (!hasChanges) return;

    set({ checkedTasks: merged });
    try {
      await AsyncStorage.setItem(taskStorageKey(today), JSON.stringify(merged));
    } catch { /* best-effort */ }

    if (requiredTaskIds.length > 0) {
      const complete = requiredTaskIds.every(id => !!merged[id]);
      const data = await updateStreak(complete);
      set({ currentStreak: data.currentStreak, bestStreak: data.bestStreak });
    }
  },

  // ════════════════════════════════════════════════════════
  // EDIT MODE ACTIONS
  // ════════════════════════════════════════════════════════

  setEditMode: (v: boolean) => set({ isEditMode: v }),

  // ── setRoutineConfig ────────────────────────────────────
  setRoutineConfig: async (incoming: Record<string, Task[]>) => {
    // Always filter out tasks the user has explicitly deleted
    const deletedSet = new Set(get().deletedTaskIds);
    const sectionTasks: Record<string, Task[]> = {};
    for (const key of Object.keys(incoming)) {
      sectionTasks[key] = incoming[key].filter(t => !deletedSet.has(t.id));
    }
    set({ sectionTasks });
    try {
      await AsyncStorage.setItem(SECTION_TASKS_KEY, JSON.stringify(sectionTasks));
    } catch { /* best-effort */ }
  },

  // ── reorderTasks ─────────────────────────────────────────
  reorderTasks: async (sectionId: string, tasks: Task[]) => {
    const updated = { ...get().sectionTasks, [sectionId]: tasks };
    set({ sectionTasks: updated });
    try {
      await AsyncStorage.setItem(SECTION_TASKS_KEY, JSON.stringify(updated));
    } catch { /* best-effort */ }
  },

  // ── deleteTask ────────────────────────────────────────────
  deleteTask: async (sectionId: string, taskId: string) => {
    const { sectionTasks, deletedTaskIds } = get();
    const tasks = sectionTasks[sectionId] ?? [];
    const index = tasks.findIndex(t => t.id === taskId);
    if (index === -1) return null;

    const task = tasks[index];
    const updatedTasks = { ...sectionTasks, [sectionId]: tasks.filter(t => t.id !== taskId) };
    const updatedDeleted = [...deletedTaskIds, taskId];
    set({ sectionTasks: updatedTasks, deletedTaskIds: updatedDeleted });
    try {
      await AsyncStorage.setItem(SECTION_TASKS_KEY, JSON.stringify(updatedTasks));
      await AsyncStorage.setItem(DELETED_TASK_IDS_KEY, JSON.stringify(updatedDeleted));
    } catch { /* best-effort */ }

    return { task, index };
  },

  // ── undoDelete ────────────────────────────────────────────
  undoDelete: async (sectionId: string, task: Task, index: number) => {
    const { sectionTasks, deletedTaskIds } = get();
    const tasks = [...(sectionTasks[sectionId] ?? [])];
    tasks.splice(index, 0, task);
    const updatedTasks = { ...sectionTasks, [sectionId]: tasks };
    // Remove from deleted set so future syncs can include it again
    const updatedDeleted = deletedTaskIds.filter(id => id !== task.id);
    set({ sectionTasks: updatedTasks, deletedTaskIds: updatedDeleted });
    try {
      await AsyncStorage.setItem(SECTION_TASKS_KEY, JSON.stringify(updatedTasks));
      await AsyncStorage.setItem(DELETED_TASK_IDS_KEY, JSON.stringify(updatedDeleted));
    } catch { /* best-effort */ }
  },

  // ── addCustomTask ─────────────────────────────────────────
  addCustomTask: async (task: Task) => {
    const { sectionTasks } = get();
    const sectionId = task.section;
    const existing = sectionTasks[sectionId] ?? [];
    const updated = { ...sectionTasks, [sectionId]: [...existing, task] };
    set({ sectionTasks: updated });
    try {
      await AsyncStorage.setItem(SECTION_TASKS_KEY, JSON.stringify(updated));
    } catch { /* best-effort */ }

    // Sync all custom tasks to Firestore
    const uid = auth().currentUser?.uid;
    if (uid) {
      try {
        const allCustom = Object.values(updated)
          .flat()
          .filter(t => t.source === 'custom');
        await firestore()
          .collection('users')
          .doc(uid)
          .set({ customTasks: allCustom }, { merge: true });
      } catch { /* Firestore disabled */ }
    }
  },

  // ── restoreDefaults — clears deleted-IDs blacklist so all added tasks are visible again
  restoreDefaults: async () => {
    // We don't restore hardcoded tasks; we only clear the deleted blacklist
    // so any tasks previously re-added via products / custom steps reappear.
    const { sectionTasks } = get();
    set({ deletedTaskIds: [] });
    try {
      await AsyncStorage.setItem(SECTION_TASKS_KEY, JSON.stringify(sectionTasks));
      await AsyncStorage.removeItem(DELETED_TASK_IDS_KEY);
    } catch { /* best-effort */ }
  },

  // ── saveRoutineConfig ─────────────────────────────────────
  // Called on every "Done" press. Syncs task order to Firestore.
  saveRoutineConfig: async () => {
    const { sectionTasks } = get();
    const uid = auth().currentUser?.uid;
    if (!uid) return;

    const taskOrder: Record<string, string[]> = {};
    for (const [sectionId, tasks] of Object.entries(sectionTasks)) {
      taskOrder[sectionId] = tasks.map(t => t.id);
    }

    try {
      await firestore()
        .collection('users')
        .doc(uid)
        .set({ routineConfig: { taskOrder } }, { merge: true });
    } catch { /* Firestore disabled — order already saved locally */ }
  },
}));
