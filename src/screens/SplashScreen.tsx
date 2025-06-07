import React, { useEffect, useRef } from 'react';
import { View, Image, StyleSheet, Animated } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Container } from '../components/Container';
import { useAuth } from '../providers/AuthProvider';

export const SplashScreen: React.FC = () => {
  const navigation = useNavigation();
  const { session, loading } = useAuth();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Start fade in animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
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
    <Container variant="screen" padding="none">
      <View style={styles.container}>
        <Animated.View style={[styles.logoContainer, { opacity: fadeAnim }]}>
          <Image
            source={require('../../media/logo/logo_platinum_67.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </Animated.View>
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
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 200,
    height: 200,
  },
}); 