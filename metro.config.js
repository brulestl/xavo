const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add resolver for Node.js polyfills
config.resolver.alias = {
  ...config.resolver.alias,
  crypto: require.resolve('react-native-get-random-values'),
  stream: require.resolve('readable-stream'),
  buffer: require.resolve('buffer'),
};

// Ensure Buffer is available globally
config.resolver.platforms = ['ios', 'android', 'native', 'web'];

module.exports = config; 