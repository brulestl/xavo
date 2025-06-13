import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../providers/ThemeProvider';
import { Tier } from '../../providers/AuthProvider';

interface TierBadgeProps {
  tier: Tier;
  size?: 'small' | 'medium' | 'large';
}

export const TierBadge: React.FC<TierBadgeProps> = ({ tier, size = 'medium' }) => {
  const { theme } = useTheme();

  const getTierConfig = (tier: Tier) => {
    switch (tier) {
      case 'power':
        return {
          label: 'Power',
          backgroundColor: theme.colors.growthGreen,
          textColor: theme.colors.pureWhite,
        };
      case 'essential':
        return {
          label: 'Essential',
          backgroundColor: theme.colors.xavoBlue,
          textColor: theme.colors.pureWhite,
        };
      case 'guest':
      default:
        return {
          label: 'Guest',
          backgroundColor: theme.semanticColors.border,
          textColor: theme.semanticColors.textSecondary,
        };
    }
  };

  const getSizeConfig = (size: 'small' | 'medium' | 'large') => {
    switch (size) {
      case 'small':
        return {
          paddingHorizontal: 6,
          paddingVertical: 2,
          fontSize: 10,
          borderRadius: 8,
        };
      case 'large':
        return {
          paddingHorizontal: 12,
          paddingVertical: 6,
          fontSize: 14,
          borderRadius: 12,
        };
      case 'medium':
      default:
        return {
          paddingHorizontal: 8,
          paddingVertical: 4,
          fontSize: 12,
          borderRadius: 10,
        };
    }
  };

  const tierConfig = getTierConfig(tier);
  const sizeConfig = getSizeConfig(size);

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: tierConfig.backgroundColor,
          paddingHorizontal: sizeConfig.paddingHorizontal,
          paddingVertical: sizeConfig.paddingVertical,
          borderRadius: sizeConfig.borderRadius,
        },
      ]}
    >
      <Text
        style={[
          styles.badgeText,
          {
            color: tierConfig.textColor,
            fontSize: sizeConfig.fontSize,
          },
        ]}
      >
        {tierConfig.label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  badgeText: {
    fontWeight: '600',
    textAlign: 'center',
  },
}); 