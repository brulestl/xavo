import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../src/providers/AuthProvider';

const TABS = ['Login', 'Sign Up'] as const;

type Tab = (typeof TABS)[number];

export default function OnboardingLoginChoice() {
  const navigation = useNavigation();
  const { login, signup, signInWithOAuth } = useAuth();
  const [tab, setTab] = useState<Tab>('Login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<'google' | 'linkedin' | null>(null);

  const handleContinue = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      if (tab === 'Login') {
        const { error } = await login(email, password);
        if (error) {
          Alert.alert('Login Error', error.message);
          return;
        }
      } else {
        const { error } = await signup(email, password);
        if (error) {
          Alert.alert('Sign Up Error', error.message);
          return;
        }
      }
      // Success - let AuthProvider/App.tsx handle navigation based on auth state
      console.log('Email auth successful - auth state will trigger navigation');
    } catch (error) {
      Alert.alert('Error', 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    console.log('Starting Google OAuth from OnboardingLoginChoice screen...');
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
        console.log('Google OAuth successful from OnboardingLoginChoice screen - auth state will trigger navigation');
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
    console.log('Starting LinkedIn OAuth from OnboardingLoginChoice screen...');
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
        console.log('LinkedIn OAuth successful from OnboardingLoginChoice screen - auth state will trigger navigation');
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
    <View style={styles.container}>
      {/* Tabs */}
      <View style={styles.tabsContainer}>
        {TABS.map(t => (
          <TouchableOpacity 
            key={t} 
            onPress={() => setTab(t)} 
            style={[styles.tab, tab === t && styles.tabActive]}
            disabled={isFormDisabled}
          >
            <Text style={tab === t ? styles.tabTextActive : styles.tabText}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        style={[styles.input, { opacity: isFormDisabled ? 0.6 : 1 }]}
        keyboardType="email-address"
        autoCapitalize="none"
        editable={!isFormDisabled}
      />
      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        style={[styles.input, { opacity: isFormDisabled ? 0.6 : 1 }]}
        secureTextEntry
        editable={!isFormDisabled}
      />

      {tab === 'Login' && (
        <TouchableOpacity onPress={() => {}} disabled={isFormDisabled}>
          <Text style={[styles.forgot, { opacity: isFormDisabled ? 0.6 : 1 }]}>Forgot password?</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity 
        style={[styles.cta, { opacity: isFormDisabled ? 0.6 : 1 }]} 
        onPress={handleContinue}
        disabled={isFormDisabled}
      >
        <Text style={styles.ctaText}>
          {loading ? 'Please wait...' : tab}
        </Text>
      </TouchableOpacity>

      {/* Social Buttons with proper OAuth */}
      <TouchableOpacity 
        style={[styles.social, { opacity: isFormDisabled ? 0.6 : 1 }]} 
        onPress={handleGoogleAuth}
        disabled={isFormDisabled}
      >
        <Text style={styles.socialText}>
          {oauthLoading === 'google' ? 'Signing in with Google...' : 'Continue with Google'}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity 
        style={[styles.social, { opacity: isFormDisabled ? 0.6 : 1 }]} 
        onPress={handleLinkedInAuth}
        disabled={isFormDisabled}
      >
        <Text style={styles.socialText}>
          {oauthLoading === 'linkedin' ? 'Signing in with LinkedIn...' : 'Continue with LinkedIn'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 16, justifyContent: 'center' },
  tabsContainer: { flexDirection: 'row', marginBottom: 24 },
  tab: { flex: 1, paddingVertical: 12, borderBottomWidth: 2, borderColor: 'transparent' },
  tabActive: { borderColor: '#023047' },
  tabText: { textAlign: 'center', color: '#777' },
  tabTextActive: { color: '#023047', fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12 },
  forgot: { alignSelf: 'flex-end', color: '#023047', marginBottom: 12 },
  cta: { backgroundColor: '#023047', padding: 14, borderRadius: 30, marginBottom: 12 },
  ctaText: { color: '#fff', textAlign: 'center', fontWeight: '600' },
  social: { borderWidth: 1, borderColor: '#023047', borderRadius: 30, padding: 14 },
  socialText: { textAlign: 'center', color: '#023047' },
});