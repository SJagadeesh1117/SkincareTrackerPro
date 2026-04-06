/**
 * streakService.ts
 *
 * Handles streak calculation, persistence (AsyncStorage), and cloud sync
 * (Firestore — best-effort, silently fails when native module is disabled).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { format, subDays } from 'date-fns';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import type { Task } from '../constants/routineData';

// ── Types ─────────────────────────────────────────────────

export interface StreakData {
  currentStreak: number;
  bestStreak: number;
  /** The last date (YYYY-MM-DD) on which the full routine was completed */
  lastCompletedDate: string | null;
  /** date string → whether that day was fully completed */
  history: Record<string, boolean>;
}

// ── Constants ─────────────────────────────────────────────

const STORAGE_KEY = 'streakData';

const DEFAULT_STREAK: StreakData = {
  currentStreak: 0,
  bestStreak: 0,
  lastCompletedDate: null,
  history: {},
};

// ── Pure helpers ──────────────────────────────────────────

/**
 * Returns true only if every required task (isRequired: true) in today's
 * relevant sections is checked.
 */
export function isTodayComplete(
  checkedTasks: Record<string, boolean>,
  requiredTasks: Task[],
): boolean {
  if (requiredTasks.length === 0) return false;
  return requiredTasks.every(t => !!checkedTasks[t.id]);
}

/**
 * Recalculates streak values from a history record.
 *
 * current: consecutive true days walking backward from yesterday
 *          (today is not yet counted here — updateStreak handles today).
 * best:    longest consecutive run across all of history.
 */
export function calculateStreak(
  history: Record<string, boolean>,
): { current: number; best: number } {
  // ── current streak ────────────────────────────────────
  let current = 0;
  let d = subDays(new Date(), 1); // start from yesterday
  while (history[format(d, 'yyyy-MM-dd')]) {
    current++;
    d = subDays(d, 1);
  }

  // ── best streak across full history ──────────────────
  const sortedDates = Object.keys(history).sort(); // ascending
  let best = 0;
  let run = 0;
  for (const date of sortedDates) {
    if (history[date]) {
      run++;
      if (run > best) best = run;
    } else {
      run = 0;
    }
  }

  return { current, best };
}

// ── Storage helpers ───────────────────────────────────────

export async function loadStreakData(): Promise<StreakData> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      // Merge with defaults to ensure all keys exist on older stored objects
      return { ...DEFAULT_STREAK, ...JSON.parse(raw) };
    }
  } catch {
    /* corrupted — start fresh */
  }
  return { ...DEFAULT_STREAK };
}

export async function saveStreakData(data: StreakData): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// ── Main update function ──────────────────────────────────

/**
 * Call this whenever task state changes.
 *
 * If todayComplete is true and today has not been counted yet:
 *   - Increments currentStreak (or resets to 1 if streak was broken)
 *   - Updates history[today] = true
 *   - Updates lastCompletedDate
 *   - Persists to AsyncStorage
 *   - Best-effort syncs { currentStreak, bestStreak, lastCompletedDate }
 *     to Firestore users/{uid} (silent on failure)
 *
 * Returns the (potentially updated) StreakData.
 */
export async function updateStreak(todayComplete: boolean): Promise<StreakData> {
  const today = format(new Date(), 'yyyy-MM-dd');
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');

  const data = await loadStreakData();

  if (todayComplete && data.lastCompletedDate !== today) {
    // Mark today in history
    data.history = { ...data.history, [today]: true };

    // Extend streak if yesterday was completed, otherwise restart
    if (data.lastCompletedDate === yesterday) {
      data.currentStreak += 1;
    } else {
      data.currentStreak = 1;
    }

    data.lastCompletedDate = today;
    data.bestStreak = Math.max(data.currentStreak, data.bestStreak);

    await saveStreakData(data);

    // ── Cloud sync (best-effort) ──────────────────────
    const uid = auth().currentUser?.uid;
    if (uid) {
      try {
        await firestore()
          .collection('users')
          .doc(uid)
          .set(
            {
              currentStreak: data.currentStreak,
              bestStreak: data.bestStreak,
              lastCompletedDate: data.lastCompletedDate,
            },
            { merge: true },
          );
      } catch {
        // Firestore unavailable — AsyncStorage is the source of truth
      }
    }
  }

  return data;
}
