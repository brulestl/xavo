import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../providers/ThemeProvider';

/**
 * Demo component showcasing ThemeProvider functionality
 * This can be temporarily added to any screen to test theme features
 */
export const ThemeDemo: React.FC = () => {
  const { 
    theme, 
    isDark, 
    toggleTheme,
    getBackgroundClass,
    getCardBackgroundClass,
    getTextPrimaryClass,
    getPrimaryButtonClass 
  } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.getBackgroundColor() }]}>
      <View style={[styles.card, { backgroundColor: theme.getCardBackgroundColor() }]}>
        <Text style={[styles.title, { color: theme.getPrimaryTextColor() }]}>
          Theme Demo
        </Text>
        
        <Text style={[styles.subtitle, { color: theme.getSecondaryTextColor() }]}>
          Current Mode: {isDark ? 'Dark' : 'Light'}
        </Text>

        <View style={styles.tokenDisplay}>
          <Text style={[styles.label, { color: theme.getPrimaryTextColor() }]}>
            Theme Tokens:
          </Text>
          <Text style={[styles.value, { color: theme.getSecondaryTextColor() }]}>
            Background: {theme.getBackgroundColor()}
          </Text>
          <Text style={[styles.value, { color: theme.getSecondaryTextColor() }]}>
            Card: {theme.getCardBackgroundColor()}
          </Text>
          <Text style={[styles.value, { color: theme.getSecondaryTextColor() }]}>
            Accent: {theme.getAccentColor()}
          </Text>
        </View>

        <View style={styles.classDisplay}>
          <Text style={[styles.label, { color: theme.getPrimaryTextColor() }]}>
            Tailwind Classes:
          </Text>
          <Text style={[styles.value, { color: theme.getSecondaryTextColor() }]}>
            Background: {getBackgroundClass()}
          </Text>
          <Text style={[styles.value, { color: theme.getSecondaryTextColor() }]}>
            Card: {getCardBackgroundClass()}
          </Text>
          <Text style={[styles.value, { color: theme.getSecondaryTextColor() }]}>
            Text: {getTextPrimaryClass()}
          </Text>
          <Text style={[styles.value, { color: theme.getSecondaryTextColor() }]}>
            Button: {getPrimaryButtonClass()}
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.button,
            theme.getPrimaryButtonStyle(),
            { borderRadius: 999 } // rounded-full
          ]}
          onPress={toggleTheme}
        >
          <Text style={styles.buttonText}>
            Toggle to {isDark ? 'Light' : 'Dark'} Mode
          </Text>
        </TouchableOpacity>

        <View style={styles.colorSwatches}>
          <Text style={[styles.label, { color: theme.getPrimaryTextColor() }]}>
            Color Palette:
          </Text>
          <View style={styles.swatchRow}>
            <View style={[styles.swatch, { backgroundColor: theme.colors.platinum }]} />
            <Text style={[styles.swatchLabel, { color: theme.getSecondaryTextColor() }]}>
              Platinum
            </Text>
          </View>
          <View style={styles.swatchRow}>
            <View style={[styles.swatch, { backgroundColor: theme.colors.alabaster }]} />
            <Text style={[styles.swatchLabel, { color: theme.getSecondaryTextColor() }]}>
              Alabaster
            </Text>
          </View>
          <View style={styles.swatchRow}>
            <View style={[styles.swatch, { backgroundColor: theme.colors.saffron }]} />
            <Text style={[styles.swatchLabel, { color: theme.getSecondaryTextColor() }]}>
              Saffron
            </Text>
          </View>
          <View style={styles.swatchRow}>
            <View style={[styles.swatch, { backgroundColor: theme.colors.eerieBlack }]} />
            <Text style={[styles.swatchLabel, { color: theme.getSecondaryTextColor() }]}>
              Eerie Black
            </Text>
          </View>
          <View style={styles.swatchRow}>
            <View style={[styles.swatch, { backgroundColor: theme.colors.jet }]} />
            <Text style={[styles.swatchLabel, { color: theme.getSecondaryTextColor() }]}>
              Jet
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  card: {
    padding: 20,
    borderRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  tokenDisplay: {
    marginBottom: 20,
  },
  classDisplay: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  value: {
    fontSize: 14,
    marginLeft: 8,
    marginBottom: 4,
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    alignSelf: 'center',
    marginBottom: 20,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  colorSwatches: {
    marginTop: 10,
  },
  swatchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  swatch: {
    width: 20,
    height: 20,
    borderRadius: 4,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  swatchLabel: {
    fontSize: 14,
  },
});