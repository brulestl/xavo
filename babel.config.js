module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Temporarily disabled due to compatibility issue with Expo SDK 53
      // See: https://github.com/expo/expo/issues/36761
      // ['nativewind/babel', {}]
    ],
  };
};