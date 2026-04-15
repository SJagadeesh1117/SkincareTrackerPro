import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, StatusBar, Platform } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import auth from '@react-native-firebase/auth';
import { useRoutineStore } from '../store/routineStore';
import { COLORS } from '../constants/theme';

type HeaderNavProp = any;

type Props = {
  title: string;
  greetingText?: string;
  greetingDate?: string;
  showEditButton?: boolean;
  rightActionLabel?: string;
  rightActionTextColor?: string;
  onRightActionPress?: () => void;
  hideRightContent?: boolean;
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

const STATUS_BAR_HEIGHT = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 0;

export function AppHeader({
  title,
  greetingText,
  greetingDate,
  showEditButton,
  rightActionLabel,
  rightActionTextColor,
  onRightActionPress,
  hideRightContent,
}: Props) {
  const navigation = useNavigation<HeaderNavProp>();
  const user = auth().currentUser;
  const initials = getInitials(user?.displayName);

  const { isEditMode, setEditMode, saveRoutineConfig } = useRoutineStore();

  const handleEditToggle = () => {
    if (isEditMode) {
      setEditMode(false);
      saveRoutineConfig();
    } else {
      setEditMode(true);
    }
  };

  // Greeting mode: left shows greeting+date, right shows edit button + avatar
  if (greetingText) {
    return (
      <View style={styles.headerWrap}>
        <View style={[styles.header, styles.headerGreetingMode]}>
          {/* Left: greeting + date */}
          <View style={styles.greetingBlock}>
            <Text style={styles.greetingText} numberOfLines={1}>{greetingText}</Text>
            {greetingDate ? (
              <Text style={styles.greetingDate}>{greetingDate}</Text>
            ) : null}
          </View>

          {/* Right: edit button + avatar */}
          <View style={styles.greetingRight}>
            {showEditButton && (
              <TouchableOpacity style={styles.editBtn} activeOpacity={0.7} onPress={handleEditToggle}>
                <Text style={[styles.editBtnText, isEditMode && styles.editBtnDone]}>
                  {isEditMode ? 'Done' : 'Edit'}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => navigation.navigate('MainTabs', { screen: 'ProfileTab' })}>
              {user?.photoURL ? (
                <Image source={{ uri: user.photoURL }} style={styles.avatarLarge} />
              ) : (
                <View style={styles.initialsCircleLarge}>
                  <Text style={styles.initialsTextLarge}>{initials}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.headerWrap}>
      <View style={styles.header}>
        {/* Left spacer */}
        <View style={styles.iconBtn} />

        {/* Title */}
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>

        {/* Right action */}
        {hideRightContent ? (
          <View style={styles.rightSpacer} />
        ) : rightActionLabel && onRightActionPress ? (
          <TouchableOpacity style={styles.editBtn} activeOpacity={0.7} onPress={onRightActionPress}>
            <Text style={[styles.editBtnText, rightActionTextColor ? { color: rightActionTextColor } : null]}>
              {rightActionLabel}
            </Text>
          </TouchableOpacity>
        ) : showEditButton ? (
          <TouchableOpacity style={styles.editBtn} activeOpacity={0.7} onPress={handleEditToggle}>
            <Text style={[styles.editBtnText, isEditMode && styles.editBtnDone]}>
              {isEditMode ? 'Done' : 'Edit'}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.iconBtn}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('MainTabs', { screen: 'ProfileTab' })}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  headerWrap: {
    backgroundColor: COLORS.background,
    paddingTop: STATUS_BAR_HEIGHT,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    height: 52,
    paddingBottom: 0,
  },
  headerGreetingMode: {
    height: 'auto' as any,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
  },
  greetingBlock: {
    flex: 1,
  },
  greetingText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  greetingDate: {
    fontSize: 11,
    color: '#DDD6FE',
    marginTop: 2,
  },
  greetingRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatarLarge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  initialsCircleLarge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  initialsTextLarge: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
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
    color: '#FFFFFF',
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
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    color: '#FFFFFF',
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
    color: COLORS.textSecondary,
  },
  editBtnDone: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  rightSpacer: {
    width: 40,
    height: 40,
  },
});
