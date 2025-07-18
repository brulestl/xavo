import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Alert, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Button } from '../components/Button';
import { useTheme } from '../providers/ThemeProvider';
import { useAuth } from '../providers/AuthProvider';

export const WelcomeScreen: React.FC = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { signInWithOAuth } = useAuth();
  const slideAnim = useRef(new Animated.Value(100)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const logoFadeAnim = useRef(new Animated.Value(0)).current;
  const [oauthLoading, setOauthLoading] = useState<'google' | null>(null);

  useEffect(() => {
    // Start logo fade in first
    Animated.timing(logoFadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: false,
    }).start(() => {
      // Then animate buttons rising from bottom with fade in
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 800,
          useNativeDriver: false,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: false,
        }),
      ]).start();
    });
  }, [slideAnim, fadeAnim, logoFadeAnim]);

  const handleLogin = () => {
    (navigation as any).navigate('LoginSignup', { mode: 'login' });
  };

  const handleSignUp = () => {
    (navigation as any).navigate('LoginSignup', { mode: 'signup' });
  };

  const handleGoogleAuth = async () => {
    console.log('Starting Google OAuth from Welcome screen...');
    setOauthLoading('google');
    
    try {
      const { error } = await signInWithOAuth('google');
      if (error) {
        console.error('Google OAuth error details:', {
          message: error.message,
          status: error.status,
          name: error.name
        });
        
        // Handle specific OAuth errors
        let errorMessage = error.message;
        if (error.message.includes('popup_closed_by_user') || error.message.includes('cancelled')) {
          errorMessage = 'Sign-in was cancelled. Please try again.';
        } else if (error.message.includes('access_denied')) {
          errorMessage = 'Access was denied. Please grant permission to continue.';
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          errorMessage = 'Network error. Please check your internet connection and try again.';
        } else if (error.message.includes('Invalid login credentials')) {
          errorMessage = 'Google authentication failed. Please check your Google account settings.';
        }
        
        Alert.alert('Google Sign-In Error', `${errorMessage}\n\nDebug info: ${error.message}`);
      } else {
        // Success - let AuthProvider/App.tsx handle navigation based on auth state
        console.log('Google OAuth successful from Welcome screen - auth state will trigger navigation');
      }
    } catch (error) {
      console.error('Google OAuth error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert(
        'Google Sign-In Failed', 
        `Unable to sign in with Google. Please try again or use the login form.\n\nError: ${errorMessage}`
      );
    } finally {
      setOauthLoading(null);
    }
  };

  const isButtonDisabled = oauthLoading !== null;

  return (
    <View style={[styles.container, { backgroundColor: theme.semanticColors.background }]}>
      {/* Logo Image with fade in */}
      <Animated.View style={[styles.logoImageContainer, { opacity: logoFadeAnim }]}>
        <Image 
          source={require('../../media/logo/xavo_mainLogoWhite.png')} 
          style={styles.logoImage}
          resizeMode="contain"
        />
      </Animated.View>
      
      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.semanticColors.textPrimary }]}>
          Your AI Corporate Coach
        </Text>
        <Text style={[styles.subtitle, { color: theme.semanticColors.textSecondary }]}>
          Navigate workplace politics and advance your career with personalized AI guidance
        </Text>
      </View>

      <Animated.View
        style={[
          styles.buttonsContainer,
          {
            transform: [{ translateY: slideAnim }],
            opacity: fadeAnim,
          },
        ]}
      >
        <Button
          title="Log in"
          onPress={handleLogin}
          variant="primary"
          size="large"
          fullWidth
          disabled={isButtonDisabled}
          style={[styles.button, { opacity: isButtonDisabled ? 0.6 : 1 }]}
        />
        
        <Button
          title="Sign up"
          onPress={handleSignUp}
          variant="cta"
          size="large"
          fullWidth
          disabled={isButtonDisabled}
          style={[styles.button, { opacity: isButtonDisabled ? 0.6 : 1 }]}
        />
        
        <Button
          title={oauthLoading === 'google' ? 'Signing in with Google...' : 'Continue with Google'}
          onPress={handleGoogleAuth}
          variant="outline"
          size="large"
          fullWidth
          disabled={isButtonDisabled}
          style={[styles.button, { opacity: isButtonDisabled ? 0.6 : 1 }]}
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 120,
    paddingBottom: 48,
  },
  logoImageContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoImage: {
    width: 120,
    height: 120,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 80,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 40,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 16,
  },
  buttonsContainer: {
    width: '100%',
  },
  button: {
    marginBottom: 16,
  },
}); 