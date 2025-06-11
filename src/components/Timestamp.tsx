import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { format, isToday, isYesterday, formatDistanceToNow } from 'date-fns';
import { useTheme } from '../providers/ThemeProvider';

interface TimestampProps {
  timestamp: string | Date;
  style?: any;
  showRelative?: boolean;
}

export const Timestamp: React.FC<TimestampProps> = ({
  timestamp,
  style,
  showRelative = false,
}) => {
  const { theme } = useTheme();
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;

  const formatTimestamp = (date: Date): string => {
    if (showRelative) {
      return formatDistanceToNow(date, { addSuffix: true });
    }

    if (isToday(date)) {
      return format(date, 'h:mm a');
    }
    
    if (isYesterday(date)) {
      return `Yesterday ${format(date, 'h:mm a')}`;
    }
    
    return format(date, 'MMM d, h:mm a');
  };

  return (
    <Text style={[
      styles.timestamp,
      { color: theme.textSecondary },
      style
    ]}>
      {formatTimestamp(date)}
    </Text>
  );
};

const styles = StyleSheet.create({
  timestamp: {
    fontSize: 12,
    fontWeight: '400',
  },
});