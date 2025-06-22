import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Container } from '../components/Container';
import { Button } from '../components/Button';
import { useTheme } from '../providers/ThemeProvider';

export const AuthChoiceScreen: React.FC = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const logoFadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Start logo fade in animation
    Animated.timing(logoFadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: false,
    }).start();
  }, [logoFadeAnim]);

  const handleLogin = () => {
    navigation.navigate('LoginSignup', { mode: 'login' });
  };

  const handleSignUp = () => {
    navigation.navigate('LoginSignup', { mode: 'signup' });
  };

  return (
    <Container variant="screen">
      <View style={styles.container}>
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
            Welcome Back
          </Text>
          <Text style={[styles.subtitle, { color: theme.semanticColors.textSecondary }]}>
            Choose how you'd like to continue
          </Text>
        </View>

        <View style={styles.buttonContainer}>
          <Button
            title="Log In"
            onPress={handleLogin}
            size="large"
            fullWidth
            style={styles.button}
          />
          
          <Button
            title="Sign Up"
            onPress={handleSignUp}
            variant="outline"
            size="large"
            fullWidth
            style={styles.button}
          />
        </View>
      </View>
    </Container>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  logoImageContainer: {
    marginBottom: 24,
  },
  logoImage: {
    width: 80,
    height: 80,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  buttonContainer: {
    width: '100%',
    paddingHorizontal: 32,
    paddingBottom: 32,
  },
  button: {
    marginBottom: 16,
  },
}); 