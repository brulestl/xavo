# Expo Build Commands

## Prerequisites

1. Install EAS CLI:
```bash
npm install -g @expo/eas-cli
```

2. Login to Expo:
```bash
eas login
```

3. Configure project:
```bash
eas build:configure
```

## Build Commands

### Development Builds
```bash
# Android development build
eas build --platform android --profile development

# iOS development build
eas build --platform ios --profile development
```

### Preview Builds
```bash
# Android APK for testing
eas build --platform android --profile preview

# iOS simulator build
eas build --platform ios --profile preview
```

### Production Builds
```bash
# Android App Bundle for Google Play
eas build --platform android --profile production

# iOS App Store build
eas build --platform ios --profile production
```

### Both Platforms
```bash
# Build for both platforms simultaneously
eas build --platform all --profile production
```

## Submit to Stores

### Google Play Store
```bash
eas submit --platform android
```

### Apple App Store
```bash
eas submit --platform ios
```

## Configuration Notes

- **Android**: Builds generate AAB files for Google Play Store
- **iOS**: Requires Apple Developer account and certificates
- **Development**: Creates development client builds for testing
- **Preview**: Creates standalone APK/IPA for internal testing
- **Production**: Creates store-ready builds

## File Storage Setup

The app now supports file attachments with the following features:
- PDF, JPG, PNG file uploads (max 5MB)
- Supabase Storage integration
- Automatic file metadata tracking
- Secure file access with RLS policies

## Animation Fixes

All animations have been updated to use `useNativeDriver: false` to ensure compatibility across platforms without requiring native animation modules. 