import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../providers/ThemeProvider';
import { Tier } from '../../providers/AuthProvider';

interface PlanFeature {
  text: string;
  included: boolean;
}

interface PlanCardProps {
  planName: string;
  tier: Tier;
  price: string;
  priceSubtext?: string;
  features: PlanFeature[];
  ctaText: string;
  ctaType: 'upgrade' | 'downgrade' | 'current';
  onPress: () => void;
  highlighted?: boolean;
}

export const PlanCard: React.FC<PlanCardProps> = ({
  planName,
  tier,
  price,
  priceSubtext,
  features,
  ctaText,
  ctaType,
  onPress,
  highlighted = false,
}) => {
  const { theme } = useTheme();

  const getCTAStyle = () => {
    switch (ctaType) {
      case 'upgrade':
        return {
          backgroundColor: theme.colors.growthGreen,
          textColor: theme.colors.pureWhite,
        };
      case 'current':
        return {
          backgroundColor: theme.semanticColors.border,
          textColor: theme.semanticColors.textSecondary,
        };
      case 'downgrade':
        return {
          backgroundColor: 'transparent',
          textColor: theme.semanticColors.textPrimary,
          borderColor: theme.semanticColors.border,
          borderWidth: 1,
        };
      default:
        return {
          backgroundColor: theme.colors.xavoBlue,
          textColor: theme.colors.pureWhite,
        };
    }
  };

  const ctaStyle = getCTAStyle();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.semanticColors.cardBackground,
          borderColor: highlighted ? theme.colors.xavoBlue : theme.semanticColors.border,
          borderWidth: highlighted ? 2 : StyleSheet.hairlineWidth,
        },
      ]}
    >
      {highlighted && (
        <View
          style={[
            styles.popularBadge,
            { backgroundColor: theme.colors.xavoBlue },
          ]}
        >
          <Text
            style={[
              styles.popularText,
              { color: theme.colors.pureWhite },
            ]}
          >
            Most Popular
          </Text>
        </View>
      )}

      {/* Header */}
      <View style={styles.header}>
        <Text
          style={[
            styles.planName,
            { color: theme.semanticColors.textPrimary },
          ]}
        >
          {planName}
        </Text>
        
        <View style={styles.priceContainer}>
          <Text
            style={[
              styles.price,
              { color: theme.semanticColors.textPrimary },
            ]}
          >
            {price}
          </Text>
          {priceSubtext && (
            <Text
              style={[
                styles.priceSubtext,
                { color: theme.semanticColors.textSecondary },
              ]}
            >
              {priceSubtext}
            </Text>
          )}
        </View>
      </View>

      {/* Features */}
      <View style={styles.features}>
        {features.map((feature, index) => (
          <View key={index} style={styles.featureRow}>
            <Ionicons
              name={feature.included ? 'checkmark-circle' : 'close-circle'}
              size={20}
              color={
                feature.included
                  ? theme.colors.growthGreen
                  : theme.semanticColors.textSecondary
              }
            />
            <Text
              style={[
                styles.featureText,
                {
                  color: feature.included
                    ? theme.semanticColors.textPrimary
                    : theme.semanticColors.textSecondary,
                },
              ]}
            >
              {feature.text}
            </Text>
          </View>
        ))}
      </View>

      {/* CTA Button */}
      <TouchableOpacity
        style={[
          styles.ctaButton,
          {
            backgroundColor: ctaStyle.backgroundColor,
            borderColor: ctaStyle.borderColor,
            borderWidth: ctaStyle.borderWidth || 0,
          },
        ]}
        onPress={onPress}
        disabled={ctaType === 'current'}
      >
        <Text
          style={[
            styles.ctaText,
            {
              color: ctaStyle.textColor,
            },
          ]}
        >
          {ctaText}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    position: 'relative',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  popularBadge: {
    position: 'absolute',
    top: -8,
    left: 20,
    right: 20,
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  popularText: {
    fontSize: 12,
    fontWeight: '600',
  },
  header: {
    marginBottom: 20,
    marginTop: 8, // Extra space for popular badge
  },
  planName: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  price: {
    fontSize: 32,
    fontWeight: '800',
    marginRight: 4,
  },
  priceSubtext: {
    fontSize: 16,
    fontWeight: '500',
  },
  features: {
    marginBottom: 24,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureText: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 12,
    flex: 1,
  },
  ctaButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  ctaText: {
    fontSize: 16,
    fontWeight: '600',
  },
}); 