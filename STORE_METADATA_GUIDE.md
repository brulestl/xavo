# EAS Metadata Management Guide

This guide explains how to manage your App Store Connect and Google Play Console listings using EAS Metadata, enabling version-controlled store management and automated updates.

## Overview

EAS Metadata allows you to:
- ✅ Version-control store listings alongside your code
- ✅ Automatically update store descriptions when publishing
- ✅ Maintain consistency across platforms
- ✅ Track changes to store metadata over time
- ✅ Collaborate on store content through Git workflows

## File Structure

```
├── store.json                 # Main metadata configuration
├── store/
│   ├── privacy-policy.md     # Privacy policy content
│   └── screenshots/
│       ├── ios/              # iOS App Store screenshots
│       └── android/          # Google Play Store screenshots
└── eas.json                  # EAS configuration with metadata paths
```

## Metadata Configuration

### Main Configuration (`store.json`)

The `store.json` file contains all your store listing information:

- **Apple App Store**: Descriptions, keywords, categories, URLs
- **Google Play Store**: Descriptions, categories, content ratings
- **Localization**: Support for multiple languages (currently en-US)

### Key Sections

#### Apple App Store (`apple` section)
- `title`: App name (30 chars max)
- `subtitle`: Short description (30 chars max)
- `description`: Full app description (4000 chars max)
- `keywords`: Search keywords (100 chars max, comma-separated)
- `categories`: Primary and secondary app categories
- `releaseNotes`: What's new in this version

#### Google Play Store (`googlePlay` section)
- `title`: App name (50 chars max)
- `shortDescription`: Brief description (80 chars max)
- `fullDescription`: Detailed description (4000 chars max)
- `categories`: App category and tags
- `releaseNotes`: What's new in this version

## Managing Screenshots

### iOS Screenshots
Place iOS screenshots in `store/screenshots/ios/`:
- **Required sizes**: 6.7", 6.5", 5.5" displays
- **Format**: PNG or JPEG
- **Naming convention**: `screenshot-1.png`, `screenshot-2.png`, etc.

### Android Screenshots
Place Android screenshots in `store/screenshots/android/`:
- **Required sizes**: Phone and tablet
- **Format**: PNG or JPEG (24-bit RGB, no alpha)
- **Dimensions**: 320px - 3840px for width/height

## Workflow

### 1. Making Changes

1. **Edit Metadata**: Update `store.json` with new descriptions, keywords, or release notes
2. **Update Screenshots**: Replace files in `store/screenshots/` directories
3. **Test Locally**: Validate JSON syntax and character limits
4. **Commit Changes**: Add changes to Git

```bash
git add store.json store/screenshots/
git commit -m "Update store metadata for v1.1.0"
```

### 2. Publishing Updates

When you build and submit your app, EAS automatically uses the metadata:

```bash
# Build and submit to stores with metadata
eas submit --platform all

# Or submit to specific platform
eas submit --platform ios
eas submit --platform android
```

### 3. Version-Specific Updates

For release-specific changes:

1. Update `releaseNotes` in `store.json`
2. Ensure `version` in `app.json` matches your release
3. Build and submit

## Best Practices

### Content Guidelines

1. **Keywords**: Use relevant, searchable terms
2. **Descriptions**: Focus on benefits, not just features
3. **Release Notes**: Be specific about improvements
4. **Screenshots**: Show key app features and UI

### Character Limits

- **iOS Title**: 30 characters
- **iOS Subtitle**: 30 characters
- **iOS Keywords**: 100 characters total
- **Android Title**: 50 characters
- **Android Short Description**: 80 characters
- **Descriptions**: 4000 characters (both platforms)

### SEO Optimization

1. **Research Keywords**: Use App Store Connect and Google Play Console analytics
2. **A/B Testing**: Test different descriptions and keywords
3. **Localization**: Consider translating for key markets
4. **Regular Updates**: Refresh content quarterly

## Automation Scripts

### Validate Metadata
```bash
# Check JSON syntax and character limits
node scripts/validate-metadata.js
```

### Update Release Notes
```bash
# Auto-generate release notes from git commits
node scripts/generate-release-notes.js
```

## Troubleshooting

### Common Issues

1. **Character Limit Exceeded**: Use the validation script to check limits
2. **Invalid JSON**: Validate syntax with a JSON linter
3. **Missing Screenshots**: Ensure all required sizes are present
4. **URL Validation**: Verify all URLs are accessible

### EAS Submit Errors

- **Missing Apple ID**: Update `appleId` in `eas.json`
- **Invalid Service Account**: Check Android `serviceAccountKeyPath`
- **Metadata Path Error**: Ensure `store.json` exists and is valid

## Privacy Policy Setup

1. Host the privacy policy on your website at `/privacy`
2. Update `privacyPolicyUrl` in `store.json`
3. Ensure the URL is accessible and matches store requirements

## Multi-Language Support

To add support for additional languages:

1. Add language codes to the `info` sections
2. Translate all text content
3. Add localized screenshots to subdirectories

Example:
```json
{
  "apple": {
    "info": {
      "en-US": { ... },
      "es-ES": { ... },
      "fr-FR": { ... }
    }
  }
}
```

## Monitoring and Analytics

1. **App Store Connect**: Monitor keyword rankings and conversion rates
2. **Google Play Console**: Track store listing performance
3. **A/B Testing**: Test different metadata variations
4. **User Feedback**: Monitor reviews for content insights

## Next Steps

1. ✅ Set up your Apple Developer and Google Play Console accounts
2. ✅ Update the Apple ID and service account path in `eas.json`
3. ✅ Host your privacy policy on your website
4. ✅ Create and upload optimized screenshots
5. ✅ Test the submission process with a preview build
6. ✅ Set up automated workflows for regular updates

---

For more information, visit the [EAS Submit documentation](https://docs.expo.dev/submit/introduction/). 