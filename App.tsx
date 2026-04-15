import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { MD3LightTheme, PaperProvider } from 'react-native-paper';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { RootNavigator } from './src/navigation';
import {
  createNotificationChannel,
  loadReminderPrefs,
  rescheduleAll,
} from './src/services/notificationService';
import { COLORS } from './src/constants/theme';
import { ThemeProvider } from './src/theme/ThemeContext';

const paperTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: COLORS.primary,
    primaryContainer: COLORS.primary100,
    secondary: COLORS.primary700,
    secondaryContainer: COLORS.primary50,
    surface: COLORS.card,
    background: COLORS.background,
    onPrimary: COLORS.textOnPrimary,
    onPrimaryContainer: COLORS.primary900,
    outline: COLORS.border,
  },
};

function App(): React.JSX.Element {
  useEffect(() => {
    // Set up Android notification channel and reschedule any saved reminders
    (async () => {
      await createNotificationChannel();
      const prefs = await loadReminderPrefs();
      await rescheduleAll(prefs);
    })();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <StatusBar backgroundColor="transparent" barStyle="light-content" translucent={true} />
          <PaperProvider theme={paperTheme}>
            <NavigationContainer>
              <RootNavigator />
            </NavigationContainer>
            <Toast />
          </PaperProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default App;
