import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../providers/ThemeProvider';

export type Tier = 'trial' | 'strategist' | 'shark';

interface TierBadgeProps {
  tier: Tier;
  size?: 'small' | 'medium' | 'large';
}

export const TierBadge: React.FC<TierBadgeProps> = ({ tier, size = 'medium' }) => {
  const { theme } = useTheme();

  const getTierConfig = (tier: Tier) => {
    switch (tier) {
      case 'shark':
        return {
          label: 'Shark',
          backgroundColor: theme.colors.growthGreen,
          textColor: theme.colors.pureWhite,
        };
      case 'strategist':
        return {
          label: 'Strategist',
          backgroundColor: theme.colors.xavoBlue,
          textColor: theme.colors.pureWhite,
        };
      case 'trial':
      default:
        return {
          label: 'Trial',
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
          styles.text,
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
  },
  text: {
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
}); 