import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../../providers/ThemeProvider';
import { useAuth } from '../../providers/AuthProvider';
import { TierBadge } from './TierBadge';

interface ProfileRowProps {
  onPress: () => void;
}

export const ProfileRow: React.FC<ProfileRowProps> = ({ onPress }) => {
  const { theme } = useTheme();
  const { displayName, tier } = useAuth();

  // Generate initials from display name
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('');
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          backgroundColor: theme.semanticColors.cardBackground,
          borderBottomColor: theme.semanticColors.border,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Avatar */}
      <View
        style={[
          styles.avatar,
          {
            backgroundColor: theme.colors.xavoBlue,
          },
        ]}
      >
        <Text
          style={[
            styles.avatarText,
            {
              color: theme.colors.pureWhite,
            },
          ]}
        >
          {getInitials(displayName)}
        </Text>
      </View>

      {/* User Info */}
      <View style={styles.userInfo}>
        <Text
          style={[
            styles.displayName,
            {
              color: theme.semanticColors.textPrimary,
            },
          ]}
        >
          {displayName}
        </Text>
        
        <View style={styles.tierContainer}>
          <TierBadge tier={tier} size="small" />
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 48, // Minimum touch target height
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '600',
  },
  userInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  displayName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  tierContainer: {
    alignSelf: 'flex-start',
  },
}); 