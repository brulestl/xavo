import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import ChatScreen from './ChatScreen';
import { useAuth } from '../contexts/AuthContext';

export default function Dashboard() {
  const { tier, attemptsLeft } = useAuth();

  return (
    <View style={styles.container}>
      {/* --- Header --- */}
      <View style={styles.header}>
        {tier === 'guest' ? (
          <Text style={styles.headerText}>
            Welcome, Guest — {attemptsLeft} / 3 free attempts today (Basic Model)
          </Text>
        ) : (
          <Text style={styles.headerText}>Greetings — Model GPT-4o</Text>
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