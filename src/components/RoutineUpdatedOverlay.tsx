import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import type { Task } from '../constants/routineData';

type SectionKey = Task['section'];

interface Props {
  visible: boolean;
  addedTasksBySection: Record<SectionKey, Task[]>;
  onEditRoutine: () => void;
  onClose: () => void;
}

const SECTION_META: Record<SectionKey, { label: string; bg: string; text: string }> = {
  morning: {
    label: 'Morning',
    bg: '#EDE9FE',
    text: '#6D28D9',
  },
  night_normal: {
    label: 'Evening',
    bg: '#E0E7FF',
    text: '#4338CA',
  },
  weekly: {
    label: 'Weekly',
    bg: '#FEF3C7',
    text: '#B45309',
  },
};

const SECTION_ORDER: SectionKey[] = [
  'morning',
  'night_normal',
  'weekly',
];

export function RoutineUpdatedOverlay({
  visible,
  addedTasksBySection,
  onEditRoutine,
  onClose,
}: Props) {
  const addedSections = SECTION_ORDER.filter(
    section => addedTasksBySection[section].length > 0,
  );
  const totalAdded = addedSections.reduce(
    (sum, section) => sum + addedTasksBySection[section].length,
    0,
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => undefined}>
          <View style={styles.header}>
            <Text style={styles.eyebrow}>Routine updated</Text>
            <Text style={styles.title}>Your new products were added</Text>
            <Text style={styles.body}>
              {totalAdded} step{totalAdded === 1 ? '' : 's'} are now part of your skincare routine.
            </Text>
          </View>

          <View style={styles.sectionList}>
            {addedSections.map(section => (
              <View key={section} style={styles.sectionRow}>
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: SECTION_META[section].bg },
                  ]}>
                  <Text
                    style={[
                      styles.badgeText,
                      { color: SECTION_META[section].text },
                    ]}>
                    {SECTION_META[section].label}
                  </Text>
                </View>
                <Text style={styles.sectionText}>
                  {addedTasksBySection[section].map(task => task.name).join(', ')}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.buttonGroup}>
            <TouchableOpacity
              style={styles.primaryButton}
              activeOpacity={0.85}
              onPress={onEditRoutine}>
              <Text style={styles.primaryButtonText}>Edit my routine</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryButton}
              activeOpacity={0.8}
              onPress={onClose}>
              <Text style={styles.secondaryButtonText}>Maybe later</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.52)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    gap: 18,
  },
  header: {
    gap: 8,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8B5CF6',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: '#6B7280',
  },
  sectionList: {
    gap: 12,
  },
  sectionRow: {
    gap: 8,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#F8F5FF',
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  sectionText: {
    fontSize: 14,
    lineHeight: 21,
    color: '#374151',
  },
  buttonGroup: {
    gap: 10,
  },
  primaryButton: {
    backgroundColor: '#8B5CF6',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
  },
  secondaryButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '700',
  },
});
