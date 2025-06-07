import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Providers
import { ThemeProvider } from './src/providers/ThemeProvider';
import { AuthProvider, useAuth } from './src/providers/AuthProvider';

// Screens
import { SplashScreen } from './src/screens/SplashScreen';
import { WelcomeScreen } from './src/screens/WelcomeScreen';
import { AuthChoiceScreen } from './src/screens/AuthChoiceScreen';
import { LoginSignupScreen } from './src/screens/LoginSignupScreen';

// Navigation
import { DrawerNavigator } from './src/navigation/DrawerNavigator';

const Stack = createNativeStackNavigator();

const AppNavigator: React.FC = () => {
  const { loading } = useAuth();

  if (loading) {
    return <SplashScreen />;
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="AuthChoice" component={AuthChoiceScreen} />
      <Stack.Screen name="LoginSignup" component={LoginSignupScreen} />
      <Stack.Screen name="Main" component={DrawerNavigator} />
      <Stack.Screen name="Dashboard" component={DrawerNavigator} />
    </Stack.Navigator>
  );
};

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <NavigationContainer>
              <AppNavigator />
            </NavigationContainer>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}