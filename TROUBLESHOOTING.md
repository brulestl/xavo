# Troubleshooting Guide

## Issue 1: "Failed to download remote update" in Expo Go

### **Root Cause:**
This usually happens due to network issues, cache problems, or missing update configuration.

### **Solutions:**

#### **Option A: Use Tunnel Mode (Recommended)**
```bash
npx expo start --tunnel --clear
```
- `--tunnel` bypasses network/firewall issues
- `--clear` clears Metro bundler cache

#### **Option B: Reset Development Environment**
```bash
# Clear all caches
npx expo start --clear
npx react-native start --reset-cache

# Or use development build
npx expo start --dev-client
```

#### **Option C: Use Local Network**
```bash
# Find your local IP
ipconfig

# Start with specific host
npx expo start --host lan
```

---

## Issue 2: "No compatible apps connected" / Hermes Debug Issue

### **Root Cause:**
React Native DevTools requires Hermes engine and proper connection setup.

### **Solutions:**

#### **Option A: Use Expo DevTools Instead**
```bash
# Start with Expo DevTools
npx expo start --devtools

# Or open in browser
npx expo start
# Then press 'w' to open web interface
```

#### **Option B: Enable Hermes (if needed)**
Add to `app.json`:
```json
{
  "expo": {
    "jsEngine": "hermes"
  }
}
```

#### **Option C: Use Flipper for Debugging**
```bash
# Install Flipper
npm install --save-dev react-native-flipper

# Start with Flipper
npx react-native start --reset-cache
```

---

## Issue 3: Windows Permission Errors (EPERM)

### **Root Cause:**
Windows file permissions or antivirus blocking npm operations.

### **Solutions:**

#### **Option A: Run as Administrator**
1. Open PowerShell as Administrator
2. Navigate to project: `cd C:\Users\fjank\Documents\influence`
3. Run commands with elevated permissions

#### **Option B: Use Yarn Instead**
```bash
# Install yarn globally
npm install -g yarn

# Use yarn for all operations
yarn install
yarn expo start --tunnel
```

#### **Option C: Exclude from Antivirus**
1. Add project folder to antivirus exclusions
2. Add `node_modules` folder to exclusions
3. Restart terminal and try again

---

## Quick Fix Commands

### **Complete Reset:**
```bash
# Stop all processes
taskkill /f /im node.exe

# Clean everything
rmdir /s /q node_modules
del package-lock.json
npm cache clean --force

# Reinstall
npm install
npx expo start --tunnel --clear
```

### **Alternative with Yarn:**
```bash
# Install yarn
npm install -g yarn

# Clean and reinstall
yarn install
yarn expo start --tunnel
```

### **Android Specific:**
```bash
# Clear Android cache
npx expo start --android --clear

# Or use development build
eas build --platform android --profile development
```

---

## Testing the Fixes

1. **Start Development Server:**
   ```bash
   npx expo start --tunnel --clear
   ```

2. **Open Expo Go App:**
   - Scan QR code from terminal
   - Or enter URL manually

3. **If still failing:**
   - Try `npx expo start --lan`
   - Try `npx expo start --localhost`
   - Try restarting phone/computer

4. **For Debugging:**
   - Press `j` in terminal to open debugger
   - Press `w` to open web interface
   - Use Expo DevTools instead of React Native DevTools

---

## Network Configuration

### **Update app.json for better connectivity:**
```json
{
  "expo": {
    "updates": {
      "fallbackToCacheTimeout": 0
    },
    "runtimeVersion": {
      "policy": "appVersion"
    }
  }
}
```

### **Check Firewall Settings:**
- Allow Node.js through Windows Firewall
- Allow Expo CLI through Windows Firewall
- Check corporate network restrictions

---

## Final Resort: Development Build

If Expo Go continues to fail, create a development build:

```bash
# Configure EAS
npx expo install expo-dev-client
eas build:configure

# Build development client
eas build --platform android --profile development

# Install on device and use instead of Expo Go
``` 