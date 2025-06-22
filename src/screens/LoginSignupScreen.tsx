import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, Alert, ActivityIndicator, Animated, Image } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Container } from '../components/Container';
import { Button } from '../components/Button';
import { useTheme } from '../providers/ThemeProvider';
import { useAuth } from '../providers/AuthProvider';

interface RouteParams {
  mode?: 'login' | 'signup';
}

export const LoginSignupScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { theme } = useTheme();
  const { login, signup, signInWithOAuth } = useAuth();
  const logoFadeAnim = useRef(new Animated.Value(0)).current;
  
  const params = route.params as RouteParams;
  const mode = params?.mode || 'login';
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<'google' | 'linkedin' | null>(null);

  useEffect(() => {
    // Start logo fade in animation
    Animated.timing(logoFadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: false,
    }).start();
  }, [logoFadeAnim]);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    // Password validation
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long');
      return;
    }

    setLoading(true);
    try {
      const { error } = mode === 'login' 
        ? await login(email, password)
        : await signup(email, password);

      if (error) {
        // Handle specific error cases
        let errorMessage = error.message;
        if (error.message.includes('Invalid login credentials')) {
          errorMessage = 'Invalid email or password. Please check your credentials and try again.';
        } else if (error.message.includes('User already registered')) {
          errorMessage = 'An account with this email already exists. Please sign in instead.';
        } else if (error.message.includes('Email not confirmed')) {
          errorMessage = 'Please check your email and click the confirmation link before signing in.';
        }
        
        Alert.alert('Authentication Error', errorMessage);
      } else {
        if (mode === 'signup') {
          Alert.alert(
            'Account Created Successfully', 
            'Please check your email to verify your account before signing in.',
            [{ text: 'OK', onPress: () => navigation.goBack() }]
          );
        } else {
          navigation.navigate('Dashboard' as never);
        }
      }
    } catch (error) {
      console.error('Auth error:', error);
      Alert.alert('Error', 'Something went wrong. Please check your internet connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    console.log('Starting Google OAuth flow...');
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
        console.log('Google OAuth successful - auth state will trigger navigation');
      }
    } catch (error) {
      console.error('Google OAuth error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert(
        'Google Sign-In Failed', 
        `Unable to sign in with Google. Please try again or use email/password.\n\nError: ${errorMessage}`
      );
    } finally {
      setOauthLoading(null);
    }
  };

  const handleLinkedInAuth = async () => {
    console.log('Starting LinkedIn OAuth flow...');
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
        console.log('LinkedIn OAuth successful - auth state will trigger navigation');
      }
    } catch (error) {
      console.error('LinkedIn OAuth error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert(
        'LinkedIn Sign-In Failed', 
        `Unable to sign in with LinkedIn. Please try again or use email/password.\n\nError: ${errorMessage}`
      );
    } finally {
      setOauthLoading(null);
    }
  };

  const isFormDisabled = loading || oauthLoading !== null;

  return (
    <Container variant="screen">
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.content}>
          {/* Logo Image with fade in */}
          <Animated.View style={[styles.logoImageContainer, { opacity: logoFadeAnim }]}>
            <Image 
              source={require('../../media/logo/xavo_mainLogoWhite.png')} 
              style={styles.logoImage}
              resizeMode="contain"
            />
          </Animated.View>
          
          <Text style={[styles.title, { color: theme.semanticColors.textPrimary }]}>
            {mode === 'login' ? 'Welcome Back' : 'Create Account'}
          </Text>
          <Text style={[styles.subtitle, { color: theme.semanticColors.textSecondary }]}>
            {mode === 'login' 
              ? 'Sign in to your account' 
              : 'Join thousands improving their relationships'
            }
          </Text>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: theme.semanticColors.textPrimary }]}>Email</Text>
              <TextInput
                style={[styles.input, { 
                  borderColor: theme.semanticColors.border, 
                  backgroundColor: theme.semanticColors.surface,
                  color: theme.semanticColors.textPrimary,
                  opacity: isFormDisabled ? 0.6 : 1
                }]}
                placeholder="Enter your email"
                placeholderTextColor={theme.semanticColors.textSecondary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isFormDisabled}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: theme.semanticColors.textPrimary }]}>Password</Text>
              <TextInput
                style={[styles.input, { 
                  borderColor: theme.semanticColors.border, 
                  backgroundColor: theme.semanticColors.surface,
                  color: theme.semanticColors.textPrimary,
                  opacity: isFormDisabled ? 0.6 : 1
                }]}
                placeholder="Enter your password"
                placeholderTextColor={theme.semanticColors.textSecondary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                editable={!isFormDisabled}
              />
            </View>

            <Button
              title={loading ? 'Please wait...' : (mode === 'login' ? 'Sign In' : 'Sign Up')}
              onPress={handleSubmit}
              disabled={isFormDisabled}
              fullWidth
              style={styles.submitButton}
            />

            <View style={styles.divider}>
              <View style={[styles.dividerLine, { backgroundColor: theme.semanticColors.border }]} />
              <Text style={[styles.dividerText, { color: theme.semanticColors.textSecondary }]}>OR</Text>
              <View style={[styles.dividerLine, { backgroundColor: theme.semanticColors.border }]} />
            </View>

            <Button
              title={oauthLoading === 'google' ? 'Signing in with Google...' : 'Continue with Google'}
              onPress={handleGoogleAuth}
              variant="outline"
              fullWidth
              disabled={isFormDisabled}
              style={[styles.oauthButton, { opacity: isFormDisabled ? 0.6 : 1 }]}
            />

            <Button
              title={oauthLoading === 'linkedin' ? 'Signing in with LinkedIn...' : 'Continue with LinkedIn'}
              onPress={handleLinkedInAuth}
              variant="outline"
              fullWidth
              disabled={isFormDisabled}
              style={[styles.oauthButton, { opacity: isFormDisabled ? 0.6 : 1 }]}
            />
          </View>
        </View>
      </ScrollView>
    </Container>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 32,
    paddingVertical: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
  },
  submitButton: {
    marginTop: 24,
    marginBottom: 24,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
  },
  oauthButton: {
    marginBottom: 12,
  },
  logoImageContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoImage: {
    width: 100,
    height: 100,
  },
}); 