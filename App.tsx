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
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { PersonalityQuizScreen } from './src/screens/PersonalityQuizScreen';
import { SubscriptionSelectionScreen } from './src/screens/SubscriptionSelectionScreen';
import { HomeScreen } from './src/screens/HomeScreen';

// Navigation
import { DrawerNavigator } from './src/navigation/DrawerNavigator';

const Stack = createNativeStackNavigator();

const AppNavigator: React.FC = () => {
  const { loading, session, user, hasCompletedOnboarding } = useAuth();

  if (loading) {
    return <SplashScreen />;
  }

  // If user is authenticated, check if they need onboarding
  if (session && user) {
    if (!hasCompletedOnboarding) {
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
    
    // User is authenticated and has completed onboarding - go directly to main app
    return <DrawerNavigator />;
  }

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