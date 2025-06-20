import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../providers/AuthProvider';
import { useTheme } from '../providers/ThemeProvider';

export const SplashScreen: React.FC = () => {
  const navigation = useNavigation();
  const { session, loading } = useAuth();
  const { theme } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Start fade in animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: false,
    }).start();

    // Navigate after 2 seconds
    const timer = setTimeout(() => {
      if (!loading) {
        if (session) {
          navigation.navigate('Dashboard' as never);
        } else {
          navigation.navigate('Welcome' as never);
        }
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [navigation, session, loading, fadeAnim]);

  return (
    <View style={[styles.container, { backgroundColor: theme.semanticColors.background }]}>
      <Animated.View style={[styles.logoContainer, { opacity: fadeAnim }]}>
        {/* Xavo Logo - Using text for now, replace with actual logo */}
        <Text style={[styles.logoText, { color: theme.semanticColors.textPrimary }]}>
          Xavo
        </Text>
        <View style={[styles.logoUnderline, { backgroundColor: theme.semanticColors.primary }]} />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 48,
    fontWeight: '300', // Slim as specified
    letterSpacing: 2,
    marginBottom: 8,
  },
  logoUnderline: {
    width: 60,
    height: 2,
    borderRadius: 1,
  },
}); 