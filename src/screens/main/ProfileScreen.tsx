import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  Alert,
} from 'react-native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import { signOut } from '../../services/authService';
import type { MainDrawerParamList } from '../../types';

type ProfileNavProp = DrawerNavigationProp<MainDrawerParamList, 'Profile'>;

function getInitials(name?: string | null): string {
  if (!name?.trim()) return '?';
  return name
    .trim()
    .split(/\s+/)
    .map(w => w[0]?.toUpperCase() ?? '')
    .slice(0, 2)
    .join('');
}

export function ProfileScreen() {
  const navigation = useNavigation<ProfileNavProp>();
  const currentUser = auth().currentUser;

  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(currentUser?.displayName ?? '');
  const [saving, setSaving] = useState(false);

  const handleSaveName = async () => {
    const trimmed = nameValue.trim();
    if (!trimmed || !currentUser) return;
    setSaving(true);
    try {
      await currentUser.updateProfile({ displayName: trimmed });
      await firestore()
        .collection('users')
        .doc(currentUser.uid)
        .set({ displayName: trimmed }, { merge: true });
      setEditingName(false);
    } catch {
      Alert.alert('Error', 'Failed to update name. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingName(false);
    setNameValue(currentUser?.displayName ?? '');
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await AsyncStorage.clear();
            await signOut();
          } catch {
            // navigation is handled by auth state listener in RootNavigator
          }
        },
      },
    ]);
  };

  const photoURL = currentUser?.photoURL;
  const displayName = currentUser?.displayName;
  const contact = currentUser?.email ?? currentUser?.phoneNumber ?? '';
  const initials = getInitials(displayName);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled">

      {/* ── Avatar section ─────────────────────────────────────── */}
      <View style={styles.avatarSection}>
        {photoURL ? (
          <Image source={{ uri: photoURL }} style={styles.avatar} />
        ) : (
          <View style={styles.initialsCircle}>
            <Text style={styles.initialsText}>{initials}</Text>
          </View>
        )}

        {/* Editable display name */}
        {editingName ? (
          <View style={styles.editNameRow}>
            <TextInput
              style={styles.nameInput}
              value={nameValue}
              onChangeText={setNameValue}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleSaveName}
              editable={!saving}
            />
            <TouchableOpacity
              onPress={handleSaveName}
              disabled={saving}
              style={styles.inlineBtn}>
              <Text style={[styles.inlineBtnText, { color: '#1D9E75' }]}>
                Save
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleCancelEdit} style={styles.inlineBtn}>
              <Text style={[styles.inlineBtnText, { color: '#888' }]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            onPress={() => setEditingName(true)}
            style={styles.nameRow}
            activeOpacity={0.7}>
            <Text style={styles.displayName}>
              {displayName ?? 'Tap to set name'}
            </Text>
            <MaterialCommunityIcons
              name="pencil-outline"
              size={16}
              color="#888"
              style={styles.editIcon}
            />
          </TouchableOpacity>
        )}

        {/* Email or phone */}
        {!!contact && <Text style={styles.contact}>{contact}</Text>}
      </View>

      {/* ── Menu rows ──────────────────────────────────────────── */}
      <View style={styles.menuSection}>
        <TouchableOpacity
          style={styles.menuRow}
          activeOpacity={0.7}
          onPress={() => navigation.navigate('ReminderSettings')}>
          <MaterialCommunityIcons name="bell-outline" size={22} color="#333" />
          <Text style={styles.menuLabel}>Reminder Settings</Text>
          <MaterialCommunityIcons
            name="chevron-right"
            size={22}
            color="#C0C0C0"
            style={styles.chevron}
          />
        </TouchableOpacity>

        <View style={styles.separator} />

        <TouchableOpacity
          style={styles.menuRow}
          activeOpacity={0.7}
          onPress={() => navigation.navigate('MyOrders')}>
          <MaterialCommunityIcons
            name="package-variant-outline"
            size={22}
            color="#333"
          />
          <Text style={styles.menuLabel}>My Orders</Text>
          <MaterialCommunityIcons
            name="chevron-right"
            size={22}
            color="#C0C0C0"
            style={styles.chevron}
          />
        </TouchableOpacity>
      </View>

      {/* ── Danger zone ────────────────────────────────────────── */}
      <View style={styles.dangerSection}>
        <TouchableOpacity
          style={styles.signOutButton}
          activeOpacity={0.8}
          onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* ── App version ────────────────────────────────────────── */}
      <Text style={styles.version}>Version 1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F9FC',
  },
  content: {
    paddingBottom: 40,
  },

  // Avatar section
  avatarSection: {
    alignItems: 'center',
    paddingTop: 36,
    paddingBottom: 28,
    backgroundColor: '#fff',
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E7EB',
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    marginBottom: 14,
  },
  initialsCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#1D9E75',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  initialsText: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '700',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  displayName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
  },
  editIcon: {
    marginTop: 2,
  },
  editNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
  },
  nameInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#111',
    borderBottomWidth: 1.5,
    borderBottomColor: '#1D9E75',
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  inlineBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  inlineBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  contact: {
    marginTop: 6,
    fontSize: 14,
    color: '#6B7280',
  },

  // Menu section
  menuSection: {
    marginTop: 20,
    backgroundColor: '#fff',
    borderTopWidth: 0.5,
    borderBottomWidth: 0.5,
    borderColor: '#E5E7EB',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 14,
  },
  menuLabel: {
    flex: 1,
    fontSize: 15,
    color: '#111',
  },
  chevron: {
    marginLeft: 'auto',
  },
  separator: {
    height: 0.5,
    backgroundColor: '#E5E7EB',
    marginLeft: 56,
  },

  // Danger zone
  dangerSection: {
    marginTop: 28,
    paddingHorizontal: 20,
  },
  signOutButton: {
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FFF5F5',
    alignItems: 'center',
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#E53935',
  },

  // Version
  version: {
    marginTop: 32,
    textAlign: 'center',
    fontSize: 12,
    color: '#9CA3AF',
  },
});
