import React from 'react';
import { StyleSheet, View } from 'react-native';
import { DrawerContentScrollView, DrawerItemList } from '@react-navigation/drawer';
import { COLORS } from '../constants/theme';

export function SidebarContent(props: any) {
  return (
    <DrawerContentScrollView {...props} contentContainerStyle={styles.container}>
      <View style={styles.header} />
      <DrawerItemList {...props} />
    </DrawerContentScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  header: {
    height: 140,
    backgroundColor: COLORS.primary,
    marginBottom: 12,
  },
});
