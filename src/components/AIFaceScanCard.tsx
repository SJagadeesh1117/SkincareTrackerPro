import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../theme/ThemeContext';
import type { ThemeColors } from '../theme/colors';

interface Props {
  onPress: () => void;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      borderRadius: 14,
      padding: 14,
      marginHorizontal: 16,
      gap: 12,
    },
    iconContainer: {
      width: 40,
      height: 40,
      borderRadius: 10,
      backgroundColor: colors.borderStrong,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    textBlock: {
      flex: 1,
    },
    title: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.primaryDark,
    },
    subtitle: {
      fontSize: 11,
      color: colors.primary,
      marginTop: 3,
    },
    arrow: {
      flexShrink: 0,
    },
  });
}

export function AIFaceScanCard({ onPress }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.7}
      onPress={onPress}>
      <View style={styles.iconContainer}>
        <MaterialCommunityIcons
          name="face-recognition"
          size={22}
          color={colors.primaryMid}
        />
      </View>

      <View style={styles.textBlock}>
        <Text style={styles.title}>AI face scan</Text>
        <Text style={styles.subtitle}>Track your progress weekly</Text>
      </View>

      <MaterialCommunityIcons
        name="arrow-right"
        size={20}
        color={colors.muted}
        style={styles.arrow}
      />
    </TouchableOpacity>
  );
}
