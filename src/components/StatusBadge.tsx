import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { COLORS } from '../constants/theme';

export function StatusBadge({ status }: { status: string }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.label}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: COLORS.primary50,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.primary700,
  },
});
