import React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { RootStack } from './RootStack';
import { SidebarContent } from '../components/SidebarContent';

const Drawer = createDrawerNavigator();

export function DrawerNavigator() {
  return (
    <Drawer.Navigator
      drawerContent={props => <SidebarContent {...props} />}
      screenOptions={{ headerShown: false }}>
      <Drawer.Screen name="App" component={RootStack} />
    </Drawer.Navigator>
  );
}
