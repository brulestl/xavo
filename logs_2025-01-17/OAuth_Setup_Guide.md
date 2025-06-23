# OAuth Setup Guide for Google and LinkedIn Authentication

## Overview
This guide will help you configure Google and LinkedIn OAuth authentication for your React Native app using Supabase.

## Prerequisites
- Supabase project set up
- Google Developer Console account
- LinkedIn Developer account
- React Native app with Expo

## Step 1: Configure OAuth Providers in Supabase

### 1.1 Access Supabase Dashboard
1. Go to your Supabase project dashboard
2. Navigate to **Authentication** → **Providers**

### 1.2 Configure Google Provider
1. Enable the **Google** provider
2. You'll need to configure:
   - **Client ID** (from Google Console)
   - **Client Secret** (from Google Console)
   - **Redirect URL**: This should be: `https://wdhmlynmbrhunizbdhdt.supabase.co/auth/v1/callback`

### 1.3 Configure LinkedIn Provider
1. Enable the **LinkedIn** provider
2. You'll need to configure:
   - **Client ID** (from LinkedIn Developer)
   - **Client Secret** (from LinkedIn Developer)
   - **Redirect URL**: This should be: `https://wdhmlynmbrhunizbdhdt.supabase.co/auth/v1/callback`

## Step 2: Configure Google OAuth

### 2.1 Google Developer Console
1. Go to [Google Developer Console](https://console.developers.google.com/)
2. Create a new project or select existing one
3. Enable **Google+ API** or **People API**
4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client IDs**
5. Configure for **Web application**
6. Add authorized redirect URIs:
   - `https://wdhmlynmbrhunizbdhdt.supabase.co/auth/v1/callback`
   - For web testing: `http://localhost:8081/auth/callback`
   - For Expo web testing: `http://localhost:19006/auth/callback`

### 2.2 Mobile Configuration (Additional)
For mobile apps, you may also need to create:
1. **Android OAuth client**:
   - Package name: `com.xavo.influence`
   - SHA-1 certificate fingerprint (get from `expo credentials:manager`)
2. **iOS OAuth client**:
   - Bundle ID: `com.xavo.influence`

## Step 3: Configure LinkedIn OAuth

### 3.1 LinkedIn Developer Portal
1. Go to [LinkedIn Developer Portal](https://developer.linkedin.com/)
2. Create a new app or select existing one
3. In **Auth** tab, add redirect URLs:
   - `https://wdhmlynmbrhunizbdhdt.supabase.co/auth/v1/callback`
   - For web testing: `http://localhost:8081/auth/callback`
   - For Expo web testing: `http://localhost:19006/auth/callback`
4. Request required scopes:
   - `r_liteprofile` (basic profile)
   - `r_emailaddress` (email address)

## Step 4: Update Your App Configuration

### 4.1 Environment Variables
Create a `.env` file in your project root:
```
EXPO_PUBLIC_SUPABASE_URL=https://wdhmlynmbrhunizbdhdt.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

### 4.2 Deep Link Configuration
Your `app.json` is already configured with the correct scheme (`xavo`), but ensure you have:

```json
{
  "expo": {
    "scheme": "xavo",
    "ios": {
      "bundleIdentifier": "com.xavo.influence",
      "infoPlist": {
        "CFBundleURLTypes": [
          {
            "CFBundleURLName": "xavo-auth",
            "CFBundleURLSchemes": ["xavo"]
          }
        ]
      }
    },
    "android": {
      "package": "com.xavo.influence",
      "intentFilters": [
        {
          "action": "VIEW",
          "data": [{"scheme": "xavo"}],
          "category": ["BROWSABLE", "DEFAULT"]
        }
      ]
    }
  }
}
```

## Step 5: Testing the OAuth Flow

### 5.1 Test on Development
1. Run `npx expo start`
2. Try the Google/LinkedIn authentication buttons
3. Check the console logs for any errors

### 5.2 Common Issues and Solutions

#### Issue: "popup_closed_by_user"
- **Solution**: User cancelled the authentication. This is normal behavior.

#### Issue: "Invalid redirect URI"
- **Solution**: Ensure the redirect URI in your OAuth provider (Google/LinkedIn) matches exactly: `https://wdhmlynmbrhunizbdhdt.supabase.co/auth/v1/callback`

#### Issue: "Network error"
- **Solution**: Check internet connection and ensure Supabase URL is correct.

#### Issue: OAuth button not responding
- **Solution**: Check if all required packages are installed:
  ```bash
  npx expo install expo-auth-session expo-crypto expo-web-browser
  ```

### 5.3 Debug Information
The app now logs OAuth debug information. Check your console for:
- Redirect URI being used
- OAuth provider responses
- Any authentication errors

## Step 6: Production Deployment

### 6.1 Update Redirect URIs
When deploying to production, add your production URLs to the OAuth providers:
- Google Console: Add your production domain
- LinkedIn Developer: Add your production domain
- Supabase: Should work automatically with the same callback URL

### 6.2 Environment Variables
Ensure your production environment has the correct Supabase credentials set.

## Troubleshooting Checklist

- [ ] Google OAuth client is configured with correct redirect URI
- [ ] LinkedIn app is configured with correct redirect URI
- [ ] Supabase providers are enabled with correct client ID/secret
- [ ] App scheme is correctly configured in app.json
- [ ] Required Expo packages are installed
- [ ] Environment variables are set correctly
- [ ] Network connectivity is working

## Additional Notes

1. **Testing on Physical Devices**: OAuth should work on both simulators and physical devices.
2. **Web Testing**: When testing on web (`npx expo start --web`), the OAuth flow will open in the same browser window.
3. **Deep Linking**: The app uses the `xavo://` scheme for deep linking back after OAuth completion.

If you continue to have issues, check the Expo and Supabase documentation for the latest OAuth setup instructions, as these services are frequently updated. 