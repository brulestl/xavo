import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Alert } from 'react-native';
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
  const [oauthLoading, setOauthLoading] = useState<'google' | 'linkedin' | null>(null);

  useEffect(() => {
    // Animate buttons rising from bottom with fade in
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
  }, [slideAnim, fadeAnim]);

  const handleLogin = () => {
    navigation.navigate('AuthChoice' as never);
  };

  const handleSignUp = () => {
    navigation.navigate('AuthChoice' as never);
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

  const handleLinkedInAuth = async () => {
    console.log('Starting LinkedIn OAuth from Welcome screen...');
    setOauthLoading('linkedin');
    
    try {
      const { error } = await signInWithOAuth('linkedin');
      if (error) {
        console.error('LinkedIn OAuth error details:', {
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
          errorMessage = 'LinkedIn authentication failed. Please check your LinkedIn account settings.';
        }
        
        Alert.alert('LinkedIn Sign-In Error', `${errorMessage}\n\nDebug info: ${error.message}`);
      } else {
        // Success - let AuthProvider/App.tsx handle navigation based on auth state
        console.log('LinkedIn OAuth successful from Welcome screen - auth state will trigger navigation');
      }
    } catch (error) {
      console.error('LinkedIn OAuth error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert(
        'LinkedIn Sign-In Failed', 
        `Unable to sign in with LinkedIn. Please try again or use the login form.\n\nError: ${errorMessage}`
      );
    } finally {
      setOauthLoading(null);
    }
  };

  const isButtonDisabled = oauthLoading !== null;

  return (
    <View style={[styles.container, { backgroundColor: theme.semanticColors.background }]}>
      {/* Logo Area */}
      <View style={styles.logoContainer}>
        <Text style={[styles.logoText, { color: theme.semanticColors.textPrimary }]}>
          Xavo
        </Text>
        <View style={[styles.logoUnderline, { backgroundColor: theme.semanticColors.primary }]} />
      </View>

      {/* Buttons Container */}
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
        
        <Button
          title={oauthLoading === 'linkedin' ? 'Signing in with LinkedIn...' : 'Continue with LinkedIn'}
          onPress={handleLinkedInAuth}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 60,
  },
  logoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 48,
    fontWeight: '300',
    letterSpacing: 2,
    marginBottom: 8,
  },
  logoUnderline: {
    width: 60,
    height: 2,
    borderRadius: 1,
  },
  buttonsContainer: {
    width: '100%',
    paddingBottom: 20,
  },
  button: {
    marginBottom: 16,
  },
}); 