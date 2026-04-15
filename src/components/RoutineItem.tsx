import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../theme/ThemeContext';
import type { ThemeColors } from '../theme/colors';
import type { RoutineItem as RoutineItemType } from '../types/routine';

interface Props {
  item: RoutineItemType;
  onToggle: (id: string) => void;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrapper: {
      borderRadius: 12,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      gap: 10,
    },
    checkbox: {
      width: 18,
      height: 18,
      borderRadius: 4,
      borderWidth: 1.5,
      borderColor: colors.muted,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    checkboxDone: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    textBlock: {
      flex: 1,
    },
    name: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.primaryDark,
    },
    nameDone: {
      textDecorationLine: 'line-through',
      color: colors.muted,
    },
    description: {
      fontSize: 11,
      color: colors.primary,
      marginTop: 2,
    },
    chevronBtn: {
      padding: 2,
    },
    expanded: {
      paddingHorizontal: 12,
      paddingBottom: 12,
      paddingTop: 0,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginBottom: 10,
    },
    notes: {
      fontSize: 12,
      color: colors.primaryMid,
      lineHeight: 18,
    },
  });
}

export function RoutineItem({ item, onToggle }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [expanded, setExpanded] = useState(false);

  const notesText = item.notes ?? `Apply ${item.name.toLowerCase()} evenly. Wait 30–60 seconds before the next step.`;

  return (
    <View style={styles.wrapper}>
      <View style={styles.row}>
        {/* Checkbox */}
        <TouchableOpacity
          style={[styles.checkbox, item.completed && styles.checkboxDone]}
          onPress={() => onToggle(item.id)}
          activeOpacity={0.7}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          {item.completed && (
            <MaterialCommunityIcons name="check" size={12} color={colors.white} />
          )}
        </TouchableOpacity>

        {/* Text */}
        <View style={styles.textBlock}>
          <Text style={[styles.name, item.completed && styles.nameDone]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.description} numberOfLines={1}>
            {item.description}
          </Text>
        </View>

        {/* Chevron */}
        <TouchableOpacity
          style={styles.chevronBtn}
          onPress={() => setExpanded(v => !v)}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MaterialCommunityIcons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.muted}
          />
        </TouchableOpacity>
      </View>

      {expanded && (
        <View style={styles.expanded}>
          <View style={styles.divider} />
          <Text style={styles.notes}>{notesText}</Text>
        </View>
      )}
    </View>
  );
}
