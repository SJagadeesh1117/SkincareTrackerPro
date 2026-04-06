import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import auth from '@react-native-firebase/auth';
import type { MainDrawerParamList } from '../types';
import { useRoutineStore } from '../store/routineStore';

type HeaderNavProp = DrawerNavigationProp<MainDrawerParamList>;

type Props = {
  title: string;
  /** When true: show Edit/Done button instead of avatar (for HomeScreen) */
  showEditButton?: boolean;
};

function getInitials(name?: string | null): string {
  if (!name?.trim()) return '?';
  return name
    .trim()
    .split(/\s+/)
    .map(w => w[0]?.toUpperCase() ?? '')
    .slice(0, 2)
    .join('');
}

export function AppHeader({ title, showEditButton }: Props) {
  const navigation = useNavigation<HeaderNavProp>();
  const user = auth().currentUser;
  const initials = getInitials(user?.displayName);

  const { isEditMode, setEditMode, saveRoutineConfig } = useRoutineStore();

  const handleEditToggle = () => {
    if (isEditMode) {
      setEditMode(false);
      saveRoutineConfig(); // fire-and-forget Firestore sync
    } else {
      setEditMode(true);
    }
  };

  return (
    <View style={styles.header}>
      {/* Hamburger — opens drawer */}
      <TouchableOpacity
        style={styles.iconBtn}
        activeOpacity={0.7}
        onPress={() => navigation.dispatch(DrawerActions.openDrawer())}>
        <MaterialCommunityIcons name="menu" size={24} color="#111" />
      </TouchableOpacity>

      {/* Screen title */}
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>

      {/* Right: Edit/Done (HomeScreen) or Avatar (other screens) */}
      {showEditButton ? (
        <TouchableOpacity
          style={styles.editBtn}
          activeOpacity={0.7}
          onPress={handleEditToggle}>
          <Text style={[styles.editBtnText, isEditMode && styles.editBtnDone]}>
            {isEditMode ? 'Done' : 'Edit'}
          </Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={styles.iconBtn}
          activeOpacity={0.7}
          onPress={() => navigation.navigate('Profile')}>
          {user?.photoURL ? (
            <Image source={{ uri: user.photoURL }} style={styles.avatar} />
          ) : (
            <View style={styles.initialsCircle}>
              <Text style={styles.initialsText}>{initials}</Text>
            </View>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E7EB',
    paddingHorizontal: 8,
    height: 56,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '600',
    color: '#111',
    marginHorizontal: 4,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  initialsCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1D9E75',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  editBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    minWidth: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1D9E75',
  },
  editBtnDone: {
    color: '#1D9E75',
    fontWeight: '700',
  },
});
