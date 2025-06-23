#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Character limits for different platforms
const LIMITS = {
  ios: {
    title: 30,
    subtitle: 30,
    description: 4000,
    keywords: 100, // total for all keywords
    releaseNotes: 4000
  },
  android: {
    title: 50,
    shortDescription: 80,
    fullDescription: 4000,
    releaseNotes: 500
  }
};

function validateMetadata() {
  const metadataPath = path.join(process.cwd(), 'store.json');
  
  console.log('🔍 Validating store metadata...\n');
  
  // Check if file exists
  if (!fs.existsSync(metadataPath)) {
    console.error('❌ store.json not found');
    process.exit(1);
  }
  
  // Parse JSON
  let metadata;
  try {
    const content = fs.readFileSync(metadataPath, 'utf8');
    metadata = JSON.parse(content);
  } catch (error) {
    console.error('❌ Invalid JSON syntax:', error.message);
    process.exit(1);
  }
  
  const errors = [];
  const warnings = [];
  
  // Validate iOS metadata
  if (metadata.apple && metadata.apple.info) {
    for (const [locale, info] of Object.entries(metadata.apple.info)) {
      console.log(`📱 Validating iOS metadata (${locale}):`);
      
      // Title
      if (info.title && info.title.length > LIMITS.ios.title) {
        errors.push(`iOS title too long: ${info.title.length}/${LIMITS.ios.title} chars`);
      } else {
        console.log(`  ✅ Title: ${info.title?.length || 0}/${LIMITS.ios.title} chars`);
      }
      
      // Subtitle
      if (info.subtitle && info.subtitle.length > LIMITS.ios.subtitle) {
        errors.push(`iOS subtitle too long: ${info.subtitle.length}/${LIMITS.ios.subtitle} chars`);
      } else {
        console.log(`  ✅ Subtitle: ${info.subtitle?.length || 0}/${LIMITS.ios.subtitle} chars`);
      }
      
      // Description
      if (info.description && info.description.length > LIMITS.ios.description) {
        errors.push(`iOS description too long: ${info.description.length}/${LIMITS.ios.description} chars`);
      } else {
        console.log(`  ✅ Description: ${info.description?.length || 0}/${LIMITS.ios.description} chars`);
      }
      
      // Keywords
      if (info.keywords) {
        const keywordString = info.keywords.join(',');
        if (keywordString.length > LIMITS.ios.keywords) {
          errors.push(`iOS keywords too long: ${keywordString.length}/${LIMITS.ios.keywords} chars`);
        } else {
          console.log(`  ✅ Keywords: ${keywordString.length}/${LIMITS.ios.keywords} chars`);
        }
      }
      
      // Release Notes
      if (info.releaseNotes && info.releaseNotes.length > LIMITS.ios.releaseNotes) {
        errors.push(`iOS release notes too long: ${info.releaseNotes.length}/${LIMITS.ios.releaseNotes} chars`);
      } else {
        console.log(`  ✅ Release Notes: ${info.releaseNotes?.length || 0}/${LIMITS.ios.releaseNotes} chars`);
      }
      
      // Validate URLs
      const urls = ['marketingUrl', 'supportUrl', 'privacyPolicyUrl'];
      urls.forEach(urlField => {
        if (info[urlField] && !isValidUrl(info[urlField])) {
          warnings.push(`iOS ${urlField} may not be a valid URL: ${info[urlField]}`);
        } else if (info[urlField]) {
          console.log(`  ✅ ${urlField}: Valid URL format`);
        }
      });
    }
  }
  
  // Validate Android metadata
  if (metadata.googlePlay && metadata.googlePlay.info) {
    for (const [locale, info] of Object.entries(metadata.googlePlay.info)) {
      console.log(`\n🤖 Validating Android metadata (${locale}):`);
      
      // Title
      if (info.title && info.title.length > LIMITS.android.title) {
        errors.push(`Android title too long: ${info.title.length}/${LIMITS.android.title} chars`);
      } else {
        console.log(`  ✅ Title: ${info.title?.length || 0}/${LIMITS.android.title} chars`);
      }
      
      // Short Description
      if (info.shortDescription && info.shortDescription.length > LIMITS.android.shortDescription) {
        errors.push(`Android short description too long: ${info.shortDescription.length}/${LIMITS.android.shortDescription} chars`);
      } else {
        console.log(`  ✅ Short Description: ${info.shortDescription?.length || 0}/${LIMITS.android.shortDescription} chars`);
      }
      
      // Full Description
      if (info.fullDescription && info.fullDescription.length > LIMITS.android.fullDescription) {
        errors.push(`Android full description too long: ${info.fullDescription.length}/${LIMITS.android.fullDescription} chars`);
      } else {
        console.log(`  ✅ Full Description: ${info.fullDescription?.length || 0}/${LIMITS.android.fullDescription} chars`);
      }
      
      // Release Notes
      if (info.releaseNotes && info.releaseNotes.length > LIMITS.android.releaseNotes) {
        errors.push(`Android release notes too long: ${info.releaseNotes.length}/${LIMITS.android.releaseNotes} chars`);
      } else {
        console.log(`  ✅ Release Notes: ${info.releaseNotes?.length || 0}/${LIMITS.android.releaseNotes} chars`);
      }
    }
  }
  
  // Check for required screenshots
  console.log('\n📸 Checking screenshots:');
  const iosScreenshotDir = path.join(process.cwd(), 'store', 'screenshots', 'ios');
  const androidScreenshotDir = path.join(process.cwd(), 'store', 'screenshots', 'android');
  
  if (fs.existsSync(iosScreenshotDir)) {
    const iosScreenshots = fs.readdirSync(iosScreenshotDir).filter(f => f.match(/\.(png|jpg|jpeg)$/i));
    console.log(`  📱 iOS screenshots: ${iosScreenshots.length} found`);
    if (iosScreenshots.length === 0) {
      warnings.push('No iOS screenshots found');
    }
  } else {
    warnings.push('iOS screenshots directory not found');
  }
  
  if (fs.existsSync(androidScreenshotDir)) {
    const androidScreenshots = fs.readdirSync(androidScreenshotDir).filter(f => f.match(/\.(png|jpg|jpeg)$/i));
    console.log(`  🤖 Android screenshots: ${androidScreenshots.length} found`);
    if (androidScreenshots.length === 0) {
      warnings.push('No Android screenshots found');
    }
  } else {
    warnings.push('Android screenshots directory not found');
  }
  
  // Summary
  console.log('\n📋 Validation Summary:');
  
  if (errors.length > 0) {
    console.log('\n❌ Errors:');
    errors.forEach(error => console.log(`  • ${error}`));
  }
  
  if (warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    warnings.forEach(warning => console.log(`  • ${warning}`));
  }
  
  if (errors.length === 0 && warnings.length === 0) {
    console.log('✅ All metadata validation checks passed!');
  } else if (errors.length === 0) {
    console.log('✅ No errors found, only warnings.');
  }
  
  // Exit with error code if there are errors
  if (errors.length > 0) {
    process.exit(1);
  }
}

function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

// Run validation
validateMetadata(); 