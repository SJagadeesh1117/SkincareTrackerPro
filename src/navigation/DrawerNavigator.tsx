import React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { createStackNavigator } from '@react-navigation/stack';

import { SidebarContent } from '../components/SidebarContent';
import { AppHeader } from '../components/AppHeader';

import { HomeScreen } from '../screens/main/HomeScreen';
import { FaceScanScreen } from '../screens/main/FaceScanScreen';
import { MyProductsScreen } from '../screens/main/MyProductsScreen';
import { BundleScreen } from '../screens/main/BundleScreen';
import { OrderConfirmationScreen } from '../screens/main/OrderConfirmationScreen';
import { MyOrdersScreen } from '../screens/main/MyOrdersScreen';
import { ReminderSettingsScreen } from '../screens/main/ReminderSettingsScreen';
import { ProfileScreen } from '../screens/main/ProfileScreen';

import type { MainDrawerParamList, MyProductsStackParamList } from '../types';

const Drawer = createDrawerNavigator<MainDrawerParamList>();

const TITLES: Record<keyof MainDrawerParamList, string> = {
  Home: 'Home',
  FaceScan: 'Face Scan',
  MyProducts: 'My Products',
  MyOrders: 'My Orders',
  ReminderSettings: 'Reminder Settings',
  Profile: 'Profile',
};

// ── Stack navigators (one per drawer section) ─────────────
// Each navigator is created at module level so it is stable across renders.

const HomeStackNav = createStackNavigator();
function HomeStack() {
  return (
    <HomeStackNav.Navigator screenOptions={{ headerShown: false }}>
      <HomeStackNav.Screen name="HomeScreen" component={HomeScreen} />
    </HomeStackNav.Navigator>
  );
}

const FaceScanStackNav = createStackNavigator();
function FaceScanStack() {
  return (
    <FaceScanStackNav.Navigator screenOptions={{ headerShown: false }}>
      <FaceScanStackNav.Screen name="FaceScanScreen" component={FaceScanScreen} />
    </FaceScanStackNav.Navigator>
  );
}

// MyProducts stack — MyProductsScreen → BundleScreen → OrderConfirmationScreen
const MyProductsStackNav = createStackNavigator<MyProductsStackParamList>();
function MyProductsStack() {
  return (
    <MyProductsStackNav.Navigator screenOptions={{ headerShown: false }}>
      <MyProductsStackNav.Screen name="MyProductsScreen" component={MyProductsScreen} />
      <MyProductsStackNav.Screen name="BundleScreen" component={BundleScreen} />
      <MyProductsStackNav.Screen name="OrderConfirmationScreen" component={OrderConfirmationScreen} />
    </MyProductsStackNav.Navigator>
  );
}

const MyOrdersStackNav = createStackNavigator();
function MyOrdersStack() {
  return (
    <MyOrdersStackNav.Navigator screenOptions={{ headerShown: false }}>
      <MyOrdersStackNav.Screen name="MyOrdersScreen" component={MyOrdersScreen} />
    </MyOrdersStackNav.Navigator>
  );
}

const SettingsStackNav = createStackNavigator();
function SettingsStack() {
  return (
    <SettingsStackNav.Navigator screenOptions={{ headerShown: false }}>
      <SettingsStackNav.Screen name="ReminderSettingsScreen" component={ReminderSettingsScreen} />
    </SettingsStackNav.Navigator>
  );
}

const ProfileStackNav = createStackNavigator();
function ProfileStack() {
  return (
    <ProfileStackNav.Navigator screenOptions={{ headerShown: false }}>
      <ProfileStackNav.Screen name="ProfileScreen" component={ProfileScreen} />
    </ProfileStackNav.Navigator>
  );
}

// ── Drawer navigator ──────────────────────────────────────
export function DrawerNavigator() {
  return (
    <Drawer.Navigator
      drawerContent={props => <SidebarContent {...props} />}
      screenOptions={({ route }) => ({
        // Custom AppHeader: show Edit/Done toggle only on HomeScreen
        header: () => (
          <AppHeader
            title={TITLES[route.name as keyof MainDrawerParamList] ?? route.name}
            showEditButton={route.name === 'Home'}
          />
        ),
        // Drawer slides over content on both platforms
        drawerType: 'front',
        drawerStyle: { width: 280 },
        // Only respond to swipes starting within 50px of the left edge —
        // prevents conflicts with horizontal scrolling inside screens.
        swipeEdgeWidth: 50,
        overlayColor: 'rgba(0,0,0,0.4)',
      })}>
      <Drawer.Screen name="Home" component={HomeStack} />
      <Drawer.Screen name="FaceScan" component={FaceScanStack} />
      <Drawer.Screen name="MyProducts" component={MyProductsStack} />
      <Drawer.Screen name="MyOrders" component={MyOrdersStack} />
      <Drawer.Screen name="ReminderSettings" component={SettingsStack} />
      <Drawer.Screen name="Profile" component={ProfileStack} />
    </Drawer.Navigator>
  );
}
