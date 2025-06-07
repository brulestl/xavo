import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';

export default function OnboardingIntro() {
  const navigation = useNavigation();

  return (
    <View style={styles.container}>
      <Text style={styles.headline}>Own Your Office Power.</Text>
      <Text style={styles.sub}>Real-time influence coaching at your fingertips.</Text>

      <TouchableOpacity
        style={styles.cta}
        onPress={() => navigation.navigate('OnboardingLoginChoice' as never)}
      >
        <Text style={styles.ctaText}>Get Started</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate('Main' as never)}>
        <Text style={styles.skip}>Skip for now</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  headline: { fontSize: 32, fontWeight: '700', textAlign: 'center', marginBottom: 16, color: '#023047' },
  sub: { fontSize: 16, textAlign: 'center', marginBottom: 40, color: '#333' },
  cta: { backgroundColor: '#023047', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 30, marginBottom: 24 },
  ctaText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  skip: { color: '#023047', textDecorationLine: 'underline' },
});