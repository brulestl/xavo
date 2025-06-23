# 🔧 Supabase OAuth Configuration for Mobile

## 📱 **Redirect URLs to Add in Supabase Dashboard**

### **1. Go to Supabase Dashboard**
- Navigate to your project: https://app.supabase.com/project/your-project
- Go to **Authentication** → **URL Configuration**

### **2. Add These Redirect URLs:**

```
# For Expo Go Development (Tunnel Mode)
exp://yrupx38-brulestl-8082.exp.direct/--/auth/callback

# For Expo Go Development (LAN Mode - if using --host lan)
exp://192.168.1.100:8082/--/auth/callback

# For Local Development
exp://localhost:8082/--/auth/callback

# For Production (when you build the app)
xavo://auth/callback

# Keep your existing web URL
http://localhost:8081/auth/callback
https://your-production-domain.com/auth/callback
```

### **3. Site URL Configuration:**
Also add these to **Site URL** field:
```
exp://yrupx38-brulestl-8082.exp.direct
exp://localhost:8082
xavo://
```

## 🔗 **Google OAuth Console Configuration**

### **1. Go to Google Cloud Console**
- Navigate to: https://console.cloud.google.com/
- Select your project → **APIs & Services** → **Credentials**
- Click on your OAuth 2.0 Client ID

### **2. Add Authorized Redirect URIs:**
```
# Add these to the "Authorized redirect URIs" section:
https://wdhmlynmbrhunizbdhdt.supabase.co/auth/v1/callback
exp://yrupx38-brulestl-8082.exp.direct/--/auth/callback
exp://localhost:8082/--/auth/callback
xavo://auth/callback
```

## 🚀 **Quick Fix Steps:**

1. **Copy the tunnel URL from your terminal:** `exp://yrupx38-brulestl-8082.exp.direct`
2. **Add to Supabase:** `exp://yrupx38-brulestl-8082.exp.direct/--/auth/callback`
3. **Add to Google OAuth:** Same URL
4. **Restart Expo:** `npx expo start --tunnel --clear`
5. **Test OAuth:** Should now redirect back to app!

## 🔍 **How to Find Your Current Tunnel URL:**

Look in your terminal for:
```
› Metro waiting on exp://yrupx38-brulestl-8082.exp.direct
```

Replace `yrupx38-brulestl-8082` with your actual tunnel subdomain.

## ✅ **Expected Flow After Fix:**

1. User taps "Continue with Google"
2. Browser opens → Google account selection
3. User chooses account → Google OAuth
4. **Redirects back to Expo Go app** (not localhost!)
5. User lands on authenticated HomeScreen

The key is using `exp://` scheme for Expo Go instead of `http://localhost` for web! 