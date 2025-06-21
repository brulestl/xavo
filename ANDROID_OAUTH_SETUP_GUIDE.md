# 🔧 **Android OAuth Setup Guide (FIXED CONFIG)**

## ✅ **Configuration Fixed!**

Your Android configuration now matches `app.json`:
- **Package:** `com.xavo.influence`
- **Scheme:** `xavo`
- **Configuration:** ✅ Synchronized

---

## 🔗 **Google Cloud Console Setup**

### **1. Create Android OAuth Client**

**Go to:** https://console.cloud.google.com/apis/credentials

**Click:** "Create Credentials" → "OAuth 2.0 Client ID" → "Android"

**Enter these EXACT values:**

```
Application type: Android
Name: Xavo Influence Android
Package name: com.xavo.influence
SHA-1 certificate fingerprint: [YOUR SHA-1 FROM KEYTOOL]
```

### **2. Get SHA-1 Fingerprint**

**Use online tool:** https://sha1fingerprint.com/
- **Upload:** `android/app/debug.keystore`
- **Password:** `android`
- **Alias:** `androiddebugkey`
- **Copy the SHA-1 result**

---

## 🟩 **Supabase Redirect URLs**

### **Add these URLs in Supabase Dashboard:**

**Authentication → URL Configuration → Redirect URLs**

**For Development (Expo Go):**
```
exp://yrupx38-brulestl-8082.exp.direct/--/auth/callback
http://localhost:19006/auth/callback
```

**For Production (Standalone App):**
```
xavo://auth/callback
com.xavo.influence://auth/callback
```

---

## 🎯 **Complete Redirect URI List**

### **Google Cloud Console:**
```
Package name: com.xavo.influence
SHA-1: [Your extracted fingerprint]
```

### **Supabase:**
```
exp://yrupx38-brulestl-8082.exp.direct/--/auth/callback
xavo://auth/callback
com.xavo.influence://auth/callback
http://localhost:19006/auth/callback
```

---

## 🧪 **Test Your Setup**

1. **Get SHA-1** from https://sha1fingerprint.com/
2. **Add to Google Cloud** with package `com.xavo.influence`
3. **Add redirect URLs** to Supabase
4. **Build and test:**
   ```bash
   npx expo run:android
   ```

---

## 🚀 **Next Steps**

1. ✅ **Configuration Fixed** - Done!
2. 🔑 **Get SHA-1** - Use online tool
3. ☁️ **Setup Google Cloud** - Add Android OAuth client
4. 🟩 **Setup Supabase** - Add redirect URLs
5. 🧪 **Test OAuth flow** - Should work perfectly!

**Your app is now properly configured for Android OAuth! 🎉** 