import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { PaperProvider } from 'react-native-paper';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { RootNavigator } from './src/navigation';
import {
  createNotificationChannel,
  loadReminderPrefs,
  rescheduleAll,
} from './src/services/notificationService';

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
        <PaperProvider>
          <NavigationContainer>
            <RootNavigator />
          </NavigationContainer>
          <Toast />
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default App;
