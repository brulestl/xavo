import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { useNavigation } from '@react-navigation/native';

const TABS = ['Login', 'Sign Up'] as const;

type Tab = (typeof TABS)[number];

export default function OnboardingLoginChoice() {
  const navigation = useNavigation();
  const [tab, setTab] = useState<Tab>('Login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleContinue = () => {
    // Mock login success → Tier: free
    navigation.navigate('Main' as never);
  };

  return (
    <View style={styles.container}>
      {/* Tabs */}
      <View style={styles.tabsContainer}>
        {TABS.map(t => (
          <TouchableOpacity key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabActive]}>
            <Text style={tab === t ? styles.tabTextActive : styles.tabText}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        style={styles.input}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        style={styles.input}
        secureTextEntry
      />

      {tab === 'Login' && (
        <TouchableOpacity onPress={() => {}}>
          <Text style={styles.forgot}>Forgot password?</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.cta} onPress={handleContinue}>
        <Text style={styles.ctaText}>{tab}</Text>
      </TouchableOpacity>

      {/* Social Buttons (mock) */}
      <TouchableOpacity style={styles.social} onPress={handleContinue}>
        <Text style={styles.socialText}>Continue with Google</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.social} onPress={handleContinue}>
        <Text style={styles.socialText}>Continue with LinkedIn</Text>
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