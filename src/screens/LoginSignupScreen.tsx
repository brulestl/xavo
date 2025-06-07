import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, Alert } from 'react-native';
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
  
  const params = route.params as RouteParams;
  const mode = params?.mode || 'login';
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const { error } = mode === 'login' 
        ? await login(email, password)
        : await signup(email, password);

      if (error) {
        Alert.alert('Error', error.message);
      } else {
        if (mode === 'signup') {
          Alert.alert('Success', 'Please check your email to verify your account');
        } else {
          navigation.navigate('Dashboard' as never);
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    try {
      const { error } = await signInWithOAuth('google');
      if (error) {
        Alert.alert('Error', error.message);
      }
    } catch (error) {
      Alert.alert('Error', 'Google authentication failed');
    }
  };

  const handleLinkedInAuth = async () => {
    try {
      const { error } = await signInWithOAuth('linkedin');
      if (error) {
        Alert.alert('Error', error.message);
      }
    } catch (error) {
      Alert.alert('Error', 'LinkedIn authentication failed');
    }
  };

  return (
    <Container variant="screen">
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.content}>
          <Text style={[styles.title, { color: theme.textPrimary }]}>
            {mode === 'login' ? 'Welcome Back' : 'Create Account'}
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {mode === 'login' 
              ? 'Sign in to your account' 
              : 'Join thousands improving their relationships'
            }
          </Text>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: theme.textPrimary }]}>Email</Text>
              <TextInput
                style={[styles.input, { 
                  borderColor: theme.border, 
                  backgroundColor: theme.surface,
                  color: theme.textPrimary 
                }]}
                placeholder="Enter your email"
                placeholderTextColor={theme.textSecondary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: theme.textPrimary }]}>Password</Text>
              <TextInput
                style={[styles.input, { 
                  borderColor: theme.border, 
                  backgroundColor: theme.surface,
                  color: theme.textPrimary 
                }]}
                placeholder="Enter your password"
                placeholderTextColor={theme.textSecondary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>

            <Button
              title={loading ? 'Please wait...' : (mode === 'login' ? 'Sign In' : 'Sign Up')}
              onPress={handleSubmit}
              disabled={loading}
              fullWidth
              style={styles.submitButton}
            />

            <View style={styles.divider}>
              <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
              <Text style={[styles.dividerText, { color: theme.textSecondary }]}>OR</Text>
              <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
            </View>

            <Button
              title="Continue with Google"
              onPress={handleGoogleAuth}
              variant="outline"
              fullWidth
              style={styles.oauthButton}
            />

            <Button
              title="Continue with LinkedIn"
              onPress={handleLinkedInAuth}
              variant="outline"
              fullWidth
              style={styles.oauthButton}
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
}); 