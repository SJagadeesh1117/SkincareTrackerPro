import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import type { ThemeColors } from '../theme/colors';

interface Props {
  currentStreak: number;
  bestStreak: number;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      flexDirection: 'row',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      marginHorizontal: 16,
      backgroundColor: colors.white,
      overflow: 'hidden',
    },
    half: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 16,
      gap: 4,
    },
    divider: {
      width: 1,
      backgroundColor: colors.divider,
      marginVertical: 12,
    },
    emoji: {
      fontSize: 20,
    },
    number: {
      fontSize: 22,
      fontWeight: '500',
      color: colors.primary,
      lineHeight: 26,
    },
    label: {
      fontSize: 11,
      color: colors.muted,
    },
  });
}

export function StreakStats({ currentStreak, bestStreak }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.card}>
      <View style={styles.half}>
        <Text style={styles.emoji}>🔥</Text>
        <Text style={styles.number}>{currentStreak}</Text>
        <Text style={styles.label}>Current streak</Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.half}>
        <Text style={styles.emoji}>🏆</Text>
        <Text style={styles.number}>{bestStreak}</Text>
        <Text style={styles.label}>Best streak</Text>
      </View>
    </View>
  );
}
