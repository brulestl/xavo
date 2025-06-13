import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useProfile, PersonalityInterpretation } from '../hooks/useProfile';
import { useAuth } from '../hooks/useAuth';

// Skeleton loader for profile data
const ProfileSkeleton: React.FC = () => (
  <View style={styles.skeletonContainer}>
    {/* Personality scores skeleton */}
    <View style={styles.skeletonSection}>
      <View style={styles.skeletonSectionTitle} />
      {[1, 2, 3, 4, 5].map((index) => (
        <View key={index} style={styles.skeletonPersonalityItem}>
          <View style={styles.skeletonPersonalityLabel} />
          <View style={styles.skeletonPersonalityBar} />
          <View style={styles.skeletonPersonalityScore} />
        </View>
      ))}
    </View>
    
    {/* Personalization skeleton */}
    <View style={styles.skeletonSection}>
      <View style={styles.skeletonSectionTitle} />
      <View style={styles.skeletonPersonalizationItem} />
      <View style={styles.skeletonPersonalizationItem} />
      <View style={styles.skeletonPersonalizationItem} />
    </View>
  </View>
);

// Personality trait component
const PersonalityTrait: React.FC<{
  label: string;
  score: number;
  interpretation: string;
}> = ({ label, score, interpretation }) => {
  const percentage = Math.round(score * 100);
  
  const getScoreColor = (score: number) => {
    if (score > 0.7) return '#28a745';
    if (score > 0.3) return '#ffc107';
    return '#dc3545';
  };

  return (
    <View style={styles.personalityTrait}>
      <View style={styles.traitHeader}>
        <Text style={styles.traitLabel}>{label}</Text>
        <Text style={styles.traitScore}>{percentage}%</Text>
      </View>
      
      <View style={styles.progressBarContainer}>
        <View style={styles.progressBar}>
          <View 
            style={[
              styles.progressFill, 
              { 
                width: `${percentage}%`,
                backgroundColor: getScoreColor(score)
              }
            ]} 
          />
        </View>
      </View>
      
      <Text style={styles.traitInterpretation}>{interpretation}</Text>
    </View>
  );
};

// Personalization section component
const PersonalizationSection: React.FC<{
  title: string;
  items: string[];
}> = ({ title, items }) => (
  <View style={styles.personalizationSection}>
    <Text style={styles.personalizationTitle}>{title}</Text>
    {items.length > 0 ? (
      <View style={styles.itemsContainer}>
        {items.map((item, index) => (
          <View key={index} style={styles.itemTag}>
            <Text style={styles.itemText}>{item}</Text>
          </View>
        ))}
      </View>
    ) : (
      <Text style={styles.noItemsText}>Not specified</Text>
    )}
  </View>
);

interface ProfileModalProps {
  visible: boolean;
  onClose: () => void;
  onSignOut?: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ visible, onClose, onSignOut }) => {
  const {
    profileData,
    isLoading,
    error,
    refreshPersonalityScores,
    getPersonalityInsights,
  } = useProfile();

  const { user, signOut, isLoading: isSigningOut } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefreshPersonality = async () => {
    setIsRefreshing(true);
    const success = await refreshPersonalityScores();
    setIsRefreshing(false);
    
    if (success) {
      Alert.alert(
        'Personality Updated',
        'Your personality scores have been recalculated based on your latest responses.'
      );
    }
  };

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            onSignOut?.();
            onClose();
          },
        },
      ]
    );
  };

  const renderPersonalitySection = () => {
    const { profile, interpretation } = profileData;
    
    if (!profile || !interpretation) {
      return (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personality Profile</Text>
          <Text style={styles.noDataText}>
            Complete the onboarding process to see your personality profile.
          </Text>
        </View>
      );
    }

    const traits = [
      { key: 'openness', label: 'Openness', score: profile.openness },
      { key: 'conscientiousness', label: 'Conscientiousness', score: profile.conscientiousness },
      { key: 'extraversion', label: 'Extraversion', score: profile.extraversion },
      { key: 'agreeableness', label: 'Agreeableness', score: profile.agreeableness },
      { key: 'neuroticism', label: 'Neuroticism', score: profile.neuroticism },
    ];

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Personality Profile</Text>
          <TouchableOpacity 
            style={styles.refreshButton}
            onPress={handleRefreshPersonality}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <ActivityIndicator color="#007bff" size="small" />
            ) : (
              <Text style={styles.refreshButtonText}>Refresh</Text>
            )}
          </TouchableOpacity>
        </View>
        
        <Text style={styles.sectionSubtitle}>
          Based on the Big Five personality model
        </Text>
        
        {traits.map((trait) => (
          <PersonalityTrait
            key={trait.key}
            label={trait.label}
            score={trait.score}
            interpretation={interpretation[trait.key as keyof PersonalityInterpretation]}
          />
        ))}
        
        <Text style={styles.lastUpdated}>
          Last updated: {new Date(profile.updated_at).toLocaleDateString()}
        </Text>
      </View>
    );
  };

  const renderPersonalizationSection = () => {
    const { personalization } = profileData;
    
    if (!personalization) {
      return (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personalization</Text>
          <Text style={styles.noDataText}>
            No personalization data available.
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Personalization</Text>
        
        <PersonalizationSection
          title="Communication Style"
          items={[personalization.communication_style]}
        />
        
        <PersonalizationSection
          title="Preferred Topics"
          items={personalization.preferred_topics}
        />
        
        <PersonalizationSection
          title="Goals"
          items={personalization.goals.map(goal => 
            typeof goal === 'string' ? goal : (goal as any)?.text || 'Untitled goal'
          )}
        />
        
        <PersonalizationSection
          title="Learning Preferences"
          items={personalization.learning_preferences}
        />
        
        <View style={styles.metaInfo}>
          <Text style={styles.metaText}>
            Language: {personalization.language}
          </Text>
          <Text style={styles.metaText}>
            Timezone: {personalization.timezone}
          </Text>
        </View>
      </View>
    );
  };

  const renderSettingsSection = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Settings</Text>
      
      {user && (
        <View style={styles.userInfo}>
          <Text style={styles.userInfoLabel}>Signed in as:</Text>
          <Text style={styles.userInfoValue}>{user.email}</Text>
        </View>
      )}
      
      <TouchableOpacity 
        style={styles.signOutButton}
        onPress={handleSignOut}
        disabled={isSigningOut}
      >
        {isSigningOut ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.signOutButtonText}>Sign Out</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Your Profile</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>

        {/* Error message */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Content */}
        {isLoading ? (
          <ProfileSkeleton />
        ) : (
          <ScrollView 
            style={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {renderPersonalitySection()}
            {renderPersonalizationSection()}
            {renderSettingsSection()}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#212529',
  },
  closeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#6c757d',
    borderRadius: 6,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  errorContainer: {
    padding: 12,
    backgroundColor: '#f8d7da',
    borderBottomWidth: 1,
    borderBottomColor: '#f5c6cb',
  },
  errorText: {
    color: '#721c24',
    fontSize: 14,
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212529',
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 20,
  },
  refreshButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#e7f3ff',
    borderRadius: 6,
    minWidth: 60,
    alignItems: 'center',
  },
  refreshButtonText: {
    color: '#007bff',
    fontSize: 12,
    fontWeight: '600',
  },
  personalityTrait: {
    marginBottom: 20,
  },
  traitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  traitLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
  },
  traitScore: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007bff',
  },
  progressBarContainer: {
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e9ecef',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  traitInterpretation: {
    fontSize: 14,
    color: '#495057',
    lineHeight: 20,
  },
  lastUpdated: {
    fontSize: 12,
    color: '#6c757d',
    textAlign: 'center',
    marginTop: 16,
    fontStyle: 'italic',
  },
  personalizationSection: {
    marginBottom: 20,
  },
  personalizationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 8,
  },
  itemsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  itemTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#e7f3ff',
    borderRadius: 16,
  },
  itemText: {
    fontSize: 14,
    color: '#007bff',
  },
  noItemsText: {
    fontSize: 14,
    color: '#6c757d',
    fontStyle: 'italic',
  },
  noDataText: {
    fontSize: 16,
    color: '#6c757d',
    textAlign: 'center',
    lineHeight: 24,
    marginTop: 20,
  },
  metaInfo: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  metaText: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 4,
  },
  // Skeleton loader styles
  skeletonContainer: {
    padding: 16,
    gap: 16,
  },
  skeletonSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  skeletonSectionTitle: {
    height: 24,
    backgroundColor: '#e9ecef',
    borderRadius: 4,
    marginBottom: 20,
    width: '60%',
  },
  skeletonPersonalityItem: {
    marginBottom: 20,
  },
  skeletonPersonalityLabel: {
    height: 16,
    backgroundColor: '#e9ecef',
    borderRadius: 4,
    marginBottom: 8,
    width: '40%',
  },
  skeletonPersonalityBar: {
    height: 8,
    backgroundColor: '#f8f9fa',
    borderRadius: 4,
    marginBottom: 8,
  },
  skeletonPersonalityScore: {
    height: 14,
    backgroundColor: '#e9ecef',
    borderRadius: 4,
    width: '80%',
  },
  skeletonPersonalizationItem: {
    height: 40,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 12,
  },
  // Settings section styles
  userInfo: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  userInfoLabel: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 4,
  },
  userInfoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
  },
  signOutButton: {
    backgroundColor: '#dc3545',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  signOutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
}); 