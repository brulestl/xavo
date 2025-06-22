import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../providers/AuthProvider';
import { useTheme } from '../providers/ThemeProvider';

export const SplashScreen: React.FC = () => {
  const navigation = useNavigation();
  const { session, loading } = useAuth();
  const { theme } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const logoFadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Start logo fade in animation first
    Animated.timing(logoFadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: false,
    }).start(() => {
      // Then start text fade in animation
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: false,
      }).start();
    });

    // Navigate after 2.5 seconds to allow for animations
    const timer = setTimeout(() => {
      if (!loading) {
        if (session) {
          navigation.navigate('Dashboard' as never);
        } else {
          navigation.navigate('Welcome' as never);
        }
      }
    }, 2500);

    return () => clearTimeout(timer);
  }, [navigation, session, loading, fadeAnim, logoFadeAnim]);

  return (
    <View style={[styles.container, { backgroundColor: theme.semanticColors.background }]}>
      <View style={styles.logoContainer}>
        {/* Logo Image with fade in */}
        <Animated.View style={[styles.logoImageContainer, { opacity: logoFadeAnim }]}>
          <Image 
            source={require('../../media/logo/xavo_mainLogoWhite.png')} 
            style={styles.logoImage}
            resizeMode="contain"
          />
        </Animated.View>
        
        {/* Xavo Text with fade in */}
        <Animated.View style={[{ opacity: fadeAnim }]}>
          <Text style={[styles.logoText, { color: theme.semanticColors.textPrimary }]}>
            Xavo
          </Text>
          <View style={[styles.logoUnderline, { backgroundColor: theme.semanticColors.primary }]} />
        </Animated.View>
      </View>
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
  logoImageContainer: {
    marginBottom: 20,
  },
  logoImage: {
    width: 80,
    height: 80,
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