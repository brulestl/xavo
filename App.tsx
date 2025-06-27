// Configure polyfills for robust file uploads BEFORE any other imports
import 'react-native-get-random-values';
import { Buffer } from 'buffer';

// Set up Buffer polyfill only (safer approach for React Native)
// @ts-ignore - Buffer polyfill
global.Buffer = Buffer;

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Providers
import { ThemeProvider } from './src/providers/ThemeProvider';
import { AuthProvider, useAuth } from './src/providers/AuthProvider';
import { TierProvider } from './src/contexts/TierContext';

// Monitoring
import { monitoring } from './src/services/monitoring';

// Screens
import { SplashScreen } from './src/screens/SplashScreen';
import { WelcomeScreen } from './src/screens/WelcomeScreen';
import { AuthChoiceScreen } from './src/screens/AuthChoiceScreen';
import { LoginSignupScreen } from './src/screens/LoginSignupScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { PersonalityQuizScreen } from './src/screens/PersonalityQuizScreen';
import { SubscriptionSelectionScreen } from './src/screens/SubscriptionSelectionScreen';
import { HomeScreen } from './src/screens/HomeScreen';

// Navigation
import { DrawerNavigator } from './src/navigation/DrawerNavigator';

const Stack = createNativeStackNavigator();

const AppNavigator: React.FC = () => {
  const { loading, session, user, hasCompletedOnboarding } = useAuth();

  console.log('🚦 AppNavigator render - Loading:', loading, 'Session:', !!session, 'User:', !!user, 'Onboarding complete:', hasCompletedOnboarding);
  console.log('🔍 Auth state details - Session ID:', session?.access_token ? 'exists' : 'null', 'User ID:', user?.id || 'null');

  if (loading) {
    console.log('⏩ Showing splash screen due to loading state');
    return <SplashScreen />;
  }

  // If user is authenticated, check if they need onboarding
  if (session && user) {
    if (!hasCompletedOnboarding) {
      console.log('🎯 Showing onboarding stack - user needs to complete onboarding');
      // User is authenticated but needs onboarding
      return (
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            animation: 'fade_from_bottom',
            animationDuration: 250,
          }}
          initialRouteName="Onboarding"
        >
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
          <Stack.Screen name="PersonalityQuiz" component={PersonalityQuizScreen} />
          <Stack.Screen name="SubscriptionSelection" component={SubscriptionSelectionScreen} />
          {/* Include DrawerNavigator for navigation after onboarding completion */}
          <Stack.Screen 
            name="Main" 
            component={DrawerNavigator}
            options={{ headerShown: false }}
          />
        </Stack.Navigator>
      );
    }
    
    console.log('🏠 Showing main app - user is authenticated and onboarding complete');
    // User is authenticated and has completed onboarding - go directly to main app
    return <DrawerNavigator />;
  }

  console.log('🔐 Showing auth stack - user not authenticated');
  // If user is not authenticated, show auth screens
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'fade_from_bottom',
        animationDuration: 250,
      }}
      initialRouteName="Welcome"
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="AuthChoice" component={AuthChoiceScreen} />
      <Stack.Screen name="LoginSignup" component={LoginSignupScreen} />
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="PersonalityQuiz" component={PersonalityQuizScreen} />
      <Stack.Screen name="SubscriptionSelection" component={SubscriptionSelectionScreen} />
      {/* Include DrawerNavigator for navigation after auth */}
      <Stack.Screen 
        name="Main" 
        component={DrawerNavigator}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
};

export default function App() {
  // Initialize monitoring services when app starts
  React.useEffect(() => {
    console.log('🚀 App starting - initializing monitoring services...');
    
    monitoring.initialize().then(() => {
      console.log('✅ Monitoring services ready');
    }).catch((error) => {
      console.error('❌ Failed to initialize monitoring:', error);
      // App should continue even if monitoring fails
    });
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <TierProvider>
              <NavigationContainer>
                <AppNavigator />
              </NavigationContainer>
            </TierProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}