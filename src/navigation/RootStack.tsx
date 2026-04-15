import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

import { TabNavigator } from './TabNavigator';
import { MyProductsScreen } from '../screens/main/MyProductsScreen';
import { BundleScreen } from '../screens/main/BundleScreen';
import { OrderConfirmationScreen } from '../screens/main/OrderConfirmationScreen';
import { ReminderSettingsScreen } from '../screens/main/ReminderSettingsScreen';
import { ProductScanScreen }   from '../screens/main/ProductScanScreen';
import { ProductConfirmScreen } from '../screens/main/ProductConfirmScreen';
import type { RootStackParamList } from '../types';

const Stack = createStackNavigator<RootStackParamList>();

export function RootStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {/* Base App Navigation */}
      <Stack.Screen name="MainTabs" component={TabNavigator} />

      {/* Stack screens sliding over the tabs */}
      <Stack.Screen name="MyProducts" component={MyProductsScreen} />
      <Stack.Screen name="BundleScreen" component={BundleScreen} />
      <Stack.Screen name="OrderConfirmationScreen" component={OrderConfirmationScreen} />

      {/* Extra Stack Screens */}
      <Stack.Screen name="ReminderSettings" component={ReminderSettingsScreen} />
      <Stack.Screen name="ProductScanScreen"   component={ProductScanScreen} />
      <Stack.Screen name="ProductConfirmScreen" component={ProductConfirmScreen} />
    </Stack.Navigator>
  );
}
