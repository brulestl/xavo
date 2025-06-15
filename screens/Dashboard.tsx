import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import ChatScreen from './ChatScreen';
import { useAuth } from '../contexts/AuthContext';

export default function Dashboard() {
  const { tier, dailyCounter } = useAuth();
  const attemptsLeft = tier === 'shark' ? 999 : dailyCounter;

  return (
    <View style={styles.container}>
      {/* --- Header --- */}
      <View style={styles.header}>
        {tier === 'trial' ? (
          <Text style={styles.headerText}>
            Welcome, Trial User — {attemptsLeft} / 3 free attempts today (Basic Model)
          </Text>
        ) : tier === 'strategist' ? (
          <Text style={styles.headerText}>Greetings, Strategist — Model GPT-4o</Text>
        ) : (
          <Text style={styles.headerText}>Welcome, Shark — Unlimited Access (Premium Model)</Text>
        )}
      </View>

      <ChatScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 12, backgroundColor: '#fff', borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#ddd' },
  headerText: { textAlign: 'center', color: '#023047' },
});