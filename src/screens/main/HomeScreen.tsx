import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  Animated,
  AppState,
  type AppStateStatus,
  Easing,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Checkbox, ProgressBar } from 'react-native-paper';
import { Picker } from '@react-native-picker/picker';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DraggableFlatList, {
  ScaleDecorator,
  NestableScrollContainer,
  NestableDraggableFlatList,
} from 'react-native-draggable-flatlist';
import type { RenderItemParams } from 'react-native-draggable-flatlist';
import auth from '@react-native-firebase/auth';
import { format } from 'date-fns';
import Toast from 'react-native-toast-message';
// @ts-ignore
import BackgroundTimer from 'react-native-background-timer';

import { getTodaySections } from '../../constants/routineData';
import type { Task, Section } from '../../constants/routineData';
import { useRoutineStore } from '../../store/routineStore';

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────
function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

type SectionKey = 'morning' | 'night_normal' | 'night_retinol' | 'weekly';

const SECTION_LABELS: Record<SectionKey, string> = {
  morning: 'Morning Routine',
  night_normal: 'Night Routine (Normal)',
  night_retinol: 'Night Routine (Retinol)',
  weekly: 'Weekly Care',
};

// ═════════════════════════════════════════════════════════
// NORMAL MODE — TaskRow
// ═════════════════════════════════════════════════════════
interface TaskRowProps {
  task: Task;
  checked: boolean;
  onToggle: (id: string) => void;
}

function TaskRow({ task, checked, onToggle }: TaskRowProps) {
  const [open, setOpen] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  const toggleInstructions = () => {
    const next = !open;
    setOpen(next);
    Animated.timing(anim, {
      toValue: next ? 1 : 0,
      duration: 200,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: false,
    }).start();
  };

  const maxH = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 160] });

  return (
    <View style={styles.taskWrapper}>
      <View style={styles.taskRow}>
        <Checkbox
          status={checked ? 'checked' : 'unchecked'}
          onPress={() => onToggle(task.id)}
          color="#1D9E75"
        />
        <TouchableOpacity
          style={styles.taskContent}
          onPress={toggleInstructions}
          activeOpacity={0.7}>
          <Text style={[styles.taskName, checked && styles.taskNameDone]} numberOfLines={1}>
            {task.name}
          </Text>
          <Text style={styles.taskSubtitle} numberOfLines={1}>
            {task.subtitle}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={toggleInstructions}
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <MaterialCommunityIcons
            name={open ? 'chevron-up' : 'chevron-down'}
            size={18}
            color="#9CA3AF"
          />
        </TouchableOpacity>
      </View>
      <Animated.View style={[styles.instructionsWrap, { maxHeight: maxH }]}>
        <View style={styles.instructionsPanel}>
          <MaterialCommunityIcons
            name="information-outline"
            size={14}
            color="#1D9E75"
            style={styles.infoIcon}
          />
          <Text style={styles.instructionsText}>{task.instructions}</Text>
        </View>
      </Animated.View>
    </View>
  );
}

// ═════════════════════════════════════════════════════════
// NORMAL MODE — SectionCard
// ═════════════════════════════════════════════════════════
interface SectionCardProps {
  section: Section;
  checkedTasks: Record<string, boolean>;
  onToggleTask: (id: string) => void;
  defaultOpen: boolean;
}

function SectionCard({ section, checkedTasks, onToggleTask, defaultOpen }: SectionCardProps) {
  const [open, setOpen] = useState(defaultOpen);
  const anim = useRef(new Animated.Value(defaultOpen ? 1 : 0)).current;

  const toggle = () => {
    const next = !open;
    setOpen(next);
    Animated.timing(anim, {
      toValue: next ? 1 : 0,
      duration: 260,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: false,
    }).start();
  };

  const maxH = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 800] });
  const completed = section.tasks.filter(t => checkedTasks[t.id]).length;
  const isRetinol = section.id === 'night_retinol';

  return (
    <View style={styles.sectionCard}>
      <TouchableOpacity style={styles.sectionHeader} onPress={toggle} activeOpacity={0.8}>
        <View style={styles.sectionHeaderLeft}>
          <Text style={styles.sectionLabel}>{section.label}</Text>
          {isRetinol && (
            <View style={styles.retinolBadge}>
              <Text style={styles.retinolBadgeText}>Retinol Night</Text>
            </View>
          )}
        </View>
        <Text style={styles.sectionCount}>{completed} / {section.tasks.length}</Text>
        <MaterialCommunityIcons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={20}
          color="#6B7280"
          style={styles.sectionChevron}
        />
      </TouchableOpacity>
      <Animated.View style={{ maxHeight: maxH, overflow: 'hidden' }}>
        <View style={styles.taskList}>
          {section.tasks.map((task, idx) => (
            <React.Fragment key={task.id}>
              {idx > 0 && <View style={styles.taskDivider} />}
              <TaskRow
                task={task}
                checked={!!checkedTasks[task.id]}
                onToggle={onToggleTask}
              />
            </React.Fragment>
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

// ═════════════════════════════════════════════════════════
// EDIT MODE — SourceBadge
// ═════════════════════════════════════════════════════════
function SourceBadge({ source }: { source: Task['source'] }) {
  if (source === 'ordered') {
    return (
      <View style={[styles.sourceBadge, styles.sourceBadgeOrdered]}>
        <Text style={[styles.sourceBadgeText, styles.sourceBadgeOrderedText]}>Ordered</Text>
      </View>
    );
  }
  if (source === 'custom') {
    return (
      <View style={[styles.sourceBadge, styles.sourceBadgeCustom]}>
        <Text style={[styles.sourceBadgeText, styles.sourceBadgeCustomText]}>Custom</Text>
      </View>
    );
  }
  return null;
}

// ═════════════════════════════════════════════════════════
// EDIT MODE — EditableTaskRow
// ═════════════════════════════════════════════════════════
interface EditableTaskRowProps extends RenderItemParams<Task> {
  onDelete: (task: Task) => void;
}

function EditableTaskRow({ item, drag, isActive, onDelete }: EditableTaskRowProps) {
  return (
    <ScaleDecorator activeScale={1.03}>
      <View style={[styles.editTaskRow, isActive && styles.editTaskRowActive]}>
        {/* Drag handle */}
        <TouchableOpacity
          onLongPress={drag}
          delayLongPress={150}
          style={styles.dragHandle}>
          <MaterialCommunityIcons name="drag-horizontal-variant" size={22} color="#9CA3AF" />
        </TouchableOpacity>

        {/* Task info */}
        <View style={styles.editTaskContent}>
          <Text style={styles.editTaskName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.editTaskSubtitle} numberOfLines={1}>{item.subtitle}</Text>
        </View>

        {/* Source badge */}
        <SourceBadge source={item.source} />

        {/* Delete button */}
        <TouchableOpacity
          style={styles.deleteBtn}
          activeOpacity={0.7}
          onPress={() => onDelete(item)}>
          <MaterialCommunityIcons name="trash-can-outline" size={20} color="#DC2626" />
        </TouchableOpacity>
      </View>
    </ScaleDecorator>
  );
}

// ═════════════════════════════════════════════════════════
// EDIT MODE — EditSectionCard
// ═════════════════════════════════════════════════════════
interface EditSectionCardProps {
  section: Section;
  onAddStep: (sectionId: string) => void;
}

interface PendingDelete {
  task: Task;
  index: number;
  timerId: ReturnType<typeof setTimeout>;
}

function EditSectionCard({ section, onAddStep }: EditSectionCardProps) {
  const { sectionTasks, reorderTasks, deleteTask, undoDelete } = useRoutineStore();
  const tasks = sectionTasks[section.id] ?? section.tasks;

  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const undoAnim = useRef(new Animated.Value(0)).current;
  const isRetinol = section.id === 'night_retinol';

  const showUndoBanner = (pd: PendingDelete) => {
    setPendingDelete(pd);
    Animated.timing(undoAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const hideUndoBanner = () => {
    Animated.timing(undoAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => setPendingDelete(null));
  };

  const handleDelete = useCallback(
    async (task: Task) => {
      const confirmAndDelete = async () => {
        // Cancel any existing pending delete first
        if (pendingDelete) {
          clearTimeout(pendingDelete.timerId);
          hideUndoBanner();
        }

        const result = await deleteTask(section.id, task.id);
        if (!result) return;

        const timerId = setTimeout(() => {
          hideUndoBanner();
        }, 3000);

        showUndoBanner({ task: result.task, index: result.index, timerId });
      };

      if (task.source === 'ordered') {
        Alert.alert(
          'Remove from routine',
          'This product is from your order. Are you sure you want to remove it from your routine?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Remove', style: 'destructive', onPress: confirmAndDelete },
          ],
        );
      } else {
        await confirmAndDelete();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [section.id, deleteTask, pendingDelete],
  );

  const handleUndo = async () => {
    if (!pendingDelete) return;
    clearTimeout(pendingDelete.timerId);
    await undoDelete(section.id, pendingDelete.task, pendingDelete.index);
    hideUndoBanner();
  };

  const renderEditItem = useCallback(
    (params: RenderItemParams<Task>) => (
      <EditableTaskRow {...params} onDelete={handleDelete} />
    ),
    [handleDelete],
  );

  return (
    <View style={styles.sectionCard}>
      {/* Header */}
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeaderLeft}>
          <Text style={styles.sectionLabel}>{section.label}</Text>
          {isRetinol && (
            <View style={styles.retinolBadge}>
              <Text style={styles.retinolBadgeText}>Retinol Night</Text>
            </View>
          )}
        </View>
        <Text style={styles.sectionCount}>{tasks.length} tasks</Text>
      </View>

      {/* Draggable task list */}
      <NestableDraggableFlatList
        data={tasks}
        keyExtractor={item => item.id}
        renderItem={renderEditItem}
        onDragEnd={({ data }) => reorderTasks(section.id, data)}
        renderPlaceholder={() => <View style={styles.dragPlaceholder} />}
      />

      {/* Undo delete banner */}
      {pendingDelete && (
        <Animated.View style={[styles.undoBanner, { opacity: undoAnim }]}>
          <Text style={styles.undoText}>
            "{pendingDelete.task.name}" removed
          </Text>
          <TouchableOpacity onPress={handleUndo} style={styles.undoBtn}>
            <Text style={styles.undoBtnText}>Undo</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Add step button */}
      <TouchableOpacity
        style={styles.addStepBtn}
        activeOpacity={0.7}
        onPress={() => onAddStep(section.id)}>
        <MaterialCommunityIcons name="plus-circle-outline" size={18} color="#1D9E75" />
        <Text style={styles.addStepText}>Add step</Text>
      </TouchableOpacity>
    </View>
  );
}

// ═════════════════════════════════════════════════════════
// AddTaskModal
// ═════════════════════════════════════════════════════════
interface AddTaskModalProps {
  visible: boolean;
  initialSection: SectionKey;
  onClose: () => void;
  onAdd: (task: Task) => void;
}

function AddTaskModal({ visible, initialSection, onClose, onAdd }: AddTaskModalProps) {
  const [name, setName] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [section, setSection] = useState<SectionKey>(initialSection);
  const [nameError, setNameError] = useState('');

  useEffect(() => {
    if (visible) {
      setName('');
      setSubtitle('');
      setInstructions('');
      setSection(initialSection);
      setNameError('');
    }
  }, [visible, initialSection]);

  const handleAdd = () => {
    if (!name.trim()) {
      setNameError('Step name is required');
      return;
    }

    const isWeekly = section === 'weekly';
    const task: Task = {
      id: `custom_${Date.now()}`,
      name: name.trim(),
      subtitle: subtitle.trim(),
      instructions: instructions.trim(),
      section,
      isRequired: !isWeekly,
      isOptional: isWeekly,
      stepOrder: 99,
      source: 'custom',
    };

    onAdd(task);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        {/* Modal header */}
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} style={styles.modalCancelBtn}>
            <Text style={styles.modalCancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Add Step</Text>
          <TouchableOpacity onPress={handleAdd} style={styles.modalAddBtn}>
            <Text style={styles.modalAddText}>Add</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.modalScroll}
          contentContainerStyle={styles.modalContent}
          keyboardShouldPersistTaps="handled">

          {/* Step name */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Step name *</Text>
            <TextInput
              style={[styles.formInput, !!nameError && styles.formInputError]}
              placeholder="e.g. Vitamin C Serum"
              placeholderTextColor="#9CA3AF"
              value={name}
              onChangeText={t => { setName(t); if (nameError) setNameError(''); }}
              returnKeyType="next"
            />
            {!!nameError && <Text style={styles.formError}>{nameError}</Text>}
          </View>

          {/* Subtitle */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Subtitle <Text style={styles.formOptional}>(optional)</Text></Text>
            <TextInput
              style={styles.formInput}
              placeholder="e.g. Brightening booster"
              placeholderTextColor="#9CA3AF"
              value={subtitle}
              onChangeText={setSubtitle}
              returnKeyType="next"
            />
          </View>

          {/* Instructions */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Instructions <Text style={styles.formOptional}>(optional)</Text></Text>
            <TextInput
              style={[styles.formInput, styles.formTextArea]}
              placeholder="How to apply this step…"
              placeholderTextColor="#9CA3AF"
              value={instructions}
              onChangeText={setInstructions}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Section picker */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Add to section</Text>
            <View style={styles.pickerWrapper}>
              <Picker
                selectedValue={section}
                onValueChange={v => setSection(v as SectionKey)}
                style={styles.picker}>
                <Picker.Item label="Morning Routine" value="morning" />
                <Picker.Item label="Night Routine (Normal)" value="night_normal" />
                <Picker.Item label="Night Routine (Retinol)" value="night_retinol" />
                <Picker.Item label="Weekly Care" value="weekly" />
              </Picker>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ═════════════════════════════════════════════════════════
// HomeScreen
// ═════════════════════════════════════════════════════════
export function HomeScreen() {
  const insets = useSafeAreaInsets();
  const user = auth().currentUser;
  const firstName = user?.displayName?.split(' ')[0] ?? 'there';
  const today = format(new Date(), 'dd MMM yyyy');

  const {
    checkedTasks, currentStreak, bestStreak, loaded, isEditMode, sectionTasks,
    loadToday, toggleTask, markAllDone, resetDay,
    checkAndUpdateStreak, checkDateChange, handleForeground,
    restoreDefaults,
    addCustomTask,
  } = useRoutineStore();

  // Today's sections (which sections to show based on day)
  const todayBaseSections = useMemo(() => getTodaySections(), []);

  // Merge store task order into today's sections
  const displaySections = useMemo(
    () =>
      todayBaseSections.map(s => ({
        ...s,
        tasks: sectionTasks[s.id] ?? s.tasks,
      })),
    [todayBaseSections, sectionTasks],
  );

  const requiredTasks = useMemo(
    () =>
      displaySections
        .filter(s => s.id !== 'weekly')
        .flatMap(s => s.tasks)
        .filter(t => t.isRequired),
    [displaySections],
  );
  const allTaskIds = useMemo(
    () => displaySections.flatMap(s => s.tasks).map(t => t.id),
    [displaySections],
  );
  const requiredTaskIds = useMemo(() => requiredTasks.map(t => t.id), [requiredTasks]);

  const completedRequired = requiredTasks.filter(t => checkedTasks[t.id]).length;
  const progress = requiredTasks.length > 0 ? completedRequired / requiredTasks.length : 0;

  // Modal state
  const [addModalSection, setAddModalSection] = useState<SectionKey | null>(null);

  // Initial load
  useEffect(() => { loadToday(); }, [loadToday]);

  // AppState — foreground re-entry
  useEffect(() => {
    const onStateChange = async (next: AppStateStatus) => {
      if (next !== 'active') return;
      const isNewDay = await checkDateChange();
      if (isNewDay) {
        Toast.show({
          type: 'info',
          text1: 'New day, new routine!',
          text2: 'Your daily tasks have been reset.',
          visibilityTime: 4000,
        });
      }
      const uid = auth().currentUser?.uid;
      if (uid) await handleForeground(uid, requiredTaskIds);
    };
    const sub = AppState.addEventListener('change', onStateChange);
    return () => sub.remove();
  }, [checkDateChange, handleForeground, requiredTaskIds]);

  // Midnight timer
  useEffect(() => {
    const now = new Date();
    const nextMidnight = new Date(now);
    nextMidnight.setHours(24, 0, 0, 0);
    const ms = nextMidnight.getTime() - now.getTime();

    const timerId: number = BackgroundTimer.setTimeout(async () => {
      const isNewDay = await checkDateChange();
      if (isNewDay) {
        Toast.show({
          type: 'info',
          text1: 'New day, new routine!',
          text2: 'Start your skincare routine fresh today.',
          visibilityTime: 5000,
        });
      }
    }, ms);

    return () => BackgroundTimer.clearTimeout(timerId);
  }, [checkDateChange]);

  const handleToggle = useCallback(
    async (taskId: string) => {
      await toggleTask(taskId);
      setTimeout(() => checkAndUpdateStreak(requiredTaskIds), 0);
    },
    [toggleTask, checkAndUpdateStreak, requiredTaskIds],
  );

  const handleMarkAllDone = useCallback(async () => {
    await markAllDone(allTaskIds);
    setTimeout(() => checkAndUpdateStreak(requiredTaskIds), 0);
  }, [markAllDone, allTaskIds, checkAndUpdateStreak, requiredTaskIds]);

  const handleResetDay = useCallback(() => {
    Alert.alert('Reset day', 'This will uncheck all tasks for today. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: () => resetDay() },
    ]);
  }, [resetDay]);

  const handleRestoreDefaults = useCallback(() => {
    Alert.alert(
      'Restore default routine',
      'This will remove all custom and ordered steps, and restore the original task order. Your orders in My Products are not affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Restore', style: 'destructive', onPress: () => restoreDefaults() },
      ],
    );
  }, [restoreDefaults]);

  const handleAddTask = useCallback(
    async (task: Task) => { await addCustomTask(task); },
    [addCustomTask],
  );

  if (!loaded) return null;

  const bottomPad = Math.max(insets.bottom, 16);

  // ── EDIT MODE ───────────────────────────────────────────
  if (isEditMode) {
    return (
      <View style={styles.root}>
        <NestableScrollContainer
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: 32 + bottomPad },
          ]}>
          {displaySections.map(section => (
            <EditSectionCard
              key={section.id}
              section={section}
              onAddStep={id => setAddModalSection(id as SectionKey)}
            />
          ))}

          {/* Restore defaults */}
          <TouchableOpacity
            style={styles.restoreBtn}
            activeOpacity={0.7}
            onPress={handleRestoreDefaults}>
            <Text style={styles.restoreBtnText}>Restore default routine</Text>
          </TouchableOpacity>
        </NestableScrollContainer>

        <AddTaskModal
          visible={addModalSection !== null}
          initialSection={addModalSection ?? 'morning'}
          onClose={() => setAddModalSection(null)}
          onAdd={handleAddTask}
        />
      </View>
    );
  }

  // ── NORMAL MODE ─────────────────────────────────────────
  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 80 + bottomPad },
        ]}
        showsVerticalScrollIndicator={false}>

        {/* Greeting card */}
        <View style={styles.greetingCard}>
          <Text style={styles.greetingText}>{getGreeting()}, {firstName}</Text>
          <Text style={styles.dateText}>{today}</Text>
        </View>

        {/* Progress card */}
        <View style={styles.card}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>Daily progress</Text>
            <Text style={styles.progressCount}>
              {completedRequired} / {requiredTasks.length} steps completed
            </Text>
          </View>
          <ProgressBar
            progress={progress}
            color="#1D9E75"
            style={styles.progressBar}
          />
        </View>

        {/* Streak row */}
        <View style={[styles.card, styles.streakCard]}>
          <Text style={styles.flameEmoji}>🔥</Text>
          <Text style={styles.streakNumber}>{currentStreak}</Text>
          <View style={styles.streakLabels}>
            <Text style={styles.streakMainLabel}>Current streak</Text>
            <Text style={styles.streakSubLabel}>days</Text>
          </View>
          <View style={styles.streakDivider} />
          <View style={styles.streakBestBlock}>
            <Text style={styles.streakBestValue}>{bestStreak}</Text>
            <Text style={styles.streakBestLabel}>Best</Text>
          </View>
        </View>

        {/* Section cards */}
        {displaySections.map((section, idx) => (
          <SectionCard
            key={section.id}
            section={section}
            checkedTasks={checkedTasks}
            onToggleTask={handleToggle}
            defaultOpen={idx === 0}
          />
        ))}
      </ScrollView>

      {/* Fixed bottom bar */}
      <View style={[styles.bottomBar, { paddingBottom: bottomPad }]}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnTeal]}
          activeOpacity={0.8}
          onPress={handleMarkAllDone}>
          <MaterialCommunityIcons name="check-all" size={18} color="#1D9E75" />
          <Text style={[styles.actionBtnText, styles.actionBtnTextTeal]}>Mark all done</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnGrey]}
          activeOpacity={0.8}
          onPress={handleResetDay}>
          <MaterialCommunityIcons name="refresh" size={18} color="#6B7280" />
          <Text style={[styles.actionBtnText, styles.actionBtnTextGrey]}>Reset day</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F7F9FC' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 12 },

  // Greeting
  greetingCard: {
    backgroundColor: '#1D9E75',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  greetingText: { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 4 },
  dateText: { fontSize: 14, color: 'rgba(255,255,255,0.8)' },

  // Generic card
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },

  // Progress
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  progressLabel: { fontSize: 14, fontWeight: '600', color: '#111' },
  progressCount: { fontSize: 13, color: '#6B7280' },
  progressBar: { height: 8, borderRadius: 4, backgroundColor: '#E5E7EB' },

  // Streak
  streakCard: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flameEmoji: { fontSize: 36 },
  streakNumber: { fontSize: 34, fontWeight: '800', color: '#111' },
  streakLabels: { flex: 1 },
  streakMainLabel: { fontSize: 13, fontWeight: '600', color: '#374151' },
  streakSubLabel: { fontSize: 12, color: '#9CA3AF' },
  streakDivider: { width: 1, height: 36, backgroundColor: '#E5E7EB', marginHorizontal: 4 },
  streakBestBlock: { alignItems: 'center', minWidth: 48 },
  streakBestValue: { fontSize: 20, fontWeight: '700', color: '#111' },
  streakBestLabel: { fontSize: 11, color: '#9CA3AF', marginTop: 1 },

  // Section card
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  sectionHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  sectionLabel: { fontSize: 15, fontWeight: '700', color: '#111' },
  retinolBadge: {
    backgroundColor: '#FEF3C7',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  retinolBadgeText: { fontSize: 11, fontWeight: '600', color: '#92400E' },
  sectionCount: { fontSize: 13, color: '#6B7280', marginRight: 6 },
  sectionChevron: { marginLeft: 2 },

  // Normal task list
  taskList: { borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  taskDivider: { height: 1, backgroundColor: '#F3F4F6', marginLeft: 56 },
  taskWrapper: { overflow: 'hidden' },
  taskRow: { flexDirection: 'row', alignItems: 'center', paddingRight: 14, minHeight: 56 },
  taskContent: { flex: 1, paddingRight: 8 },
  taskName: { fontSize: 14, fontWeight: '600', color: '#111', marginBottom: 1 },
  taskNameDone: { color: '#9CA3AF', textDecorationLine: 'line-through' },
  taskSubtitle: { fontSize: 12, color: '#9CA3AF' },
  instructionsWrap: { overflow: 'hidden' },
  instructionsPanel: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F0FBF6',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#D1FAE5',
  },
  infoIcon: { marginTop: 1 },
  instructionsText: { flex: 1, fontSize: 13, color: '#1D6B4E', lineHeight: 19 },

  // Edit mode task row
  editTaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingRight: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 8,
  },
  editTaskRowActive: {
    backgroundColor: '#F0FBF6',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 6,
  },
  dragHandle: { paddingHorizontal: 10, paddingVertical: 4 },
  editTaskContent: { flex: 1 },
  editTaskName: { fontSize: 14, fontWeight: '600', color: '#111', marginBottom: 1 },
  editTaskSubtitle: { fontSize: 12, color: '#9CA3AF' },
  deleteBtn: { padding: 6 },

  // Source badge
  sourceBadge: { borderRadius: 5, paddingHorizontal: 7, paddingVertical: 2 },
  sourceBadgeText: { fontSize: 10, fontWeight: '600' },
  sourceBadgeOrdered: { backgroundColor: '#FEF3C7' },
  sourceBadgeOrderedText: { color: '#92400E' },
  sourceBadgeCustom: { backgroundColor: '#EFF6FF' },
  sourceBadgeCustomText: { color: '#1D4ED8' },

  // Drag placeholder
  dragPlaceholder: {
    height: 56,
    backgroundColor: '#E1F5EE',
    borderRadius: 8,
    marginHorizontal: 12,
    marginVertical: 4,
  },

  // Undo banner
  undoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1F2937',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  undoText: { fontSize: 13, color: '#F9FAFB', flex: 1 },
  undoBtn: { paddingHorizontal: 12, paddingVertical: 4 },
  undoBtnText: { fontSize: 13, fontWeight: '700', color: '#34D399' },

  // Add step button
  addStepBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  addStepText: { fontSize: 14, fontWeight: '600', color: '#1D9E75' },

  // Restore defaults
  restoreBtn: { alignItems: 'center', paddingVertical: 16, marginTop: 4 },
  restoreBtnText: { fontSize: 14, color: '#6B7280', textDecorationLine: 'underline' },

  // Bottom bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  actionBtnTeal: { borderColor: '#1D9E75', backgroundColor: '#F0FBF6' },
  actionBtnGrey: { borderColor: '#D1D5DB', backgroundColor: '#F9FAFB' },
  actionBtnText: { fontSize: 14, fontWeight: '600' },
  actionBtnTextTeal: { color: '#1D9E75' },
  actionBtnTextGrey: { color: '#6B7280' },

  // Modal
  modalRoot: { flex: 1, backgroundColor: '#F7F9FC' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: { fontSize: 17, fontWeight: '600', color: '#111' },
  modalCancelBtn: { paddingHorizontal: 4 },
  modalCancelText: { fontSize: 15, color: '#6B7280' },
  modalAddBtn: { paddingHorizontal: 4 },
  modalAddText: { fontSize: 15, fontWeight: '700', color: '#1D9E75' },
  modalScroll: { flex: 1 },
  modalContent: { padding: 20, gap: 20, paddingBottom: 60 },
  formGroup: { gap: 6 },
  formLabel: { fontSize: 13, fontWeight: '600', color: '#374151' },
  formOptional: { fontWeight: '400', color: '#9CA3AF' },
  formInput: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111',
    backgroundColor: '#fff',
  },
  formInputError: { borderColor: '#EF4444' },
  formTextArea: { minHeight: 90, paddingTop: 10 },
  formError: { fontSize: 12, color: '#EF4444', marginTop: 2 },
  pickerWrapper: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  picker: { height: 50, color: '#111' },
});
