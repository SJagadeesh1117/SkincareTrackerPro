/**
 * notificationService.ts
 *
 * Wraps @notifee/react-native for scheduling daily skincare reminders.
 * Firebase Messaging (FCM token) is best-effort — messaging is disabled on
 * Android due to the Windows MAX_PATH constraint.
 */

import { Platform, PermissionsAndroid } from 'react-native';
import notifee, {
  AndroidImportance,
  TimestampTrigger,
  TriggerType,
  RepeatFrequency,
  AuthorizationStatus,
} from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

// ── Constants ─────────────────────────────────────────────

export const CHANNEL_ID = 'skincare_reminders';
export const PREFS_KEY = 'reminderPrefs';

export type ReminderType = 'morning' | 'night';

export interface ReminderPref {
  enabled: boolean;
  hour: number;
  minute: number;
}

export interface ReminderPrefs {
  morning: ReminderPref;
  night: ReminderPref;
}

export const DEFAULT_PREFS: ReminderPrefs = {
  morning: { enabled: false, hour: 9, minute: 0 },
  night: { enabled: false, hour: 21, minute: 0 },
};

// ── Permission ────────────────────────────────────────────

export async function requestPermission(): Promise<boolean> {
  try {
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      );
      return result === PermissionsAndroid.RESULTS.GRANTED;
    }

    // iOS / Android < 13
    const settings = await notifee.requestPermission();
    return settings.authorizationStatus >= AuthorizationStatus.AUTHORIZED;
  } catch {
    return false;
  }
}

export async function checkPermission(): Promise<boolean> {
  try {
    const settings = await notifee.getNotificationSettings();
    return settings.authorizationStatus >= AuthorizationStatus.AUTHORIZED;
  } catch {
    return false;
  }
}

// ── Channel ───────────────────────────────────────────────

export async function createNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await notifee.createChannel({
      id: CHANNEL_ID,
      name: 'Skincare Reminders',
      importance: AndroidImportance.HIGH,
      sound: 'default',
      vibration: true,
    });
  } catch { /* best-effort */ }
}

// ── Body helpers ──────────────────────────────────────────

function isRetinolNight(): boolean {
  const day = new Date().getDay(); // 0=Sun, 3=Wed
  return day === 0 || day === 3;
}

function getNotificationBody(type: ReminderType): string {
  if (type === 'morning') return 'Time for your morning skincare routine! ✨';
  return "Time for your evening skincare routine! 🌙";
}

// ── Schedule / cancel ─────────────────────────────────────

export async function scheduleDailyReminder(
  type: ReminderType,
  hour: number,
  minute: number,
): Promise<void> {
  const notifId = `reminder_${type}`;

  // Cancel any existing reminder for this type
  try {
    await notifee.cancelNotification(notifId);
  } catch { /* not found — ok */ }

  // Build next trigger time
  const now = new Date();
  const trigger = new Date();
  trigger.setHours(hour, minute, 0, 0);
  if (trigger <= now) {
    // Already past today → schedule for tomorrow
    trigger.setDate(trigger.getDate() + 1);
  }

  const timestampTrigger: TimestampTrigger = {
    type: TriggerType.TIMESTAMP,
    timestamp: trigger.getTime(),
    repeatFrequency: RepeatFrequency.DAILY,
  };

  const title = type === 'morning' ? '🌅 Morning Routine' : '🌙 Night Routine';

  try {
    await notifee.createTriggerNotification(
      {
        id: notifId,
        title,
        body: getNotificationBody(type),
        android: {
          channelId: CHANNEL_ID,
          smallIcon: 'ic_notification',
          pressAction: { id: 'default' },
          importance: AndroidImportance.HIGH,
        },
        ios: {
          sound: 'default',
          badgeCount: 1,
        },
      },
      timestampTrigger,
    );
  } catch (err) {
    console.warn(`[notifee] Failed to schedule ${type} reminder:`, err);
  }
}

export async function cancelReminder(type: ReminderType): Promise<void> {
  try {
    await notifee.cancelNotification(`reminder_${type}`);
  } catch { /* best-effort */ }
}

export async function cancelAllReminders(): Promise<void> {
  try {
    await notifee.cancelAllNotifications();
  } catch { /* best-effort */ }
}

// ── Prefs persistence ─────────────────────────────────────

export async function saveReminderPrefs(prefs: ReminderPrefs): Promise<void> {
  try {
    await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch { /* best-effort */ }

  const uid = auth().currentUser?.uid;
  if (!uid) return;
  try {
    await firestore()
      .collection('users')
      .doc(uid)
      .set({ preferences: { reminders: prefs } }, { merge: true });
  } catch { /* Firestore disabled on Android — local only */ }
}

export async function loadReminderPrefs(): Promise<ReminderPrefs> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    if (raw) return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch { /* fall through */ }
  return DEFAULT_PREFS;
}

// ── Reschedule all (called on app launch) ─────────────────

export async function rescheduleAll(prefs: ReminderPrefs): Promise<void> {
  const types: ReminderType[] = ['morning', 'night'];
  for (const type of types) {
    const pref = prefs[type];
    if (pref.enabled) {
      await scheduleDailyReminder(type, pref.hour, pref.minute);
    } else {
      await cancelReminder(type);
    }
  }
}

// ── FCM token (best-effort, disabled on Android MAX_PATH) ─

export async function getFCMToken(): Promise<string | null> {
  try {
    // messaging() will throw if the native module is not linked
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const messaging = require('@react-native-firebase/messaging').default;
    const token: string = await messaging().getToken();

    const uid = auth().currentUser?.uid;
    if (uid && token) {
      try {
        await firestore()
          .collection('users')
          .doc(uid)
          .set({ fcmToken: token }, { merge: true });
      } catch { /* Firestore disabled */ }
    }
    return token;
  } catch {
    return null; // messaging not linked on this build
  }
}
