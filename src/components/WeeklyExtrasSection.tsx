import React, { useMemo, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../theme/ThemeContext';
import type { ThemeColors } from '../theme/colors';
import { RoutineItem } from './RoutineItem';
import type { RoutineItem as RoutineItemType } from '../types/routine';

interface Props {
  items: RoutineItemType[];
  onToggle: (id: string) => void;
  onAdd: () => void;
  defaultCollapsed?: boolean;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrapper: {
      marginHorizontal: 16,
      gap: 8,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 14,
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    titleGroup: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    iconBox: {
      width: 28,
      height: 28,
      borderRadius: 7,
      backgroundColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primaryDark,
    },
    optionalPill: {
      backgroundColor: colors.primary,
      borderRadius: 20,
      paddingHorizontal: 10,
      paddingVertical: 3,
    },
    optionalText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.white,
    },
    rightGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    addBtn: {
      paddingHorizontal: 4,
      paddingVertical: 2,
    },
    addBtnText: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.primary,
    },
  });
}

export function WeeklyExtrasSection({ items, onToggle, onAdd, defaultCollapsed = false }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const chevronAnim = useRef(new Animated.Value(defaultCollapsed ? 0 : 1)).current;

  const toggleCollapse = useCallback(() => {
    const toValue = collapsed ? 1 : 0;
    setCollapsed(v => !v);
    Animated.timing(chevronAnim, {
      toValue,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [collapsed, chevronAnim]);

  const chevronRotation = chevronAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity
        style={styles.headerRow}
        activeOpacity={0.7}
        onPress={toggleCollapse}>
        <View style={styles.titleGroup}>
          <View style={styles.iconBox}>
            <MaterialCommunityIcons
              name="calendar-month"
              size={16}
              color={colors.primaryMid}
            />
          </View>
          <Text style={styles.sectionTitle}>Weekly Extras</Text>
          <View style={styles.optionalPill}>
            <Text style={styles.optionalText}>Optional</Text>
          </View>
        </View>

        <View style={styles.rightGroup}>
          <TouchableOpacity style={styles.addBtn} activeOpacity={0.7} onPress={onAdd}>
            <Text style={styles.addBtnText}>+ Add</Text>
          </TouchableOpacity>
          <Animated.View style={{ transform: [{ rotate: chevronRotation }] }}>
            <MaterialCommunityIcons
              name="chevron-down"
              size={20}
              color={colors.muted}
            />
          </Animated.View>
        </View>
      </TouchableOpacity>

      {!collapsed && items.map(item => (
        <RoutineItem key={item.id} item={item} onToggle={onToggle} />
      ))}
    </View>
  );
}
