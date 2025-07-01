import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../providers/ThemeProvider';

export type TierOption = 'strategist' | 'shark' | 'agent';

interface TierToggleProps {
  selectedTier: TierOption;
  onTierSelect: (tier: TierOption) => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TOGGLE_WIDTH = SCREEN_WIDTH * 0.6; // 60% of screen width
const SEGMENT_WIDTH = TOGGLE_WIDTH / 3;

export const TierToggle: React.FC<TierToggleProps> = ({
  selectedTier,
  onTierSelect,
}) => {
  const { theme } = useTheme();
  const slideAnim = useRef(new Animated.Value(0)).current;

  const getTierIndex = (tier: TierOption): number => {
    switch (tier) {
      case 'strategist': return 0;
      case 'shark': return 1;
      case 'agent': return 2;
      default: return 0;
    }
  };

  const getTierConfig = (tier: TierOption) => {
    switch (tier) {
      case 'strategist':
        return {
          label: 'Strategist',
          icon: 'briefcase-outline' as const,
          backgroundColor: theme.colors.xavoBlue,
          textColor: theme.colors.pureWhite,
        };
      case 'shark':
        return {
          label: 'Shark',
          icon: 'flash-outline' as const,
          backgroundColor: theme.colors.growthGreen,
          textColor: theme.colors.pureWhite,
        };
      case 'agent':
        return {
          label: 'Agent',
          icon: 'chatbubble-ellipses-outline' as const,
          backgroundColor: '#FF3131',
          textColor: theme.colors.pureWhite,
        };
    }
  };

  useEffect(() => {
    const targetIndex = getTierIndex(selectedTier);
    Animated.spring(slideAnim, {
      toValue: targetIndex * SEGMENT_WIDTH,
      useNativeDriver: true,
      tension: 120,
      friction: 8,
    }).start();
  }, [selectedTier, slideAnim]);

  const renderSegment = (tier: TierOption) => {
    const isSelected = tier === selectedTier;
    const config = getTierConfig(tier);
    
    return (
      <TouchableOpacity
        key={tier}
        style={[styles.segment, { width: SEGMENT_WIDTH }]}
        onPress={() => onTierSelect(tier)}
        activeOpacity={0.7}
      >
        <View style={styles.segmentContent}>
          <Ionicons
            name={config.icon}
            size={16}
            color={isSelected ? config.textColor : theme.semanticColors.textSecondary}
            style={styles.segmentIcon}
          />
          <Text
            style={[
              styles.segmentText,
              {
                color: isSelected ? config.textColor : theme.semanticColors.textSecondary,
                fontWeight: isSelected ? '700' : '500',
              },
            ]}
          >
            {config.label}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const selectedConfig = getTierConfig(selectedTier);

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: theme.semanticColors.textSecondary }]}>
        Plan
      </Text>
      <View
        style={[
          styles.toggleContainer,
          {
            backgroundColor: theme.semanticColors.cardBackground,
            borderColor: theme.semanticColors.border,
            width: TOGGLE_WIDTH,
          },
        ]}
      >
        {/* Animated sliding background */}
        <Animated.View
          style={[
            styles.slidingBackground,
            {
              backgroundColor: selectedConfig.backgroundColor,
              width: SEGMENT_WIDTH,
              transform: [{ translateX: slideAnim }],
            },
          ]}
        />
        
        {/* Segments */}
        <View style={styles.segmentsContainer}>
          {renderSegment('strategist')}
          {renderSegment('shark')}
          {renderSegment('agent')}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
  },
  toggleContainer: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 12,
    position: 'relative',
    overflow: 'hidden',
    height: 48,
  },
  slidingBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    borderRadius: 10,
    margin: 2,
  },
  segmentsContainer: {
    flexDirection: 'row',
    flex: 1,
    zIndex: 1,
  },
  segment: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
  },
  segmentContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentIcon: {
    marginRight: 4,
  },
  segmentText: {
    fontSize: 12,
    textAlign: 'center',
  },
}); 