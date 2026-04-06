import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import type { DrawerContentComponentProps } from '@react-navigation/drawer';
import auth from '@react-native-firebase/auth';
import { signOut } from '../services/authService';
import type { MainDrawerParamList } from '../types';

type RouteKey = keyof MainDrawerParamList;

interface MenuItem {
  key: RouteKey;
  label: string;
  icon: string;
}

const MENU_ITEMS: MenuItem[] = [
  { key: 'Home', label: 'Home', icon: 'home-outline' },
  { key: 'FaceScan', label: 'Face Scan', icon: 'face-recognition' },
  { key: 'MyProducts', label: 'My Products', icon: 'package-variant' },
  { key: 'MyOrders', label: 'My Orders', icon: 'receipt-outline' },
  { key: 'ReminderSettings', label: 'Reminder Settings', icon: 'bell-outline' },
  { key: 'Profile', label: 'Profile', icon: 'account-outline' },
];

function getInitials(name?: string | null): string {
  if (!name?.trim()) return '?';
  return name
    .trim()
    .split(/\s+/)
    .map(w => w[0]?.toUpperCase() ?? '')
    .slice(0, 2)
    .join('');
}

export function SidebarContent({ navigation, state }: DrawerContentComponentProps) {
  const user = auth().currentUser;
  const activeRoute = state.routes[state.index]?.name as RouteKey | undefined;

  const displayName = user?.displayName ?? '';
  const contact = user?.email ?? user?.phoneNumber ?? '';
  const photoURL = user?.photoURL;
  const initials = getInitials(displayName);

  const navigateTo = (screen: RouteKey) => {
    navigation.navigate(screen);
    navigation.closeDrawer();
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          navigation.closeDrawer();
          try {
            await signOut();
          } catch {
            // auth state listener in RootNavigator handles navigation
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.root}>
      {/* ── User header ───────────────────────────────────────── */}
      <TouchableOpacity
        style={styles.header}
        activeOpacity={0.85}
        onPress={() => navigateTo('Profile')}>
        {photoURL ? (
          <Image source={{ uri: photoURL }} style={styles.avatar} />
        ) : (
          <View style={styles.initialsCircle}>
            <Text style={styles.initialsText}>{initials}</Text>
          </View>
        )}
        <View style={styles.headerText}>
          <Text style={styles.displayName} numberOfLines={1}>
            {displayName || 'My Account'}
          </Text>
          {!!contact && (
            <Text style={styles.contact} numberOfLines={1}>
              {contact}
            </Text>
          )}
        </View>
      </TouchableOpacity>

      {/* ── Menu items ────────────────────────────────────────── */}
      <ScrollView
        style={styles.menu}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.menuContent}>
        {MENU_ITEMS.map(item => {
          const isActive = activeRoute === item.key;
          return (
            <TouchableOpacity
              key={item.key}
              style={[styles.menuItem, isActive && styles.menuItemActive]}
              activeOpacity={0.7}
              onPress={() => navigateTo(item.key)}>
              <MaterialCommunityIcons
                name={item.icon}
                size={22}
                color={isActive ? '#1D9E75' : '#6B7280'}
              />
              <Text
                style={[styles.menuLabel, isActive && styles.menuLabelActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}

        {/* ── Divider ──────────────────────────────────────────── */}
        <View style={styles.divider} />

        {/* ── Sign Out ─────────────────────────────────────────── */}
        <TouchableOpacity
          style={styles.menuItem}
          activeOpacity={0.7}
          onPress={handleSignOut}>
          <MaterialCommunityIcons name="logout-variant" size={22} color="#DC2626" />
          <Text style={[styles.menuLabel, styles.signOutLabel]}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#fff',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E1F5EE',
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 20,
    gap: 14,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  initialsCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1D9E75',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  headerText: {
    flex: 1,
  },
  displayName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111',
    marginBottom: 2,
  },
  contact: {
    fontSize: 13,
    color: '#4B5563',
  },

  // Menu
  menu: {
    flex: 1,
  },
  menuContent: {
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 10,
    gap: 14,
    marginBottom: 2,
  },
  menuItemActive: {
    backgroundColor: '#E1F5EE',
  },
  menuLabel: {
    fontSize: 15,
    color: '#6B7280',
    fontWeight: '500',
  },
  menuLabelActive: {
    color: '#1D9E75',
    fontWeight: '600',
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 8,
    marginHorizontal: 4,
  },

  // Sign out
  signOutLabel: {
    color: '#DC2626',
  },
});
