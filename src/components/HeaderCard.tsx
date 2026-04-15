import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import type { ThemeColors } from '../theme/colors';

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.headerCard,
      borderRadius: 16,
      paddingVertical: 18,
      paddingHorizontal: 16,
      alignItems: 'center',
      marginHorizontal: 16,
    },
    title: {
      fontSize: 18,
      fontWeight: '500',
      color: colors.primaryDark,
      letterSpacing: 0.2,
    },
    date: {
      fontSize: 13,
      color: colors.primaryMid,
      marginTop: 4,
    },
    day: {
      fontSize: 12,
      color: colors.primary,
      marginTop: 2,
    },
  });
}

export function HeaderCard() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const dayStr = now.toLocaleDateString('en-US', { weekday: 'long' });

  return (
    <View style={styles.card}>
      <Text style={styles.title}>✦ Skincare Tracker Pro</Text>
      <Text style={styles.date}>{dateStr}</Text>
      <Text style={styles.day}>{dayStr}</Text>
    </View>
  );
}
