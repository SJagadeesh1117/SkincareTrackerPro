/**
 * EditRoutineModal — full-screen bottom sheet for reordering and deleting
 * routine steps across all 4 sections (morning, night_normal, night_retinol, weekly).
 *
 * Uses react-native-draggable-flatlist for drag-to-reorder.
 * Deletes show a 3-second undo banner before committing.
 */

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
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  NestableScrollContainer,
  NestableDraggableFlatList,
  ScaleDecorator,
  type RenderItemParams,
} from 'react-native-draggable-flatlist';

import { useTheme } from '../theme/ThemeContext';
import type { ThemeColors } from '../theme/colors';
import { useRoutineStore } from '../store/routineStore';
import type { Task } from '../constants/routineData';

// ── Types ─────────────────────────────────────────────────────────────────────

type SectionKey = 'morning' | 'night_normal' | 'weekly';

interface SectionConfig {
  key: SectionKey;
  label: string;
  emoji: string;
}

const SECTIONS: SectionConfig[] = [
  { key: 'morning',      label: 'Morning Routine', emoji: '☀' },
  { key: 'night_normal', label: 'Evening Routine', emoji: '🌙' },
  { key: 'weekly',       label: 'Weekly Extras',   emoji: '📅' },
];

interface PendingDelete {
  task: Task;
  index: number;
  timerId: ReturnType<typeof setTimeout>;
}

// ── Styles ────────────────────────────────────────────────────────────────────

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
    sheet: {
      flex: 1,
      marginTop: 48,
      backgroundColor: colors.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      overflow: 'hidden',
    },

    // Header
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.background,
    },
    headerTitle: {
      flex: 1,
      fontSize: 17,
      fontWeight: '700',
      color: colors.primaryDark,
    },
    doneBtn: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      backgroundColor: colors.primary,
      borderRadius: 10,
    },
    doneBtnText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.white,
    },

    // Section
    sectionBlock: { marginTop: 20, marginHorizontal: 16 },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8,
    },
    sectionLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.primaryMid,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    sectionCount: {
      fontSize: 12,
      color: colors.muted,
    },

    // Task rows
    taskRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.white,
      borderRadius: 12,
      marginBottom: 6,
      paddingVertical: 12,
      paddingRight: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    taskRowActive: {
      shadowColor: colors.primary,
      shadowOpacity: 0.2,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
      borderColor: colors.primary,
    },
    dragHandle: {
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    taskInfo: { flex: 1 },
    taskName: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.primaryDark,
    },
    taskSubtitle: {
      fontSize: 11,
      color: colors.muted,
      marginTop: 2,
    },
    sourceBadge: {
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 2,
      marginRight: 8,
    },
    sourceBadgeCustom: { backgroundColor: colors.surface },
    sourceBadgeTracked: { backgroundColor: '#EDE9FE' },
    sourceBadgeText: {
      fontSize: 10,
      fontWeight: '600',
      color: colors.primaryMid,
    },
    deleteBtn: {
      padding: 6,
      borderRadius: 8,
    },

    // Undo banner
    undoBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.primaryDark,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginTop: 6,
      marginBottom: 2,
    },
    undoText: { fontSize: 13, color: colors.white, flex: 1 },
    undoBtn: {
      paddingHorizontal: 12,
      paddingVertical: 4,
      backgroundColor: colors.primary,
      borderRadius: 8,
      marginLeft: 10,
    },
    undoBtnText: { fontSize: 13, fontWeight: '600', color: colors.white },

    // Empty state
    emptyRow: {
      paddingVertical: 14,
      paddingHorizontal: 16,
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      borderStyle: 'dashed',
      alignItems: 'center',
    },
    emptyText: { fontSize: 13, color: colors.muted },

    scrollBottom: { height: 40 },
  });
}

// ── EditableRow ───────────────────────────────────────────────────────────────

interface EditableRowProps extends RenderItemParams<Task> {
  styles: ReturnType<typeof createStyles>;
  colors: ThemeColors;
  onDelete: (task: Task) => void;
}

function EditableRow({ item, drag, isActive, styles, colors, onDelete }: EditableRowProps) {
  return (
    <ScaleDecorator activeScale={1.02}>
      <View style={[styles.taskRow, isActive && styles.taskRowActive]}>
        {/* Drag handle */}
        <TouchableOpacity
          onLongPress={drag}
          delayLongPress={100}
          style={styles.dragHandle}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
          <MaterialCommunityIcons
            name="drag-horizontal-variant"
            size={22}
            color={colors.muted}
          />
        </TouchableOpacity>

        {/* Task info */}
        <View style={styles.taskInfo}>
          <Text style={styles.taskName} numberOfLines={1}>{item.name}</Text>
          {!!item.subtitle && (
            <Text style={styles.taskSubtitle} numberOfLines={1}>{item.subtitle}</Text>
          )}
        </View>

        {/* Source badge */}
        {(item.source === 'custom' || item.source === 'tracked') && (
          <View style={[
            styles.sourceBadge,
            item.source === 'tracked' ? styles.sourceBadgeTracked : styles.sourceBadgeCustom,
          ]}>
            <Text style={styles.sourceBadgeText}>
              {item.source === 'tracked' ? 'Product' : 'Custom'}
            </Text>
          </View>
        )}

        {/* Delete */}
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

// ── SectionEditor ─────────────────────────────────────────────────────────────

interface SectionEditorProps {
  sectionKey: SectionKey;
  label: string;
  emoji: string;
  styles: ReturnType<typeof createStyles>;
  colors: ThemeColors;
}

function SectionEditor({ sectionKey, label, emoji, styles, colors }: SectionEditorProps) {
  const { sectionTasks, reorderTasks, deleteTask, undoDelete } = useRoutineStore();
  const tasks = sectionTasks[sectionKey] ?? [];

  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const undoAnim = useRef(new Animated.Value(0)).current;

  const showUndo = (pd: PendingDelete) => {
    setPendingDelete(pd);
    Animated.timing(undoAnim, { toValue: 1, duration: 180, useNativeDriver: true }).start();
  };

  const hideUndo = useCallback(() => {
    Animated.timing(undoAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start(
      () => setPendingDelete(null),
    );
  }, [undoAnim]);

  const handleDelete = useCallback(
    async (task: Task) => {
      const doDelete = async () => {
        if (pendingDelete) {
          clearTimeout(pendingDelete.timerId);
          hideUndo();
        }
        const result = await deleteTask(sectionKey, task.id);
        if (!result) return;

        const timerId = setTimeout(hideUndo, 3000);
        showUndo({ task: result.task, index: result.index, timerId });
      };

      if (task.source === 'default') {
        Alert.alert(
          'Remove default step?',
          `"${task.name}" is a default routine step. Remove it anyway?`,
          [
            { text: 'Keep', style: 'cancel' },
            { text: 'Remove', style: 'destructive', onPress: doDelete },
          ],
        );
      } else {
        await doDelete();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sectionKey, deleteTask, pendingDelete, hideUndo],
  );

  const handleUndo = async () => {
    if (!pendingDelete) return;
    clearTimeout(pendingDelete.timerId);
    await undoDelete(sectionKey, pendingDelete.task, pendingDelete.index);
    hideUndo();
  };

  const renderItem = useCallback(
    (params: RenderItemParams<Task>) => (
      <EditableRow
        {...params}
        styles={styles}
        colors={colors}
        onDelete={handleDelete}
      />
    ),
    [styles, colors, handleDelete],
  );

  return (
    <View style={styles.sectionBlock}>
      <View style={styles.sectionHeader}>
        <Text style={{ fontSize: 16 }}>{emoji}</Text>
        <Text style={styles.sectionLabel}>{label}</Text>
        <Text style={styles.sectionCount}>({tasks.length})</Text>
      </View>

      {tasks.length === 0 ? (
        <View style={styles.emptyRow}>
          <Text style={styles.emptyText}>No steps — use + Add to add one</Text>
        </View>
      ) : (
        <NestableDraggableFlatList
          data={tasks}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          onDragEnd={({ data }) => reorderTasks(sectionKey, data)}
          renderPlaceholder={() => (
            <View style={[styles.taskRow, { borderStyle: 'dashed', opacity: 0.4 }]} />
          )}
          scrollEnabled={false}
        />
      )}

      {/* Undo banner */}
      {pendingDelete && (
        <Animated.View style={[styles.undoBanner, { opacity: undoAnim }]}>
          <Text style={styles.undoText} numberOfLines={1}>
            "{pendingDelete.task.name}" removed
          </Text>
          <TouchableOpacity style={styles.undoBtn} onPress={handleUndo}>
            <Text style={styles.undoBtnText}>Undo</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
}

// ── EditRoutineModal ──────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function EditRoutineModal({ visible, onClose }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.overlay}>
        <SafeAreaView style={styles.sheet} edges={['bottom']}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <MaterialCommunityIcons
                name="close"
                size={22}
                color={colors.primaryMid}
              />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { marginLeft: 12 }]}>Edit routine</Text>
            <TouchableOpacity style={styles.doneBtn} onPress={onClose}>
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>

          {/* Hint */}
          <View style={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 2 }}>
            <Text style={{ fontSize: 12, color: colors.muted, lineHeight: 18 }}>
              Long-press the{' '}
              <MaterialCommunityIcons name="drag-horizontal-variant" size={12} color={colors.muted} />
              {' '}handle to drag and reorder steps. Tap the trash icon to remove a step.
            </Text>
          </View>

          {/* Sections */}
          <NestableScrollContainer
            contentContainerStyle={{ paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}>
            {SECTIONS.map(s => (
              <SectionEditor
                key={s.key}
                sectionKey={s.key}
                label={s.label}
                emoji={s.emoji}
                styles={styles}
                colors={colors}
              />
            ))}
            <View style={styles.scrollBottom} />
          </NestableScrollContainer>
        </SafeAreaView>
      </GestureHandlerRootView>
    </Modal>
  );
}
