import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { TouchableOpacity } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import type { AuthStackParamList } from '../types';
import { WelcomeScreen } from '../screens/auth/WelcomeScreen';
import { EmailLoginScreen } from '../screens/auth/EmailLoginScreen';
import { EmailRegisterScreen } from '../screens/auth/EmailRegisterScreen';
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen';
import { PhoneAuthScreen } from '../screens/auth/PhoneAuthScreen';
import { OTPScreen } from '../screens/auth/OTPScreen';

const Stack = createStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Welcome"
      screenOptions={({ navigation }) => ({
        headerStyle: {
          backgroundColor: '#fff',
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 0,
        },
        headerTintColor: '#8B5CF6',
        headerTitleStyle: {
          fontWeight: '600',
          fontSize: 17,
          color: '#111',
        },
        headerBackTitleVisible: false,
        headerLeft: ({ canGoBack }) =>
          canGoBack ? (
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={{ paddingHorizontal: 16, paddingVertical: 8 }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialCommunityIcons name="arrow-left" size={24} color="#8B5CF6" />
            </TouchableOpacity>
          ) : null,
      })}
    >
      <Stack.Screen name="Welcome"        component={WelcomeScreen}        options={{ headerShown: false }} />
      <Stack.Screen name="EmailLogin"     component={EmailLoginScreen}     options={{ headerShown: false }} />
      <Stack.Screen name="EmailRegister"  component={EmailRegisterScreen}  options={{ headerShown: false }} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ headerShown: false }} />
      <Stack.Screen name="PhoneAuth"      component={PhoneAuthScreen}      options={{ headerShown: false }} />
      <Stack.Screen name="OTP"            component={OTPScreen}            options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}
