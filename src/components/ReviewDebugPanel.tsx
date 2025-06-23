import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../providers/ThemeProvider';
import { appReviewService } from '../services/appReviewService';

interface ReviewDebugPanelProps {
  visible: boolean;
  onClose: () => void;
}

export const ReviewDebugPanel: React.FC<ReviewDebugPanelProps> = ({
  visible,
  onClose,
}) => {
  const { theme } = useTheme();
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      loadDebugInfo();
    }
  }, [visible]);

  const loadDebugInfo = async () => {
    try {
      setLoading(true);
      const info = await appReviewService.getDebugInfo();
      setDebugInfo(info);
    } catch (error) {
      console.error('Failed to load debug info:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerReview = async () => {
    try {
      setLoading(true);
      const success = await appReviewService.triggerReviewPrompt();
      Alert.alert(
        'Review Prompt Result',
        success ? 'Review prompt shown successfully!' : 'Review prompt was not shown (device/platform limitations or user not eligible)',
        [{ text: 'OK' }]
      );
      await loadDebugInfo(); // Refresh data
    } catch (error) {
      Alert.alert('Error', 'Failed to trigger review prompt');
      console.error('Failed to trigger review:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResetData = async () => {
    Alert.alert(
      'Reset Review Data',
      'This will reset all review tracking data. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await appReviewService.resetReviewData();
              await loadDebugInfo(); // Refresh data
              Alert.alert('Success', 'Review data has been reset');
            } catch (error) {
              Alert.alert('Error', 'Failed to reset review data');
              console.error('Failed to reset data:', error);
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleIncrementSessions = async () => {
    try {
      setLoading(true);
      await appReviewService.incrementSessionCount();
      await loadDebugInfo(); // Refresh data
    } catch (error) {
      console.error('Failed to increment sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleIncrementMessages = async () => {
    try {
      setLoading(true);
      await appReviewService.incrementMessageCount();
      await loadDebugInfo(); // Refresh data
    } catch (error) {
      console.error('Failed to increment messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderMetricRow = (label: string, value: string | number, target: string | number) => (
    <View style={styles.metricRow}>
      <Text style={[styles.metricLabel, { color: theme.semanticColors.textPrimary }]}>
        {label}
      </Text>
      <View style={styles.metricValue}>
        <Text style={[styles.metricText, { color: theme.semanticColors.textPrimary }]}>
          {value}
        </Text>
        <Text style={[styles.metricTarget, { color: theme.semanticColors.textSecondary }]}>
          / {target}
        </Text>
      </View>
    </View>
  );

  const renderEligibilityBadge = (eligible: boolean) => (
    <View style={[
      styles.eligibilityBadge,
      { backgroundColor: eligible ? '#4CAF50' : '#FF9800' }
    ]}>
      <Text style={styles.eligibilityText}>
        {eligible ? '✅ ELIGIBLE' : '⏳ NOT ELIGIBLE'}
      </Text>
    </View>
  );

  if (!__DEV__) {
    return null; // Only show in development
  }

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.panel, { backgroundColor: theme.semanticColors.background }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.semanticColors.border }]}>
            <Text style={[styles.headerTitle, { color: theme.semanticColors.textPrimary }]}>
              📱 Review System Debug
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={theme.semanticColors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <Text style={[styles.loadingText, { color: theme.semanticColors.textSecondary }]}>
                  Loading debug info...
                </Text>
              </View>
            ) : debugInfo ? (
              <>
                {/* Eligibility Status */}
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: theme.semanticColors.textPrimary }]}>
                    Eligibility Status
                  </Text>
                  {renderEligibilityBadge(debugInfo.eligibility.isEligible)}
                  
                  {debugInfo.eligibility.withinCooldownPeriod && (
                    <Text style={[styles.cooldownText, { color: theme.semanticColors.textSecondary }]}>
                      Cooldown: {debugInfo.eligibility.daysSinceLastPrompt} days since last prompt
                      (need {debugInfo.criteria.PROMPT_COOLDOWN_DAYS} days)
                    </Text>
                  )}
                </View>

                {/* Current Metrics */}
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: theme.semanticColors.textPrimary }]}>
                    Current Metrics
                  </Text>
                  
                  {renderMetricRow(
                    'Session Count',
                    debugInfo.metrics.sessionCount,
                    debugInfo.criteria.MIN_SESSION_COUNT
                  )}
                  
                  {renderMetricRow(
                    'Message Count',
                    debugInfo.metrics.messageCount,
                    debugInfo.criteria.MIN_MESSAGE_COUNT
                  )}
                  
                  {renderMetricRow(
                    'Distinct Days',
                    debugInfo.metrics.distinctDaysUsed,
                    debugInfo.criteria.MIN_DISTINCT_DAYS
                  )}
                </View>

                {/* Criteria Check */}
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: theme.semanticColors.textPrimary }]}>
                    Criteria Check
                  </Text>
                  
                  <View style={styles.criteriaList}>
                    <View style={styles.criteriaItem}>
                      <Text style={styles.criteriaIcon}>
                        {debugInfo.eligibility.meetsSessionCount ? '✅' : '❌'}
                      </Text>
                      <Text style={[styles.criteriaText, { color: theme.semanticColors.textPrimary }]}>
                        Sessions ({debugInfo.criteria.MIN_SESSION_COUNT}+)
                      </Text>
                    </View>
                    
                    <View style={styles.criteriaItem}>
                      <Text style={styles.criteriaIcon}>
                        {debugInfo.eligibility.meetsMessageCount ? '✅' : '❌'}
                      </Text>
                      <Text style={[styles.criteriaText, { color: theme.semanticColors.textPrimary }]}>
                        Messages ({debugInfo.criteria.MIN_MESSAGE_COUNT}+)
                      </Text>
                    </View>
                    
                    <View style={styles.criteriaItem}>
                      <Text style={styles.criteriaIcon}>
                        {debugInfo.eligibility.meetsDistinctDays ? '✅' : '❌'}
                      </Text>
                      <Text style={[styles.criteriaText, { color: theme.semanticColors.textPrimary }]}>
                        Distinct Days ({debugInfo.criteria.MIN_DISTINCT_DAYS}+)
                      </Text>
                    </View>
                    
                    <View style={styles.criteriaItem}>
                      <Text style={styles.criteriaIcon}>
                        {!debugInfo.eligibility.withinCooldownPeriod ? '✅' : '❌'}
                      </Text>
                      <Text style={[styles.criteriaText, { color: theme.semanticColors.textPrimary }]}>
                        Cooldown Period ({debugInfo.criteria.PROMPT_COOLDOWN_DAYS} days)
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Review State */}
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: theme.semanticColors.textPrimary }]}>
                    Review State
                  </Text>
                  
                  <Text style={[styles.stateText, { color: theme.semanticColors.textSecondary }]}>
                    Last Prompt: {debugInfo.state.lastReviewPromptDate 
                      ? new Date(debugInfo.state.lastReviewPromptDate).toLocaleString()
                      : 'Never'
                    }
                  </Text>
                  
                  <Text style={[styles.stateText, { color: theme.semanticColors.textSecondary }]}>
                    Dismissed: {debugInfo.state.didDismissReview ? 'Yes' : 'No'}
                  </Text>
                </View>

                {/* Usage Dates */}
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: theme.semanticColors.textPrimary }]}>
                    Usage Dates ({debugInfo.metrics.usageDates.length})
                  </Text>
                  
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.datesContainer}>
                      {debugInfo.metrics.usageDates.slice(-10).map((date: string, index: number) => (
                        <View key={index} style={[styles.dateChip, { backgroundColor: theme.semanticColors.surface }]}>
                          <Text style={[styles.dateText, { color: theme.semanticColors.textPrimary }]}>
                            {new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              </>
            ) : (
              <Text style={[styles.errorText, { color: theme.semanticColors.textSecondary }]}>
                Failed to load debug info
              </Text>
            )}
          </ScrollView>

          {/* Action Buttons */}
          <View style={[styles.footer, { borderTopColor: theme.semanticColors.border }]}>
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: theme.semanticColors.primary }]}
                onPress={handleTriggerReview}
                disabled={loading}
              >
                <Text style={styles.actionButtonText}>🌟 Trigger Review</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: '#FF9800' }]}
                onPress={loadDebugInfo}
                disabled={loading}
              >
                <Text style={styles.actionButtonText}>🔄 Refresh</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: '#4CAF50' }]}
                onPress={handleIncrementSessions}
                disabled={loading}
              >
                <Text style={styles.actionButtonText}>+1 Session</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: '#2196F3' }]}
                onPress={handleIncrementMessages}
                disabled={loading}
              >
                <Text style={styles.actionButtonText}>+1 Message</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.actionButton, styles.resetButton, { backgroundColor: '#F44336' }]}
              onPress={handleResetData}
              disabled={loading}
            >
              <Text style={styles.actionButtonText}>🗑️ Reset All Data</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  panel: {
    height: '90%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 40,
  },
  section: {
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  eligibilityBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 8,
  },
  eligibilityText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  cooldownText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  metricLabel: {
    fontSize: 14,
    flex: 1,
  },
  metricValue: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricText: {
    fontSize: 16,
    fontWeight: '600',
  },
  metricTarget: {
    fontSize: 14,
    marginLeft: 4,
  },
  criteriaList: {
    gap: 8,
  },
  criteriaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  criteriaIcon: {
    fontSize: 16,
    marginRight: 8,
    width: 20,
  },
  criteriaText: {
    fontSize: 14,
  },
  stateText: {
    fontSize: 14,
    marginBottom: 4,
  },
  datesContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  dateChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  dateText: {
    fontSize: 12,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    gap: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  resetButton: {
    flex: 0,
    paddingHorizontal: 20,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
}); 