# 🔑 Get SHA-1 Fingerprint for Google Cloud Android OAuth

## 🚀 **Quick Solution - Install Java JDK**

### **Option 1: Install Java JDK (Recommended)**
1. **Download Java JDK:** https://adoptium.net/temurin/releases/
2. **Install it** (choose the Windows installer)
3. **Run this command:**
   ```bash
   keytool -keystore android\app\debug.keystore -list -v -alias androiddebugkey -storepass android -keypass android
   ```

### **Option 2: Use Android Studio (If Installed)**
1. **Open Terminal in Android Studio**
2. **Navigate to your project directory**
3. **Run the same keytool command**

### **Option 3: Use Expo EAS (Easiest)**
```bash
npx eas credentials:manager
# Select Android → Production/Development → Keystore → View details
```

## 📋 **Manual Method (Your Current Keystore)**

Your debug keystore is located at: `android/app/debug.keystore`

**Default credentials:**
- **Keystore password:** `android`
- **Key alias:** `androiddebugkey`
- **Key password:** `android`

## 🎯 **What You Need for Google Cloud Console**

You need to get this information from the keystore:
```
Certificate fingerprint (SHA1): XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX
```

## 🔧 **Complete Google Cloud Setup**

### **1. Go to Google Cloud Console**
- Navigate to: https://console.cloud.google.com/
- Select your project
- Go to **APIs & Services** → **Credentials**

### **2. Create Android OAuth Client ID**
1. **Click "Create Credentials"** → **OAuth 2.0 Client ID**
2. **Application type:** Android
3. **Name:** Your app name
4. **Package name:** `com.xavo.influence` (from your app.json)
5. **SHA-1 certificate fingerprint:** [The fingerprint you extracted]

### **3. Expected SHA-1 Format**
```
XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX
```

## 🚨 **If Java Installation Fails**

### **Alternative: Use Online Tool**
1. **Upload your keystore** to: https://sha1fingerprint.com/
2. **Use password:** `android`
3. **Use alias:** `androiddebugkey`
4. **Copy the SHA-1 fingerprint**

### **Alternative: Use Android Studio**
If you have Android Studio installed:
1. **Go to Build** → **Generate Signed Bundle/APK**
2. **Choose existing keystore:** `android/app/debug.keystore`
3. **View certificate details** to see SHA-1

## ✅ **After Getting SHA-1**

### **1. Add to Google Cloud Console:**
- **Package name:** `com.xavo.influence`
- **SHA-1 fingerprint:** [Your extracted fingerprint]

### **2. Update Supabase Configuration:**
Add these redirect URLs:
```
exp://yrupx38-brulestl-8082.exp.direct/--/auth/callback
https://wdhmlynmbrhunizbdhdt.supabase.co/auth/v1/callback
```

### **3. Test OAuth Flow:**
1. **Restart Expo:** `npx expo start --tunnel --clear`
2. **Try Google OAuth** - should now work on Android!

## 📱 **For Production Release**

When you build for production with EAS:
```bash
eas build --platform android --profile production
```

EAS will generate a new keystore with different SHA-1 fingerprint. You'll need to:
1. **Get the production SHA-1** from EAS credentials
2. **Add it to Google Cloud Console**
3. **Update package name** if different

---

## 🎯 **Next Step**

**Download Java JDK from:** https://adoptium.net/temurin/releases/

Then run:
```bash
keytool -keystore android\app\debug.keystore -list -v -alias androiddebugkey -storepass android -keypass android
```

Look for the **"SHA1:"** line in the output! 🔍 