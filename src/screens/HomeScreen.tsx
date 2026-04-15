/**
 * HomeScreen.tsx — theme-aware home screen, wired to useRoutineStore
 *
 * Data + business logic: useRoutineStore (streak, tasks, edit, add)
 * Visual design: useTheme() colors — zero hardcoded hex values
 */

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Picker } from '@react-native-picker/picker';

import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeContext';
import type { ThemeColors } from '../theme/colors';
import type { RoutineItem } from '../types/routine';
import { useRoutineStore } from '../store/routineStore';
import {
  MORNING_TASKS,
  NIGHT_NORMAL_TASKS,
  WEEKLY_TASKS,
} from '../constants/routineData';
import type { Task } from '../constants/routineData';

import { HeaderCard }          from '../components/HeaderCard';
import { StreakStats }         from '../components/StreakStats';
import { ProgressCard }        from '../components/ProgressCard';
import { RoutineSection }      from '../components/RoutineSection';
import { WeeklyExtrasSection } from '../components/WeeklyExtrasSection';
import { AIFaceScanCard }      from '../components/AIFaceScanCard';
import { EditRoutineModal }    from '../components/EditRoutineModal';
import { AddOptionSheet }      from '../components/AddOptionSheet';
import type { RoutineSlotParam } from '../types';

// ── Type helpers ──────────────────────────────────────────────────────────────

type SectionKey = 'morning' | 'night_normal' | 'weekly';

function taskToItem(task: Task, checkedTasks: Record<string, boolean>, tod: RoutineItem['timeOfDay']): RoutineItem {
  return {
    id: task.id,
    name: task.name,
    description: task.subtitle,
    notes: task.instructions,
    completed: !!checkedTasks[task.id],
    timeOfDay: tod,
  };
}

// ── Styles ────────────────────────────────────────────────────────────────────

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safeArea:      { flex: 1, backgroundColor: colors.background },
    container:     { flex: 1, backgroundColor: colors.background },
    scroll:        { flex: 1 },
    scrollContent: { paddingTop: 16, gap: 16, paddingBottom: 32 },

    actionsRow: { marginHorizontal: 16, gap: 10 },
    btnMarkDone: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 8, height: 52, borderRadius: 14, backgroundColor: colors.primary,
    },
    btnMarkDoneText: { fontSize: 15, fontWeight: '600', color: colors.white },
    btnReset: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 8, height: 52, borderRadius: 14,
      backgroundColor: colors.white, borderWidth: 1, borderColor: colors.borderStrong,
    },
    btnResetText: { fontSize: 15, fontWeight: '500', color: colors.primaryMid },

    // ── Add Task Modal ──
    modalOverlay: {
      flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end',
    },
    modalSheet: {
      backgroundColor: colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20,
      padding: 24, gap: 16,
    },
    modalTitle: { fontSize: 17, fontWeight: '700', color: colors.primaryDark, marginBottom: 4 },
    inputLabel: { fontSize: 12, fontWeight: '600', color: colors.primaryMid, marginBottom: 4 },
    textInput: {
      borderWidth: 1, borderColor: colors.border, borderRadius: 10,
      paddingHorizontal: 12, paddingVertical: 10,
      fontSize: 14, color: colors.primaryDark, backgroundColor: colors.surface,
    },
    pickerWrapper: {
      borderWidth: 1, borderColor: colors.border, borderRadius: 10,
      backgroundColor: colors.surface, overflow: 'hidden',
    },
    modalActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
    modalCancel: {
      flex: 1, height: 46, borderRadius: 12, borderWidth: 1,
      borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
    },
    modalCancelText: { fontSize: 15, color: colors.primaryMid, fontWeight: '500' },
    modalAdd: {
      flex: 1, height: 46, borderRadius: 12,
      backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
    },
    modalAddText: { fontSize: 15, color: colors.white, fontWeight: '600' },
  });
}

// ── Add Task Modal ────────────────────────────────────────────────────────────

interface AddModalProps {
  visible: boolean;
  initialSection: SectionKey;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
  onClose: () => void;
  onAdd: (task: Task) => void;
}

function AddTaskModal({ visible, initialSection, colors, styles, onClose, onAdd }: AddModalProps) {
  const [name, setName]         = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [section, setSection]   = useState<SectionKey>(initialSection);
  const [error, setError]       = useState('');

  useEffect(() => {
    if (visible) { setName(''); setSubtitle(''); setSection(initialSection); setError(''); }
  }, [visible, initialSection]);

  const handleAdd = () => {
    if (!name.trim()) { setError('Step name is required'); return; }
    const task: Task = {
      id: `custom_${Date.now()}`,
      name: name.trim(),
      subtitle: subtitle.trim() || '',
      instructions: '',
      section,
      isRequired: false,
      isOptional: true,
      stepOrder: 99,
      source: 'custom',
    };
    onAdd(task);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} onPress={() => {}}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Add step</Text>

            <View>
              <Text style={styles.inputLabel}>Step name *</Text>
              <TextInput
                style={[styles.textInput, error ? { borderColor: '#EF4444' } : {}]}
                placeholder="e.g. Eye cream"
                placeholderTextColor={colors.muted}
                value={name}
                onChangeText={t => { setName(t); setError(''); }}
              />
              {!!error && <Text style={{ color: '#EF4444', fontSize: 11, marginTop: 4 }}>{error}</Text>}
            </View>

            <View>
              <Text style={styles.inputLabel}>Description (optional)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Pea-sized amount"
                placeholderTextColor={colors.muted}
                value={subtitle}
                onChangeText={setSubtitle}
              />
            </View>

            <View>
              <Text style={styles.inputLabel}>Routine</Text>
              <View style={styles.pickerWrapper}>
                <Picker
                  selectedValue={section}
                  onValueChange={v => setSection(v as SectionKey)}
                  style={{ color: colors.primaryDark }}>
                  <Picker.Item label="Morning Routine" value="morning" />
                  <Picker.Item label="Night Routine" value="night_normal" />
                  <Picker.Item label="Weekly Care" value="weekly" />
                </Picker>
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={onClose}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalAdd} onPress={handleAdd}>
                <Text style={styles.modalAddText}>Add step</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export function HomeScreen() {
  const { colors, mode } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const navigation = useNavigation<any>();

  // ── Store ────────────────────────────────────────────────────────────────
  const {
    checkedTasks,
    currentStreak,
    bestStreak,
    loaded,
    sectionTasks,
    loadToday,
    toggleTask,
    markAllDone,
    resetDay,
    checkAndUpdateStreak,
    addCustomTask,
  } = useRoutineStore();

  // Load tasks + streak on mount
  useEffect(() => { loadToday(); }, [loadToday]);

  // ── Map store tasks → RoutineItem (checked state from checkedTasks) ──────
  const morningItems = useMemo(
    () => (sectionTasks.morning ?? MORNING_TASKS).map(t => taskToItem(t, checkedTasks, 'morning')),
    [sectionTasks.morning, checkedTasks],
  );

  const eveningItems = useMemo(
    () => (sectionTasks.night_normal ?? NIGHT_NORMAL_TASKS).map(t => taskToItem(t, checkedTasks, 'evening')),
    [sectionTasks.night_normal, checkedTasks],
  );

  const weeklyItems = useMemo(
    () => (sectionTasks.weekly ?? WEEKLY_TASKS).map(t => taskToItem(t, checkedTasks, 'weekly')),
    [sectionTasks.weekly, checkedTasks],
  );

  // Required task ids for streak (morning + evening, excluding weekly)
  const requiredTaskIds = useMemo(
    () => [...morningItems, ...eveningItems].map(i => i.id),
    [morningItems, eveningItems],
  );

  const allTaskIds = useMemo(
    () => [...morningItems, ...eveningItems, ...weeklyItems].map(i => i.id),
    [morningItems, eveningItems, weeklyItems],
  );

  // Progress (daily only)
  const dailyItems     = useMemo(() => [...morningItems, ...eveningItems], [morningItems, eveningItems]);
  const completedCount = useMemo(() => dailyItems.filter(i => i.completed).length, [dailyItems]);
  const totalCount     = dailyItems.length;

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleToggle = useCallback(async (id: string) => {
    await toggleTask(id);
    // Defer streak check so checkedTasks state is updated first
    setTimeout(() => checkAndUpdateStreak(requiredTaskIds), 150);
  }, [toggleTask, checkAndUpdateStreak, requiredTaskIds]);

  const handleMarkAllDone = useCallback(async () => {
    await markAllDone(allTaskIds);
    await checkAndUpdateStreak(requiredTaskIds);
  }, [markAllDone, checkAndUpdateStreak, allTaskIds, requiredTaskIds]);

  const handleResetDay = useCallback(async () => {
    await resetDay();
  }, [resetDay]);

  const handleEditRoutine = useCallback(() => {
    setEditModalVisible(true);
  }, []);

  const handleFaceScan = useCallback(() => {
    // Navigate to ScanTab via the parent tab navigator
    navigation.getParent()?.navigate('ScanTab');
  }, [navigation]);

  // ── Edit routine modal ────────────────────────────────────────────────────
  const [editModalVisible, setEditModalVisible] = useState(false);

  // ── Add option sheet (choose: manual or scan) ────────────────────────────
  const [addSheetVisible, setAddSheetVisible]   = useState(false);
  const [addSheetSlot, setAddSheetSlot]         = useState<RoutineSlotParam>('morning');

  // ── Add task modal (manual entry) ────────────────────────────────────────
  const [addModalVisible, setAddModalVisible]   = useState(false);
  const [addModalSection, setAddModalSection]   = useState<SectionKey>('morning');

  // Map RoutineSlotParam → SectionKey for the manual modal
  const slotToSection = useCallback((slot: RoutineSlotParam): SectionKey => {
    switch (slot) {
      case 'morning': return 'morning';
      case 'evening': return 'night_normal';
      case 'weekly':  return 'weekly';
    }
  }, []);

  // Tap "+ Add" → show choice sheet
  const openAdd = useCallback((section: SectionKey) => {
    // Convert SectionKey → slot for the sheet
    let slot: RoutineSlotParam;
    if (section === 'morning')        slot = 'morning';
    else if (section === 'weekly')    slot = 'weekly';
    else                              slot = 'evening';

    setAddSheetSlot(slot);
    setAddSheetVisible(true);
  }, []);

  // Sheet option: "Add Manually" → open text modal
  const handleAddManually = useCallback((slot: RoutineSlotParam) => {
    setAddModalSection(slotToSection(slot));
    setAddModalVisible(true);
  }, [slotToSection]);

  // Sheet option: "Scan Product" → navigate to ProductScanScreen
  const handleScanProduct = useCallback((slot: RoutineSlotParam) => {
    navigation.navigate('ProductScanScreen', { slot });
  }, [navigation]);

  const handleAddTask = useCallback(async (task: Task) => {
    await addCustomTask(task);
  }, [addCustomTask]);

  if (!loaded) return null;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar
        barStyle={mode === 'light' ? 'dark-content' : 'light-content'}
        backgroundColor={colors.background}
      />

      <View style={styles.container}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">

          {/* Header — Skincare Tracker Pro banner */}
          <HeaderCard />

          {/* AI face scan promo — just below the banner */}
          <AIFaceScanCard onPress={handleFaceScan} />

          {/* Streak */}
          <StreakStats
            currentStreak={currentStreak}
            bestStreak={bestStreak}
          />

          {/* Progress (daily steps only) */}
          <ProgressCard
            completed={completedCount}
            total={totalCount}
            onEditRoutine={handleEditRoutine}
          />

          {/* Morning routine — collapsible */}
          <RoutineSection
            title="Morning routine"
            emoji="☀"
            items={morningItems}
            onToggle={handleToggle}
            onAdd={() => openAdd('morning')}
          />

          {/* Evening routine — collapsible */}
          <RoutineSection
            title="Evening routine"
            emoji="🌙"
            items={eveningItems}
            onToggle={handleToggle}
            onAdd={() => openAdd('night_normal')}
          />

          {/* Weekly extras — collapsible, optional */}
          <WeeklyExtrasSection
            items={weeklyItems}
            onToggle={handleToggle}
            onAdd={() => openAdd('weekly')}
          />

          {/* Action buttons */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.btnMarkDone}
              activeOpacity={0.8}
              onPress={handleMarkAllDone}>
              <MaterialCommunityIcons name="check-circle" size={20} color={colors.white} />
              <Text style={styles.btnMarkDoneText}>Mark All Done</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.btnReset}
              activeOpacity={0.8}
              onPress={handleResetDay}>
              <MaterialCommunityIcons name="refresh" size={20} color={colors.primaryMid} />
              <Text style={styles.btnResetText}>Reset for Next Day</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </View>

      {/* Edit routine modal — reorder + delete */}
      <EditRoutineModal
        visible={editModalVisible}
        onClose={() => setEditModalVisible(false)}
      />

      {/* Add option sheet — choose between manual entry and product scan */}
      <AddOptionSheet
        visible={addSheetVisible}
        slot={addSheetSlot}
        onAddManually={handleAddManually}
        onScanProduct={handleScanProduct}
        onClose={() => setAddSheetVisible(false)}
      />

      {/* Add task modal — manual entry (opened via AddOptionSheet "Add Manually") */}
      <AddTaskModal
        visible={addModalVisible}
        initialSection={addModalSection}
        colors={colors}
        styles={styles}
        onClose={() => setAddModalVisible(false)}
        onAdd={handleAddTask}
      />
    </SafeAreaView>
  );
}
