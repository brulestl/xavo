# 📊 Analytics & Crash Reporting Setup Guide

This guide will help you set up Amplitude analytics and Sentry crash reporting for the Xavo app.

## 🚀 Quick Start

The monitoring system has been implemented and is ready to use. You just need to configure the API keys.

## 📋 Prerequisites

1. **Amplitude Account**: Sign up at [amplitude.com](https://amplitude.com)
2. **Sentry Account**: Sign up at [sentry.io](https://sentry.io)

## 🔧 Configuration Steps

### 1. Get Your API Keys

#### Amplitude Setup:
1. Go to [Amplitude](https://amplitude.com) and create an account
2. Create a new project for "Xavo"
3. Copy your **API Key** from the project settings
4. Note: Use the **Project API Key**, not the Secret Key

#### Sentry Setup:
1. Go to [Sentry](https://sentry.io) and create an account
2. Create a new React Native project
3. Copy your **DSN** (Data Source Name) from the project settings
4. It should look like: `https://xxxxx@sentry.io/xxxxx`

### 2. Add API Keys to Your App

Update the `app.json` file with your actual API keys:

```json
{
  "expo": {
    "extra": {
      "amplitudeApiKey": "YOUR_ACTUAL_AMPLITUDE_API_KEY_HERE",
      "sentryDsn": "YOUR_ACTUAL_SENTRY_DSN_HERE"
    }
  }
}
```

**OR** use environment variables:

```bash
# .env file or environment
EXPO_PUBLIC_AMPLITUDE_API_KEY=your_amplitude_key_here
EXPO_PUBLIC_SENTRY_DSN=your_sentry_dsn_here
```

## 📊 What's Being Tracked

### Analytics Events (Amplitude)

**Authentication:**
- Sign Up Started/Completed
- Sign In Completed
- OAuth flows (Google/Apple)
- Logout

**Onboarding:**
- Onboarding Started/Completed
- Step-by-step progress

**App Usage:**
- Screen Views (Home, Chat, Settings, etc.)
- App Opens
- Feature Usage

**Monetization:**
- Paywall Views
- Subscription Plan Views
- Purchase Started/Completed/Failed
- Trial events

**Engagement:**
- Daily query limits reached
- Chat interactions
- Message sending

### Crash Reporting (Sentry)

**Automatic Capture:**
- JavaScript errors
- Unhandled promise rejections
- Native crashes (iOS/Android)
- Network errors

**Context Information:**
- User ID, email, tier
- Device information
- App version and build
- User actions (breadcrumbs)

## 🧪 Testing Your Setup

### 1. Check Console Logs

When you run the app, you should see:

```
🚀 App starting - initializing monitoring services...
📊 Initializing monitoring services...
📊 Initializing Amplitude analytics...
✅ Amplitude analytics initialized successfully
🚨 Initializing Sentry crash reporting...
✅ Sentry crash reporting initialized successfully
✅ Monitoring services initialized successfully
```

### 2. Verify in Dashboards

**Amplitude:**
1. Go to your Amplitude project
2. Check "Live View" to see real-time events
3. Look for events like "App Opened" and "Screen Viewed"

**Sentry:**
1. Go to your Sentry project
2. Check "Issues" for any reported errors
3. Check "Performance" for transaction data

### 3. Test Error Tracking

Add this to any screen for testing:

```typescript
import { monitoring } from '../services/monitoring';

// Test analytics
monitoring.trackScreenView('Test Screen', { test: true });

// Test error reporting
monitoring.trackError(new Error('Test error'), 'testing');
```

## 🔍 Debugging

### Common Issues:

1. **No events in Amplitude:**
   - Check API key is correct
   - Verify network connectivity
   - Check console for error messages

2. **No errors in Sentry:**
   - Check DSN is correct
   - Verify Sentry project is active
   - Test with a manual error

3. **Events not showing user data:**
   - Ensure user login is triggering `monitoring.setUser()`
   - Check user context is being set correctly

### Debug Commands:

You can test the monitoring services in the console:

```javascript
// In development, these are available globally:
secureStorageDebug.runSecurityCheck()
monitoring.runDiagnostics()
```

## 📈 Analytics Dashboard Recommended Setup

### Amplitude Recommendations:

1. **Key Charts to Create:**
   - Daily Active Users
   - User Journey Funnel (Sign Up → Onboarding → Purchase)
   - Feature Adoption Rates
   - Retention Cohorts

2. **Important Events to Monitor:**
   - Onboarding completion rate
   - Paywall conversion rate
   - Daily query usage patterns
   - Subscription churn

### Sentry Recommendations:

1. **Alerts to Set Up:**
   - New error types
   - Error rate spikes
   - Performance degradation

2. **Key Metrics to Track:**
   - Error-free session rate
   - App crash rate
   - Performance by device type

## 🔒 Privacy & Compliance

### Data Collection:

- **User Identifiable Information**: Only stored with explicit consent
- **IP Addresses**: Disabled in Amplitude configuration
- **Sensitive Data**: Never tracked (passwords, payment info, etc.)

### GDPR Compliance:

- Users can opt-out of analytics
- Data retention policies configured
- Right to data deletion supported

## 🚀 Production Deployment

### Before Going Live:

1. **Test thoroughly** in development
2. **Verify API keys** are production keys
3. **Set up monitoring alerts** in both platforms
4. **Configure data retention** policies
5. **Test error reporting** with real scenarios

### Monitoring Health:

- Check dashboard daily for anomalies
- Set up alerts for error rate spikes
- Monitor key conversion metrics
- Review user feedback and crash reports

## 🎯 Next Steps

1. **Configure your API keys** in `app.json`
2. **Test the implementation** with the debug commands
3. **Set up dashboards** in Amplitude and Sentry
4. **Configure alerts** for critical issues
5. **Monitor and iterate** based on data insights

## 🆘 Support

If you encounter issues:

1. Check the console logs for error messages
2. Verify your API keys are correct
3. Test with the built-in diagnostic tools
4. Review the Amplitude and Sentry documentation
5. Contact the platforms' support if needed

---

**Your app now has comprehensive analytics and crash reporting! 🎉**

The monitoring system will help you:
- Understand user behavior
- Identify and fix crashes quickly
- Optimize conversion funnels
- Make data-driven product decisions 