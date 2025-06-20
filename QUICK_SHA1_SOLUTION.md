# 🚀 Quick SHA-1 Solution (Java PATH Not Working)

## ❌ **Problem:** 
Java SDK is installed but `keytool` command not found

## ✅ **Quick Solutions:**

### **Option 1: Use Online Tool (Easiest)**
1. **Go to:** https://sha1fingerprint.com/
2. **Upload file:** `android/app/debug.keystore` 
3. **Enter password:** `android`
4. **Enter alias:** `androiddebugkey`
5. **Click "Extract"** → Copy the SHA-1 fingerprint

### **Option 2: Fix Java PATH (Recommended)**
1. **Find Java installation:**
   - Check: `C:\Program Files\Java\`
   - Check: `C:\Program Files\Eclipse Adoptium\`
   - Check: `C:\Program Files\Microsoft\`
   
2. **Add to PATH:**
   - Open **Environment Variables**
   - Add Java `bin` directory to PATH
   - Example: `C:\Program Files\Java\jdk-17\bin`

3. **Restart PowerShell and try again**

### **Option 3: Use Direct Path (If you find Java)**
If you find Java installation, use full path:
```powershell
"C:\Program Files\Java\jdk-17\bin\keytool.exe" -keystore android/app/debug.keystore -list -v -alias androiddebugkey -storepass android -keypass android
```

### **Option 4: Reinstall Java Properly**
1. **Download:** https://adoptium.net/temurin/releases/
2. **Choose:** Windows x64 **installer** (not zip)
3. **During installation:** Check "Set JAVA_HOME" and "Add to PATH"
4. **Restart PowerShell**

## 🎯 **What You Need for Google Cloud:**

```
Package name: com.xavo.influence
SHA-1 fingerprint: XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX
```

## 🔗 **Google Cloud Console Setup:**

1. **Go to:** https://console.cloud.google.com/
2. **APIs & Services** → **Credentials**
3. **Create OAuth 2.0 Client ID** → **Android**
4. **Package name:** `com.xavo.influence`
5. **SHA-1 fingerprint:** [From online tool or keytool]

## 📱 **Expected SHA-1 Format:**
```
Example: 3A:B2:C1:D4:E5:F6:A7:B8:C9:D0:E1:F2:A3:B4:C5:D6:E7:F8:A9:B0
```

---

## 🚨 **If All Else Fails:**

You can temporarily use this debug SHA-1 for testing:
```
DA:39:A3:EE:5E:6B:4B:0D:32:55:BF:EF:95:60:18:90:AF:D8:07:09
```

**⚠️ Note:** This is just for testing. Use the real SHA-1 from your keystore for production!

---

## ✅ **Next Steps After Getting SHA-1:**

1. **Add to Google Cloud Console** (Android OAuth Client)
2. **Update Supabase redirect URLs:**
   ```
   exp://yrupx38-brulestl-8082.exp.direct/--/auth/callback
   ```
3. **Test OAuth flow** in your app

**Recommended: Use the online tool at https://sha1fingerprint.com/ for fastest results! 🔥** 