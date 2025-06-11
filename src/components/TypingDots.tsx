import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { useTheme } from '../providers/ThemeProvider';

interface TypingDotsProps {
  visible: boolean;
}

export const TypingDots: React.FC<TypingDotsProps> = ({ visible }) => {
  const { theme } = useTheme();
  const dot1Opacity = useRef(new Animated.Value(0.3)).current;
  const dot2Opacity = useRef(new Animated.Value(0.3)).current;
  const dot3Opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    if (!visible) {
      dot1Opacity.setValue(0.3);
      dot2Opacity.setValue(0.3);
      dot3Opacity.setValue(0.3);
      return;
    }

    const animateDots = () => {
      const duration = 600;
      const delay = 200;

      const createAnimation = (opacity: Animated.Value, delayTime: number) =>
        Animated.sequence([
          Animated.delay(delayTime),
          Animated.timing(opacity, {
            toValue: 1,
            duration: duration / 2,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0.3,
            duration: duration / 2,
            useNativeDriver: true,
          }),
        ]);

      Animated.loop(
        Animated.parallel([
          createAnimation(dot1Opacity, 0),
          createAnimation(dot2Opacity, delay),
          createAnimation(dot3Opacity, delay * 2),
        ])
      ).start();
    };

    animateDots();
  }, [visible, dot1Opacity, dot2Opacity, dot3Opacity]);

  if (!visible) return null;

  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      <View style={styles.dotsContainer}>
        <Animated.View
          style={[
            styles.dot,
            { backgroundColor: theme.textSecondary, opacity: dot1Opacity },
          ]}
        />
        <Animated.View
          style={[
            styles.dot,
            { backgroundColor: theme.textSecondary, opacity: dot2Opacity },
          ]}
        />
        <Animated.View
          style={[
            styles.dot,
            { backgroundColor: theme.textSecondary, opacity: dot3Opacity },
          ]}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignSelf: 'flex-start',
    marginVertical: 4,
    marginHorizontal: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderBottomLeftRadius: 4,
    maxWidth: '80%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 2,
  },
});