import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import type { MainTabParamList } from '../types';
import { FaceScanScreen } from '../screens/main/FaceScanScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { MyProductsScreen } from '../screens/main/MyProductsScreen';
import { ProfileScreen } from '../screens/main/ProfileScreen';
import { RecommendationsScreen } from '../screens/main/RecommendationsScreen';

// ── Nested stacks so RecommendationsScreen keeps the tab bar visible ──────────

const HomeStackNav = createStackNavigator();
function HomeStack() {
  return (
    <HomeStackNav.Navigator screenOptions={{ headerShown: false }}>
      <HomeStackNav.Screen name="HomeScreen" component={HomeScreen} />
      <HomeStackNav.Screen name="RecommendationsScreen" component={RecommendationsScreen} />
    </HomeStackNav.Navigator>
  );
}

const ScanStackNav = createStackNavigator();
function ScanStack() {
  return (
    <ScanStackNav.Navigator screenOptions={{ headerShown: false }}>
      <ScanStackNav.Screen name="FaceScanScreen" component={FaceScanScreen} />
      <ScanStackNav.Screen name="RecommendationsScreen" component={RecommendationsScreen} />
    </ScanStackNav.Navigator>
  );
}

// ── Tab Navigator ─────────────────────────────────────────────────────────────

const Tab = createBottomTabNavigator<MainTabParamList>();

export function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: '#7F77DD',
        tabBarInactiveTintColor: '#AFA9EC',
        tabBarLabelStyle: styles.tabBarLabel,
      }}>
      <Tab.Screen
        name="HomeTab"
        component={HomeStack}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="home-outline" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="ScanTab"
        component={ScanStack}
        options={{
          tabBarLabel: 'Face Scan',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="face-recognition" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="ProductsTab"
        component={MyProductsScreen}
        options={{
          tabBarLabel: 'My Products',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="bottle-tonic-outline" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="account-outline" color={color} size={size} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EEEAFE',
    height: Platform.OS === 'ios' ? 84 : 64,
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
    paddingTop: 8,
    elevation: 4,
    shadowColor: '#7F77DD',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
  },
  tabBarLabel: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
  },
});
