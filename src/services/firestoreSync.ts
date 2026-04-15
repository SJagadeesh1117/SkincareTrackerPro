/**
 * firestoreSync.ts
 *
 * Debounced Firestore sync for daily routine state.
 * All writes are best-effort: failures are silently swallowed.
 * When offline, @react-native-firebase/firestore queues writes locally
 * (requires persistence: true — set in firebase.ts).
 */

import firestore from '@react-native-firebase/firestore';

// ── Module-level debounce timer ───────────────────────────
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
const DEBOUNCE_MS = 2000;

// ── Types ─────────────────────────────────────────────────

interface DailyStateDoc {
  checkedTasks: string[];
  updatedAt: ReturnType<typeof firestore.FieldValue.serverTimestamp>;
  isComplete: boolean;
}

// ── Helpers ───────────────────────────────────────────────

function dailyDocRef(uid: string, date: string) {
  return firestore()
    .collection('users')
    .doc(uid)
    .collection('dailyStates')
    .doc(date);
}

// ── Public API ────────────────────────────────────────────

/**
 * Debounced write to users/{uid}/dailyStates/{date}.
 * Multiple calls within 2 s are coalesced into a single write.
 *
 * @param uid           Firebase user UID
 * @param date          'YYYY-MM-DD' date string
 * @param checkedTaskIds Array of task IDs that are checked
 * @param isComplete    True when all required tasks are checked
 */
export function syncDailyState(
  uid: string,
  date: string,
  checkedTaskIds: string[],
  isComplete: boolean,
): void {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = setTimeout(async () => {
    debounceTimer = null;
    try {
      const payload: DailyStateDoc = {
        checkedTasks: checkedTaskIds,
        updatedAt: firestore.FieldValue.serverTimestamp(),
        isComplete,
      };
      await dailyDocRef(uid, date).set(payload);
    } catch {
      // Firestore offline or native module unavailable.
      // Built-in persistence will retry when back online.
    }
  }, DEBOUNCE_MS);
}

/**
 * Fetch checked task IDs for a given day from Firestore.
 * Returns [] when offline, unavailable, or no data exists.
 */
export async function loadDailyState(
  uid: string,
  date: string,
): Promise<string[]> {
  try {
    const doc = await dailyDocRef(uid, date).get();
    if (doc.exists()) {
      const tasks = doc.data()?.checkedTasks;
      if (Array.isArray(tasks)) return tasks as string[];
    }
  } catch {
    // offline or unavailable
  }
  return [];
}

/**
 * Merge Firestore daily state with local checked tasks map.
 * Strategy: union — a task checked on *any* device stays checked.
 * This means the most-complete state always wins (Firestore ∪ local).
 *
 * Returns the merged map (or the original local map if Firestore had nothing).
 */
export async function mergeWithLocal(
  uid: string,
  date: string,
  localChecked: Record<string, boolean>,
): Promise<Record<string, boolean>> {
  const remoteIds = await loadDailyState(uid, date);
  if (remoteIds.length === 0) return localChecked;

  const merged = { ...localChecked };
  for (const id of remoteIds) {
    merged[id] = true;
  }
  return merged;
}
