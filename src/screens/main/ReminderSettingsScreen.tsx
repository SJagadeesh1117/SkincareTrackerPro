/**
 * ReminderSettingsScreen.tsx
 *
 * Two daily reminder cards (morning / night) with toggle + time picker.
 * Uses @notifee/react-native for scheduling and @react-native-community/datetimepicker.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Switch,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  Linking,
  ActivityIndicator,
} from 'react-native';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Toast from 'react-native-toast-message';

import {
  requestPermission,
  checkPermission,
  scheduleDailyReminder,
  cancelReminder,
  saveReminderPrefs,
  loadReminderPrefs,
  DEFAULT_PREFS,
  type ReminderPrefs,
  type ReminderType,
} from '../../services/notificationService';

// ── Helpers ────────────────────────────────────────────────

function padTwo(n: number): string {
  return n.toString().padStart(2, '0');
}

function formatTime(hour: number, minute: number): string {
  const h = hour % 12 || 12;
  const ampm = hour < 12 ? 'AM' : 'PM';
  return `${h}:${padTwo(minute)} ${ampm}`;
}

function buildDateFromHourMinute(hour: number, minute: number): Date {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d;
}

// ── Sub-components ─────────────────────────────────────────

interface ReminderCardProps {
  type: ReminderType;
  title: string;
  subtitle: string;
  icon: string;
  iconBg: string;
  enabled: boolean;
  hour: number;
  minute: number;
  onToggle: (type: ReminderType, value: boolean) => void;
  onTimeChange: (type: ReminderType, hour: number, minute: number) => void;
  hasPermission: boolean;
}

function ReminderCard({
  type,
  title,
  subtitle,
  icon,
  iconBg,
  enabled,
  hour,
  minute,
  onToggle,
  onTimeChange,
  hasPermission,
}: ReminderCardProps) {
  const [showPicker, setShowPicker] = useState(false);

  const handlePickerChange = (
    _event: DateTimePickerEvent,
    selectedDate?: Date,
  ) => {
    if (Platform.OS === 'android') setShowPicker(false);
    if (selectedDate) {
      onTimeChange(type, selectedDate.getHours(), selectedDate.getMinutes());
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
          <MaterialCommunityIcons name={icon} size={22} color="#fff" />
        </View>
        <View style={styles.cardTitles}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardSubtitle}>{subtitle}</Text>
        </View>
        <Switch
          value={enabled}
          onValueChange={v => onToggle(type, v)}
          trackColor={{ false: '#D1D5DB', true: '#DDD6FE' }}
          thumbColor={enabled ? '#8B5CF6' : '#9CA3AF'}
          disabled={!hasPermission && !enabled}
        />
      </View>

      {enabled && (
        <View style={styles.timeRow}>
          <Text style={styles.timeLabel}>Time</Text>
          <TouchableOpacity
            style={styles.timeButton}
            activeOpacity={0.7}
            onPress={() => setShowPicker(true)}>
            <MaterialCommunityIcons name="clock-outline" size={16} color="#6D28D9" />
            <Text style={styles.timeButtonText}>{formatTime(hour, minute)}</Text>
            <MaterialCommunityIcons name="chevron-down" size={16} color="#6B7280" />
          </TouchableOpacity>
        </View>
      )}

      {showPicker && (
        <DateTimePicker
          value={buildDateFromHourMinute(hour, minute)}
          mode="time"
          is24Hour={false}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handlePickerChange}
        />
      )}
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────

export function ReminderSettingsScreen() {
  const [prefs, setPrefs] = useState<ReminderPrefs>(DEFAULT_PREFS);
  const [hasPermission, setHasPermission] = useState(true);
  const [loading, setLoading] = useState(true);

  // Load prefs + check permission on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      const [p, perm] = await Promise.all([
        loadReminderPrefs(),
        checkPermission(),
      ]);
      if (!mounted) return;
      setPrefs(p);
      setHasPermission(perm);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  const handleRequestPermission = useCallback(async () => {
    const granted = await requestPermission();
    setHasPermission(granted);
    if (!granted) {
      Linking.openSettings();
    }
  }, []);

  const handleToggle = useCallback(
    async (type: ReminderType, value: boolean) => {
      if (value && !hasPermission) {
        const granted = await requestPermission();
        setHasPermission(granted);
        if (!granted) {
          Toast.show({
            type: 'error',
            text1: 'Notifications blocked',
            text2: 'Please allow notifications in device Settings.',
            visibilityTime: 3000,
          });
          return;
        }
      }

      const updated: ReminderPrefs = {
        ...prefs,
        [type]: { ...prefs[type], enabled: value },
      };
      setPrefs(updated);
      await saveReminderPrefs(updated);

      if (value) {
        await scheduleDailyReminder(type, updated[type].hour, updated[type].minute);
        Toast.show({
          type: 'success',
          text1: `${type === 'morning' ? 'Morning' : 'Night'} reminder set`,
          text2: `Daily at ${formatTime(updated[type].hour, updated[type].minute)}`,
          visibilityTime: 2500,
        });
      } else {
        await cancelReminder(type);
        Toast.show({
          type: 'info',
          text1: `${type === 'morning' ? 'Morning' : 'Night'} reminder disabled`,
          visibilityTime: 2000,
        });
      }
    },
    [prefs, hasPermission],
  );

  const handleTimeChange = useCallback(
    async (type: ReminderType, hour: number, minute: number) => {
      const updated: ReminderPrefs = {
        ...prefs,
        [type]: { ...prefs[type], hour, minute },
      };
      setPrefs(updated);
      await saveReminderPrefs(updated);

      if (updated[type].enabled) {
        await scheduleDailyReminder(type, hour, minute);
        Toast.show({
          type: 'success',
          text1: 'Reminder updated',
          text2: `${type === 'morning' ? 'Morning' : 'Night'} reminder at ${formatTime(hour, minute)}`,
          visibilityTime: 2000,
        });
      }
    },
    [prefs],
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#8B5CF6" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}>

      {/* Permission banner */}
      {!hasPermission && (
        <TouchableOpacity
          style={styles.permBanner}
          activeOpacity={0.8}
          onPress={handleRequestPermission}>
          <MaterialCommunityIcons name="bell-off" size={20} color="#92400E" />
          <Text style={styles.permBannerText}>
            Notifications are blocked. Tap to open Settings and allow them.
          </Text>
          <MaterialCommunityIcons name="chevron-right" size={18} color="#92400E" />
        </TouchableOpacity>
      )}

      <Text style={styles.sectionLabel}>DAILY REMINDERS</Text>

      <ReminderCard
        type="morning"
        title="Morning Routine"
        subtitle="Start your day with fresh skin"
        icon="weather-sunny"
        iconBg="#F59E0B"
        enabled={prefs.morning.enabled}
        hour={prefs.morning.hour}
        minute={prefs.morning.minute}
        onToggle={handleToggle}
        onTimeChange={handleTimeChange}
        hasPermission={hasPermission}
      />

      <ReminderCard
        type="night"
        title="Night Routine"
        subtitle="End your day with proper skincare"
        icon="weather-night"
        iconBg="#6366F1"
        enabled={prefs.night.enabled}
        hour={prefs.night.hour}
        minute={prefs.night.minute}
        onToggle={handleToggle}
        onTimeChange={handleTimeChange}
        hasPermission={hasPermission}
      />

      <Text style={styles.sectionLabel}>ABOUT</Text>

      <View style={styles.card}>
        <View style={styles.infoRow}>
          <View style={[styles.iconCircle, { backgroundColor: '#8B5CF6' }]}>
            <MaterialCommunityIcons name="refresh" size={20} color="#fff" />
          </View>
          <View style={styles.cardTitles}>
            <Text style={styles.cardTitle}>Daily Reset at Midnight</Text>
            <Text style={styles.cardSubtitle}>
              Your routine checklist resets automatically each day at 12:00 AM so
              you start fresh. Your streak is preserved as long as you complete
              all required steps before midnight.
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.infoRow}>
          <View style={[styles.iconCircle, { backgroundColor: '#8B5CF6' }]}>
            <MaterialCommunityIcons name="flask" size={20} color="#fff" />
          </View>
          <View style={styles.cardTitles}>
            <Text style={styles.cardTitle}>Retinol Nights</Text>
            <Text style={styles.cardSubtitle}>
              On Wednesdays and Sundays your night reminder will remind you about
              your retinol routine. The notification adapts automatically — no
              extra setup needed.
            </Text>
          </View>
        </View>
      </View>

    </ScrollView>
  );
}

// ── Styles ─────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
  },
  permBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  permBannerText: {
    flex: 1,
    fontSize: 13,
    color: '#92400E',
    lineHeight: 18,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitles: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 17,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  timeLabel: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  timeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F5FF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 6,
    borderWidth: 1,
    borderColor: '#E9E4FF',
  },
  timeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6D28D9',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
});
