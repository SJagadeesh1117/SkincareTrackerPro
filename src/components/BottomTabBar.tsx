import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../theme/ThemeContext';
import type { ThemeColors } from '../theme/colors';

export type TabName = 'Home' | 'Scan' | 'Shop' | 'Profile';

interface TabConfig {
  name: TabName;
  icon: string;
  label: string;
}

const TABS: TabConfig[] = [
  { name: 'Home',    icon: 'home',            label: 'Home' },
  { name: 'Scan',    icon: 'face-recognition', label: 'Scan' },
  { name: 'Shop',    icon: 'shopping-outline', label: 'Shop' },
  { name: 'Profile', icon: 'account-outline',  label: 'Profile' },
];

interface Props {
  activeTab: TabName;
  onTabPress: (tab: TabName) => void;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    bar: {
      flexDirection: 'row',
      backgroundColor: colors.white,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
      height: 64,
    },
    tab: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 3,
    },
    activePill: {
      position: 'absolute',
      top: 6,
      left: 8,
      right: 8,
      bottom: 6,
      borderRadius: 10,
      backgroundColor: colors.surface,
    },
    label: {
      fontSize: 10,
      color: colors.muted,
    },
    labelActive: {
      color: colors.primary,
      fontWeight: '500',
    },
  });
}

export function BottomTabBar({ activeTab, onTabPress }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom }]}>
      {TABS.map(tab => {
        const active = activeTab === tab.name;
        return (
          <TouchableOpacity
            key={tab.name}
            style={styles.tab}
            activeOpacity={0.7}
            onPress={() => onTabPress(tab.name)}>
            {active && <View style={styles.activePill} />}
            <MaterialCommunityIcons
              name={tab.icon}
              size={24}
              color={active ? colors.primary : colors.muted}
            />
            <Text style={[styles.label, active && styles.labelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
