#!/usr/bin/env node

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

console.log('🔑 Extracting SHA-1 fingerprint from debug keystore...\n');

const keystorePath = path.join(__dirname, 'android', 'app', 'debug.keystore');

if (!fs.existsSync(keystorePath)) {
    console.error('❌ Debug keystore not found at:', keystorePath);
    console.log('\n💡 Make sure you are running this from the project root directory.');
    process.exit(1);
}

console.log('📁 Found keystore at:', keystorePath);
console.log('⚠️  Note: This is a simplified extractor. For accurate results, use keytool.\n');

try {
    // Read the keystore file
    const keystoreData = fs.readFileSync(keystorePath);
    
    // Create a simple hash of the keystore (not the actual certificate SHA-1)
    const hash = crypto.createHash('sha1').update(keystoreData).digest('hex');
    const formattedHash = hash.toUpperCase().match(/.{1,2}/g).join(':');
    
    console.log('📋 Keystore Information:');
    console.log('------------------------');
    console.log('File size:', keystoreData.length, 'bytes');
    console.log('Keystore alias: androiddebugkey');
    console.log('Store password: android');
    console.log('Key password: android');
    console.log('Package name: com.xavo.influence');
    
    console.log('\n⚠️  WARNING: This is NOT the actual certificate SHA-1!');
    console.log('Keystore file hash:', formattedHash);
    
    console.log('\n🎯 To get the REAL SHA-1 fingerprint:');
    console.log('1. Install Java JDK from: https://adoptium.net/temurin/releases/');
    console.log('2. Run: keytool -keystore android/app/debug.keystore -list -v -alias androiddebugkey -storepass android -keypass android');
    console.log('3. Look for the "SHA1:" line in the output');
    
    console.log('\n📱 Alternative methods:');
    console.log('- Use Android Studio keystore viewer');
    console.log('- Upload keystore to: https://sha1fingerprint.com/');
    console.log('- Use Expo EAS: npx eas credentials:manager');
    
} catch (error) {
    console.error('❌ Error reading keystore:', error.message);
    console.log('\n💡 Make sure the keystore file is accessible and not corrupted.');
}

console.log('\n📝 Summary for Google Cloud Console:');
console.log('- Application type: Android');
console.log('- Package name: com.xavo.influence');
console.log('- SHA-1 fingerprint: [Get from keytool command above]'); 