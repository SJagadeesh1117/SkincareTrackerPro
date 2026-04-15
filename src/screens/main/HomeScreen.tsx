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
import { Picker } from '@react-native-picker/picker';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ScaleDecorator,
  NestableScrollContainer,
  NestableDraggableFlatList,
} from 'react-native-draggable-flatlist';
import type { RenderItemParams } from 'react-native-draggable-flatlist';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { format } from 'date-fns';
import Toast from 'react-native-toast-message';
// @ts-ignore
import BackgroundTimer from 'react-native-background-timer';

import { AppHeader } from '../../components/AppHeader';
import { getTodaySections } from '../../constants/routineData';
import type { Task, Section } from '../../constants/routineData';
import { COLORS } from '../../constants/theme';
import {
  DEFAULT_ROUTINE_TASKS,
  getRoutineSlotLabel,
  loadRoutineConfigFromFirestore,
  mapSlotToSections,
} from '../../services/routineActivationService';
import { useRoutineStore } from '../../store/routineStore';
import { useSkinProfileStore } from '../../store/skinProfileStore';
import { fetchLatestProfile } from '../../services/skinProfileService';
import type {
  HomeActivationPayload,
  MainTabParamList,
  TrackedProduct,
} from '../../types';
import {
  useFocusEffect,
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────
function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

type SectionKey = 'morning' | 'night_normal' | 'weekly';

// ═════════════════════════════════════════════════════════
// NORMAL MODE — TaskRow
// ═════════════════════════════════════════════════════════
interface TaskRowProps {
  task: Task;
  checked: boolean;
  onToggle: (id: string) => void;
  highlightAnim: Animated.Value;
  isHighlighted: boolean;
}

function TaskRow({
  task,
  checked,
  onToggle,
  highlightAnim,
  isHighlighted,
}: TaskRowProps) {
  const isLockedPending = task.source === 'tracked' && task.isActive === false;
  const [open, setOpen] = useState(false);
  const expandAnim = useRef(new Animated.Value(0)).current;
  const checkScale = useRef(new Animated.Value(1)).current;
  const rowBackgroundColor = isHighlighted
    ? highlightAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [COLORS.card, COLORS.primary100],
      })
    : COLORS.card;

  const handleCheckPress = () => {
    if (isLockedPending) return;
    Animated.sequence([
      Animated.spring(checkScale, { toValue: 0.85, useNativeDriver: true, speed: 30, bounciness: 0 }),
      Animated.spring(checkScale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 4 }),
    ]).start();
    onToggle(task.id);
  };

  const toggleInstructions = () => {
    if (isLockedPending) return;
    const next = !open;
    setOpen(next);
    Animated.timing(expandAnim, {
      toValue: next ? 1 : 0,
      duration: 250,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
  };

  const maxH = expandAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 160] });

  return (
    <View style={[styles.taskWrapper, isLockedPending && { opacity: 0.6 }]}>
      <Animated.View
        style={[styles.taskRow, { backgroundColor: rowBackgroundColor }]}>
        {/* Checkbox */}
        <TouchableOpacity
          style={styles.checkboxWrap}
          onPress={handleCheckPress}
          disabled={isLockedPending}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
          <Animated.View
            style={[
              styles.checkbox,
              checked && styles.checkboxDone,
              isLockedPending && styles.checkboxLocked,
              { transform: [{ scale: checkScale }] },
            ]}>
            {checked && (
              <MaterialCommunityIcons name="check" size={14} color="#FFFFFF" />
            )}
            {isLockedPending && !checked && (
              <MaterialCommunityIcons name="lock-outline" size={12} color="#A78BFA" />
            )}
          </Animated.View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.taskContent}
          onPress={toggleInstructions}
          activeOpacity={isLockedPending ? 1 : 0.7}
          disabled={isLockedPending}>
          <Text
            style={[
              styles.taskName,
              checked && styles.taskNameDone,
              isLockedPending && styles.taskNameLocked,
            ]}
            numberOfLines={1}>
            {task.name}
          </Text>
          <Text style={styles.taskSubtitle} numberOfLines={1}>
            {isLockedPending && task.trackedStatus === 'ordered'
              ? 'Ordered — will activate when delivered'
              : isLockedPending && task.trackedStatus === 'delivered'
                ? 'Delivered — go to My Products to activate'
                : task.subtitle}
          </Text>
        </TouchableOpacity>

        {!isLockedPending && (
          <TouchableOpacity
            onPress={toggleInstructions}
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <MaterialCommunityIcons
              name={open ? 'chevron-up' : 'chevron-down'}
              size={18}
              color="#9CA3AF"
            />
          </TouchableOpacity>
        )}
      </Animated.View>
      <Animated.View style={[styles.instructionsWrap, { maxHeight: maxH }]}>
        <View style={styles.instructionsPanel}>
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
  highlightAnim: Animated.Value;
  highlightTaskPrefix: string | null;
}

function SectionCard({
  section,
  checkedTasks,
  onToggleTask,
  defaultOpen,
  highlightAnim,
  highlightTaskPrefix,
}: SectionCardProps) {
  const [open, setOpen] = useState(defaultOpen);
  const expandAnim = useRef(new Animated.Value(defaultOpen ? 1 : 0)).current;
  const chevronAnim = useRef(new Animated.Value(defaultOpen ? 1 : 0)).current;

  const toggle = () => {
    const next = !open;
    setOpen(next);
    const toVal = next ? 1 : 0;
    Animated.timing(expandAnim, {
      toValue: toVal,
      duration: 260,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: false,
    }).start();
    Animated.timing(chevronAnim, {
      toValue: toVal,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const maxH = expandAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 800] });
  const chevronRotate = chevronAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const completed = section.tasks.filter(t => checkedTasks[t.id]).length;
  const isRetinol = false;

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
        <View style={styles.countPill}>
          <Text style={styles.countPillText}>{completed}/{section.tasks.length}</Text>
        </View>
        <Animated.View style={{ transform: [{ rotate: chevronRotate }], marginLeft: 8 }}>
          <MaterialCommunityIcons name="chevron-down" size={20} color="#9B7FD4" />
        </Animated.View>
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
                highlightAnim={highlightAnim}
                isHighlighted={
                  !!highlightTaskPrefix && task.id.startsWith(highlightTaskPrefix)
                }
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
  const isRetinol = false;

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
        <MaterialCommunityIcons name="plus-circle-outline" size={18} color="#8B5CF6" />
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
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<MainTabParamList, 'HomeTab'>>();
  const user = auth().currentUser;
  const firstName = user?.displayName?.split(' ')[0] ?? 'there';
  const today = format(new Date(), 'dd MMM yyyy');

  // ── Skin profile (persistent across sessions) ───────────
  const skinProfile = useSkinProfileStore(s => s.skinProfile);
  const recommendations = useSkinProfileStore(s => s.recommendations);
  const profileLoaded = useSkinProfileStore(s => s.profileLoaded);

  // Skeleton pulse animation
  const pulseAnim = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    if (profileLoaded) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.5, duration: 600, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [profileLoaded, pulseAnim]);

  useEffect(() => {
    const uid = auth().currentUser?.uid;
    if (!uid || profileLoaded) return;
    fetchLatestProfile(uid);
  }, [profileLoaded]);

  const {
    checkedTasks, currentStreak, bestStreak, loaded, isEditMode, sectionTasks,
    loadToday, toggleTask, markAllDone, resetDay,
    checkAndUpdateStreak, checkDateChange, handleForeground,
    restoreDefaults,
    addCustomTask,
    setRoutineConfig,
  } = useRoutineStore();
  const [pendingTrackedTasks, setPendingTrackedTasks] = useState<
    Record<SectionKey, Task[]>
  >({
    morning: [],
    night_normal: [],
    weekly: [],
  });

  // Today's sections (which sections to show based on day)
  const todayBaseSections = useMemo(() => getTodaySections(), []);

  // Merge store task order into today's sections
  const displaySections = useMemo(
    () =>
      todayBaseSections.map(s => ({
        ...s,
        tasks: [
          ...(sectionTasks[s.id] ?? s.tasks),
          ...(pendingTrackedTasks[s.id as SectionKey] ?? []),
        ],
      })),
    [todayBaseSections, sectionTasks, pendingTrackedTasks],
  );

  const requiredTasks = useMemo(
    () =>
      displaySections
        .filter(s => s.id !== 'weekly')
        .flatMap(s => s.tasks)
        .filter(t => t.isRequired && !(t.source === 'tracked' && t.isActive === false)),
    [displaySections],
  );
  const allTaskIds = useMemo(
    () =>
      displaySections
        .flatMap(s => s.tasks)
        .filter(t => !(t.source === 'tracked' && t.isActive === false))
        .map(t => t.id),
    [displaySections],
  );
  const requiredTaskIds = useMemo(() => requiredTasks.map(t => t.id), [requiredTasks]);

  const completedRequired = requiredTasks.filter(t => checkedTasks[t.id]).length;
  const progress = requiredTasks.length > 0 ? completedRequired / requiredTasks.length : 0;
  const allDone = allTaskIds.length > 0 && allTaskIds.every(id => checkedTasks[id]);
  const highlightAnim = useRef(new Animated.Value(0)).current;
  const [highlightTaskPrefix, setHighlightTaskPrefix] = useState<string | null>(null);
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Modal state
  const [addModalSection, setAddModalSection] = useState<SectionKey | null>(null);

  // Initial load
  useEffect(() => { loadToday(); }, [loadToday]);

  // Animate progress bar on change
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 600,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [progress, progressAnim]);

  const loadRoutineConfig = useCallback(async () => {
    const uid = auth().currentUser?.uid;

    if (!uid) {
      await setRoutineConfig(DEFAULT_ROUTINE_TASKS);
      return;
    }

    try {
      const merged = await loadRoutineConfigFromFirestore();
      await setRoutineConfig(merged);
    } catch {
      await setRoutineConfig(DEFAULT_ROUTINE_TASKS);
    }
  }, [setRoutineConfig]);

  const loadPendingProducts = useCallback(async () => {
    const uid = auth().currentUser?.uid;
    if (!uid) {
      setPendingTrackedTasks({
        morning: [],
        night_normal: [],
        weekly: [],
      });
      return;
    }

    try {
      const snapshot = await firestore()
        .collection('trackedProducts')
        .doc(uid)
        .collection('items')
        .where('isActive', '==', false)
        .where('status', 'in', ['ordered', 'delivered'])
        .get();

      const sectionedTasks: Record<SectionKey, Task[]> = {
        morning: [],
        night_normal: [],
        weekly: [],
      };

      snapshot.docs.forEach(doc => {
        const product = doc.data() as TrackedProduct;
        const subtitle =
          product.status === 'ordered'
            ? 'Ordered — will activate when delivered'
            : 'Delivered — go to My Products to activate';

        const sections = mapSlotToSections(product.routineSlot);

        sections.forEach(section => {
          sectionedTasks[section].push({
            id: `pending_${product.id}_${section}`,
            name: product.name,
            subtitle,
            instructions: '',
            section,
            isRequired: false,
            isOptional: true,
            stepOrder: product.stepOrder,
            source: 'tracked',
            isActive: false,
            trackedStatus: product.status === 'delivered' ? 'delivered' : 'ordered',
          });
        });
      });

      (Object.keys(sectionedTasks) as SectionKey[]).forEach(section => {
        sectionedTasks[section].sort((a, b) => a.stepOrder - b.stepOrder);
      });

      setPendingTrackedTasks(sectionedTasks);
    } catch {
      setPendingTrackedTasks({
        morning: [],
        night_normal: [],
        weekly: [],
      });
    }
  }, []);

  const reloadRoutineData = useCallback(async () => {
    await loadRoutineConfig();
    await loadPendingProducts();
  }, [loadPendingProducts, loadRoutineConfig]);

  const triggerHighlight = useCallback(
    (productId: string) => {
      const prefix = `tracked_${productId}`;
      setHighlightTaskPrefix(prefix);
      highlightAnim.stopAnimation();
      highlightAnim.setValue(0);
      Animated.sequence([
        Animated.timing(highlightAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: false,
        }),
        Animated.delay(1500),
        Animated.timing(highlightAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: false,
        }),
      ]).start(() => setHighlightTaskPrefix(null));
    },
    [highlightAnim],
  );

  const handleActivatedProduct = useCallback(
    (payload: HomeActivationPayload) => {
      Toast.show({
        type: 'success',
        text1: 'Routine updated',
        text2: `${payload.productName} is now in your ${getRoutineSlotLabel(
          payload.routineSlot,
        ).toLowerCase()}`,
        visibilityTime: 4000,
      });
      triggerHighlight(payload.productId);
      navigation.setParams({ activatedProduct: undefined });
    },
    [navigation, triggerHighlight],
  );

  useEffect(() => {
    reloadRoutineData();
  }, [reloadRoutineData]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      const syncOnFocus = async () => {
        await reloadRoutineData();

        if (!cancelled && route.params?.activatedProduct) {
          handleActivatedProduct(route.params.activatedProduct);
        }
      };

      syncOnFocus();

      return () => {
        cancelled = true;
      };
    }, [handleActivatedProduct, reloadRoutineData, route.params?.activatedProduct]),
  );

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
      await reloadRoutineData();
    };
    const sub = AppState.addEventListener('change', onStateChange);
    return () => sub.remove();
  }, [checkDateChange, handleForeground, reloadRoutineData, requiredTaskIds]);

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
        <AppHeader title="Edit Routine" showEditButton />
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
      {/* ── Custom home header ─── */}
      <AppHeader
        title=""
        greetingText={`${getGreeting()}, ${firstName}`}
        greetingDate={today}
        showEditButton
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 80 + bottomPad },
        ]}
        showsVerticalScrollIndicator={false}>

        {/* Skin profile card / skeleton */}
        {!profileLoaded ? (
          <Animated.View style={[styles.profileSkeleton, { opacity: pulseAnim }]} />
        ) : skinProfile && recommendations && recommendations.length > 0 ? (
          <TouchableOpacity
            style={styles.profileCard}
            activeOpacity={0.85}
            onPress={() =>
              navigation.navigate('RecommendationsScreen', {
                products: recommendations,
                skinType: skinProfile.skinType,
                scanId: skinProfile.scanId,
              })
            }>
            <View style={styles.profileCardBody}>
              <MaterialCommunityIcons
                name="face-recognition"
                size={22}
                color="#A78BFA"
                style={styles.profileCardIcon}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.profileCardTitle}>Your skin analysis</Text>
                <Text style={styles.profileCardSub}>
                  {skinProfile.skinType.charAt(0).toUpperCase() +
                    skinProfile.skinType.slice(1)}{' '}
                  skin
                  {skinProfile.concerns.length > 0
                    ? ` · ${skinProfile.concerns.length} concern${skinProfile.concerns.length > 1 ? 's' : ''}`
                    : ''}
                </Text>
              </View>
              <Text style={styles.profileCardCta}>View →</Text>
            </View>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.faceScanPromptCard}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('MainTabs', { screen: 'ScanTab' })}>
            <MaterialCommunityIcons name="face-recognition" size={28} color="#A78BFA" />
            <View style={{ flex: 1 }}>
              <Text style={styles.profileCardTitle}>Start with a face scan</Text>
              <Text style={styles.profileCardSub}>
                Get personalised product recommendations for your skin type
              </Text>
            </View>
            <Text style={styles.profileCardCta}>Scan →</Text>
          </TouchableOpacity>
        )}

        {/* ── Progress card ── */}
        <View style={styles.progressCard}>
          <Text style={styles.progressLabel}>Today's progress</Text>
          {/* Animated bar */}
          <View style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                    extrapolate: 'clamp',
                  }),
                },
              ]}
            />
          </View>
          <View style={styles.progressMeta}>
            <Text style={styles.progressMetaLeft}>
              {completedRequired} of {requiredTasks.length} steps done
            </Text>
            <Text style={styles.progressMetaRight}>
              {Math.round(progress * 100)}%
            </Text>
          </View>
        </View>

        {/* ── Streak cards ── */}
        <View style={styles.streakRow}>
          <View style={[styles.streakCard, styles.card]}>
            <Text style={styles.streakNumber}>{currentStreak}</Text>
            <View style={styles.streakIconRow}>
              <MaterialCommunityIcons name="fire" size={13} color="#F59E0B" />
              <Text style={styles.streakDays}> days</Text>
            </View>
            <Text style={styles.streakCardLabel}>Current streak</Text>
          </View>
          <View style={[styles.streakCard, styles.card]}>
            <Text style={[styles.streakNumber, { color: '#A78BFA' }]}>{bestStreak}</Text>
            <View style={styles.streakIconRow}>
              <MaterialCommunityIcons name="trophy-outline" size={13} color="#A78BFA" />
              <Text style={[styles.streakDays, { color: '#A78BFA' }]}> days</Text>
            </View>
            <Text style={styles.streakCardLabel}>Best streak</Text>
          </View>
        </View>

        {/* ── Section cards or all-done state ── */}
        {allDone ? (
          <View style={styles.allDoneWrap}>
            <View style={styles.allDoneCircle}>
              <MaterialCommunityIcons name="check-circle" size={48} color="#FFFFFF" />
            </View>
            <Text style={styles.allDoneTitle}>All done for today!</Text>
            <Text style={styles.allDoneSub}>Great work. See you tomorrow.</Text>
          </View>
        ) : (
          displaySections.map((section, idx) => (
            <SectionCard
              key={section.id}
              section={section}
              checkedTasks={checkedTasks}
              onToggleTask={handleToggle}
              defaultOpen={idx === 0}
              highlightAnim={highlightAnim}
              highlightTaskPrefix={highlightTaskPrefix}
            />
          ))
        )}
      </ScrollView>

      {/* ── Fixed bottom bar ── */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 8 }]}>
        <TouchableOpacity
          style={styles.markAllBtn}
          activeOpacity={0.85}
          onPress={handleMarkAllDone}>
          <Text style={styles.markAllBtnText}>Mark all done</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.resetBtn}
          activeOpacity={0.85}
          onPress={handleResetDay}>
          <Text style={styles.resetBtnText}>Reset day</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0F0A1A' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 12 },

  // Generic card
  card: {
    backgroundColor: '#211640',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#3B2A65',
    elevation: 2,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },

  // Skin profile cards
  profileSkeleton: {
    height: 64,
    backgroundColor: '#2D1B6B',
    borderRadius: 14,
  },
  profileCard: {
    backgroundColor: '#211640',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#3B2A65',
  },
  faceScanPromptCard: {
    backgroundColor: '#211640',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1.5,
    borderColor: '#5B3FAF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  profileCardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  profileCardIcon: { marginRight: 2 },
  profileCardTitle: { fontSize: 13, fontWeight: '700', color: '#C4B5FD', marginBottom: 2 },
  profileCardSub: { fontSize: 12, color: '#9B7FD4' },
  profileCardCta: { fontSize: 13, fontWeight: '700', color: '#A78BFA' },

  // Progress card
  progressCard: {
    backgroundColor: '#8B5CF6',
    borderRadius: 16,
    padding: 16,
    marginBottom: 0,
  },
  progressLabel: {
    fontSize: 11,
    color: '#DDD6FE',
    letterSpacing: 0.5,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  progressMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  progressMetaLeft: { fontSize: 12, color: '#EDE9FE' },
  progressMetaRight: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },

  // Streak
  streakRow: { flexDirection: 'row', gap: 10 },
  streakCard: { flex: 1, alignItems: 'flex-start' },
  streakNumber: { fontSize: 30, fontWeight: '700', color: '#FFFFFF' },
  streakIconRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  streakDays: { fontSize: 12, color: '#9B7FD4' },
  streakCardLabel: { fontSize: 11, color: '#9B7FD4', marginTop: 4 },

  // Section card
  sectionCard: {
    backgroundColor: '#211640',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#3B2A65',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    minHeight: 52,
  },
  sectionHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  sectionLabel: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  retinolBadge: {
    backgroundColor: '#7C3AED',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  retinolBadgeText: { fontSize: 9, fontWeight: '600', color: '#FFFFFF' },
  countPill: {
    backgroundColor: '#EDE9FE',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  countPillText: { fontSize: 11, fontWeight: '600', color: '#6D28D9' },

  // Normal task list
  taskList: { borderTopWidth: 1, borderTopColor: '#3B2A65' },
  taskDivider: { height: 1, backgroundColor: '#3B2A65', marginLeft: 56 },
  taskWrapper: { overflow: 'hidden' },
  taskRow: { flexDirection: 'row', alignItems: 'center', paddingRight: 14, minHeight: 48 },

  // Custom checkbox
  checkboxWrap: {
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#C4B5FD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: {
    backgroundColor: '#8B5CF6',
    borderColor: '#8B5CF6',
  },
  checkboxLocked: {
    borderColor: '#DDD6FE',
    backgroundColor: '#2D1B6B',
  },

  taskContent: { flex: 1, paddingRight: 8 },
  taskName: { fontSize: 13, fontWeight: '500', color: '#FFFFFF', marginBottom: 1 },
  taskNameDone: { color: '#5B3FAF', textDecorationLine: 'line-through' },
  taskNameLocked: { color: '#7C5AE0' },
  taskSubtitle: { fontSize: 11, color: '#9B7FD4', marginTop: 2 },

  instructionsWrap: { overflow: 'hidden' },
  instructionsPanel: {
    backgroundColor: '#1C103A',
    marginHorizontal: 0,
    marginBottom: 4,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#8B5CF6',
  },
  instructionsText: { fontSize: 12, color: '#C4B5FD', lineHeight: 18 },

  // All-done empty state
  allDoneWrap: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  allDoneCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#8B5CF6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  allDoneTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 16,
  },
  allDoneSub: {
    fontSize: 13,
    color: '#A78BFA',
    marginTop: 6,
  },

  // Edit mode task row
  editTaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#211640',
    paddingVertical: 12,
    paddingRight: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#3B2A65',
    gap: 8,
  },
  editTaskRowActive: {
    backgroundColor: '#2D1F52',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 6,
  },
  dragHandle: { paddingHorizontal: 10, paddingVertical: 4 },
  editTaskContent: { flex: 1 },
  editTaskName: { fontSize: 14, fontWeight: '600', color: '#FFFFFF', marginBottom: 1 },
  editTaskSubtitle: { fontSize: 12, color: '#9B7FD4' },
  deleteBtn: { padding: 6 },

  // Source badge
  sourceBadge: { borderRadius: 5, paddingHorizontal: 7, paddingVertical: 2 },
  sourceBadgeText: { fontSize: 10, fontWeight: '600' },
  sourceBadgeOrdered: { backgroundColor: '#422006' },
  sourceBadgeOrderedText: { color: '#FCD34D' },
  sourceBadgeCustom: { backgroundColor: '#1E3A5F' },
  sourceBadgeCustomText: { color: '#93C5FD' },

  // Drag placeholder
  dragPlaceholder: {
    height: 56,
    backgroundColor: '#2D1B6B',
    borderRadius: 8,
    marginHorizontal: 12,
    marginVertical: 4,
  },

  // Undo banner
  undoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1A1030',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  undoText: { fontSize: 13, color: '#C4B5FD', flex: 1 },
  undoBtn: { paddingHorizontal: 12, paddingVertical: 4 },
  undoBtnText: { fontSize: 13, fontWeight: '700', color: '#A78BFA' },

  // Add step button
  addStepBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#3B2A65',
  },
  addStepText: { fontSize: 14, fontWeight: '600', color: '#8B5CF6' },

  // Restore defaults
  restoreBtn: { alignItems: 'center', paddingVertical: 16, marginTop: 4 },
  restoreBtnText: { fontSize: 14, color: '#9B7FD4', textDecorationLine: 'underline' },

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
    backgroundColor: '#FFFFFF',
    borderTopWidth: 0.5,
    borderTopColor: '#E9E4FF',
  },
  markAllBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#8B5CF6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  markAllBtnText: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },
  resetBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E9E4FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetBtnText: { fontSize: 13, fontWeight: '600', color: '#A78BFA' },

  // Modal
  modalRoot: { flex: 1, backgroundColor: '#0F0A1A' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1A1030',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#3B2A65',
  },
  modalTitle: { fontSize: 17, fontWeight: '600', color: '#FFFFFF' },
  modalCancelBtn: { paddingHorizontal: 4 },
  modalCancelText: { fontSize: 15, color: '#9B7FD4' },
  modalAddBtn: { paddingHorizontal: 4 },
  modalAddText: { fontSize: 15, fontWeight: '700', color: '#8B5CF6' },
  modalScroll: { flex: 1 },
  modalContent: { padding: 20, gap: 20, paddingBottom: 60 },
  formGroup: { gap: 6 },
  formLabel: { fontSize: 13, fontWeight: '600', color: '#C4B5FD' },
  formOptional: { fontWeight: '400', color: '#9B7FD4' },
  formInput: {
    borderWidth: 1.5,
    borderColor: '#3B2A65',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#FFFFFF',
    backgroundColor: '#211640',
  },
  formInputError: { borderColor: '#F87171' },
  formTextArea: { minHeight: 90, paddingTop: 10 },
  formError: { fontSize: 12, color: '#F87171', marginTop: 2 },
  pickerWrapper: {
    borderWidth: 1.5,
    borderColor: '#3B2A65',
    borderRadius: 10,
    backgroundColor: '#211640',
    overflow: 'hidden',
  },
  picker: { height: 50, color: '#FFFFFF' },
});
