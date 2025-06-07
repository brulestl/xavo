import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

export default function PaywallScreen() {
  const navigation = useNavigation();
  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.close} onPress={() => navigation.goBack()}>
        <Ionicons name="close" size={28} color="#333" />
      </TouchableOpacity>
      <Text style={styles.title}>Upgrade for Premium Models</Text>
      <Text style={styles.subtitle}>Access GPT-4o and Claude-3 after 20 daily free requests.</Text>
      <TouchableOpacity style={styles.cta} onPress={() => {}}>
        <Text style={styles.ctaText}>Subscribe $9.99 / month</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#fff' },
  close: { position: 'absolute', top: 52, right: 22 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 12, textAlign: 'center', color: '#111' },
  subtitle: { fontSize: 16, color: '#555', marginBottom: 24, textAlign: 'center' },
  cta: { backgroundColor: '#007AFF', paddingVertical: 14, paddingHorizontal: 26, borderRadius: 30 },
  ctaText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});