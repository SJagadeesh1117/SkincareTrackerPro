import React, { useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  LayoutChangeEvent,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import type { ThemeColors } from '../theme/colors';

interface Props {
  completed: number;
  total: number;
  onEditRoutine: () => void;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 16,
      marginHorizontal: 16,
      backgroundColor: colors.white,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    label: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.primaryDark,
    },
    counter: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.primary,
    },
    track: {
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    fill: {
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.primary,
    },
    editBtn: {
      marginTop: 12,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      borderRadius: 8,
      paddingVertical: 8,
      alignItems: 'center',
    },
    editBtnText: {
      fontSize: 13,
      color: colors.primaryMid,
      fontWeight: '500',
    },
  });
}

export function ProgressCard({ completed, total, onEditRoutine }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const progress = total > 0 ? completed / total : 0;
  const fillAnim = useRef(new Animated.Value(0)).current;
  const trackWidth = useRef(0);

  useEffect(() => {
    Animated.timing(fillAnim, {
      toValue: progress,
      duration: 500,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [progress, fillAnim]);

  const onTrackLayout = (e: LayoutChangeEvent) => {
    trackWidth.current = e.nativeEvent.layout.width;
  };

  const animatedWidth = fillAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>Today's progress</Text>
        <Text style={styles.counter}>{completed} / {total}</Text>
      </View>

      <View style={styles.track} onLayout={onTrackLayout}>
        <Animated.View style={[styles.fill, { width: animatedWidth }]} />
      </View>

      <TouchableOpacity
        style={styles.editBtn}
        activeOpacity={0.7}
        onPress={onEditRoutine}>
        <Text style={styles.editBtnText}>Edit routine</Text>
      </TouchableOpacity>
    </View>
  );
}
