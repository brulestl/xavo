import React from 'react';
import { Platform } from 'react-native';

// Safely import amplitude with error handling
let amplitude: any = null;

try {
  amplitude = require('@amplitude/analytics-react-native');
} catch (error) {
  console.warn('⚠️ @amplitude/analytics-react-native not available:', error);
}

// Safely import expo dependencies with error handling
let Constants: any = null;
let Application: any = null;

try {
  Constants = require('expo-constants').default;
} catch (error) {
  console.warn('⚠️ expo-constants not available:', error);
}

try {
  Application = require('expo-application');
} catch (error) {
  console.warn('⚠️ expo-application not available:', error);
}

// Get API key safely
const getAmplitudeApiKey = () => {
  try {
    const extra = (Constants?.expoConfig as any)?.extra || {};
    return extra.amplitudeApiKey ?? process.env.EXPO_PUBLIC_AMPLITUDE_API_KEY ?? null;
  } catch (error) {
    console.warn('⚠️ Unable to get amplitude API key:', error);
    return null;
  }
};

const AMPLITUDE_API_KEY = getAmplitudeApiKey();

// Event names - centralized for consistency
export const AnalyticsEvents = {
  // Authentication
  SIGN_UP_STARTED: 'Sign Up Started',
  SIGN_UP_COMPLETED: 'Sign Up Completed',
  SIGN_IN_STARTED: 'Sign In Started',
  SIGN_IN_COMPLETED: 'Sign In Completed',
  OAUTH_STARTED: 'OAuth Started',
  OAUTH_COMPLETED: 'OAuth Completed',
  LOGOUT: 'Logout',

  // Onboarding
  ONBOARDING_STARTED: 'Onboarding Started',
  ONBOARDING_STEP_COMPLETED: 'Onboarding Step Completed',
  ONBOARDING_COMPLETED: 'Onboarding Completed',
  ONBOARDING_SKIPPED: 'Onboarding Skipped',

  // App Usage
  APP_OPENED: 'App Opened',
  APP_BACKGROUNDED: 'App Backgrounded',
  SCREEN_VIEWED: 'Screen Viewed',
  
  // Chat & AI
  CHAT_STARTED: 'Chat Started',
  MESSAGE_SENT: 'Message Sent',
  AI_RESPONSE_RECEIVED: 'AI Response Received',
  CONVERSATION_CREATED: 'Conversation Created',
  CONVERSATION_OPENED: 'Conversation Opened',

  // Paywall & Subscriptions
  PAYWALL_VIEWED: 'Paywall Viewed',
  SUBSCRIPTION_PLAN_VIEWED: 'Subscription Plan Viewed',
  PURCHASE_STARTED: 'Purchase Started',
  PURCHASE_COMPLETED: 'Purchase Completed',
  PURCHASE_FAILED: 'Purchase Failed',
  SUBSCRIPTION_CANCELLED: 'Subscription Cancelled',
  TRIAL_STARTED: 'Trial Started',
  TRIAL_ENDED: 'Trial Ended',

  // Engagement
  DAILY_QUERY_LIMIT_REACHED: 'Daily Query Limit Reached',
  FEATURE_USED: 'Feature Used',
  SETTINGS_OPENED: 'Settings Opened',
  PROFILE_UPDATED: 'Profile Updated',

  // Errors
  ERROR_OCCURRED: 'Error Occurred',
  NETWORK_ERROR: 'Network Error',
  AUTHENTICATION_ERROR: 'Authentication Error',
} as const;

// User properties
export interface UserProperties {
  user_id?: string;
  email?: string;
  tier?: 'trial' | 'strategist' | 'shark';
  display_name?: string;
  has_completed_onboarding?: boolean;
  daily_query_count?: number;
  subscription_status?: 'active' | 'cancelled' | 'trial' | 'expired';
  platform?: string;
  app_version?: string;
  device_type?: string;
  first_seen?: string;
  last_seen?: string;
}

// Event properties interface
export interface EventProperties {
  [key: string]: string | number | boolean | null | undefined;
}

class AnalyticsService {
  private isInitialized = false;
  private isAvailable = true;
  private userId: string | null = null;

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.warn('📊 Analytics already initialized');
      return;
    }

    // Check if required dependencies are available
    if (!amplitude || !AMPLITUDE_API_KEY || AMPLITUDE_API_KEY === 'YOUR_AMPLITUDE_API_KEY_HERE') {
      console.warn('📊 Analytics disabled - missing amplitude dependency or API key');
      this.isAvailable = false;
      return;
    }

    try {
      console.log('📊 Initializing Amplitude analytics...');

      // Initialize Amplitude with privacy-focused configuration
      await amplitude.init(AMPLITUDE_API_KEY, {
        // Privacy settings - no IP tracking
        trackingOptions: {
          ipAddress: false, // Don't track IP addresses for privacy
          carrier: false,   // Don't track mobile carrier
          city: false,      // Don't track city-level location
          country: false,   // Don't track country-level location
          deviceBrand: true,
          deviceManufacturer: true,
          deviceModel: true,
          language: true,
          osName: true,
          osVersion: true,
          platform: true,
          region: false,    // Don't track region
          versionName: true,
        },

        // Other configuration
        defaultTracking: {
          attribution: false,  // Disable attribution tracking
          pageVisits: false,   // We'll track screen views manually
          sessions: true,      // Track session events
          formInteractions: false, // Disable automatic form tracking
          fileDownloads: false,    // Disable automatic file download tracking
        },

        // Batch events for performance
        flushQueueSize: 20,
        flushIntervalMillis: 10000, // 10 seconds

        // Development vs production settings
        logLevel: __DEV__ ? 'Debug' : 'Warn',
        minIdLength: 1,
      });

      // Set initial device properties
      await this.setDeviceProperties();

      this.isInitialized = true;
      console.log('✅ Amplitude analytics initialized successfully');

      // Track app initialization
      this.track('app_initialized', {
        is_development: __DEV__,
        initialization_time: Date.now(),
      });

    } catch (error) {
      console.error('❌ Failed to initialize Amplitude:', error);
      this.isAvailable = false;
      // Don't throw - app should continue without analytics
    }
  }

  private async setDeviceProperties(): Promise<void> {
    if (!this.isAvailable) return;

    try {
      const deviceProps: Record<string, any> = {
        platform: 'react-native',
        is_development: __DEV__,
      };

      // Add version info if available
      if (Constants) {
        try {
          deviceProps.app_version = Constants.expoConfig?.version || '1.0.0';
          deviceProps.app_name = Constants.expoConfig?.name || 'xavo';
        } catch (error) {
          console.warn('Failed to get app version from Constants:', error);
        }
      }

      if (Application) {
        try {
          deviceProps.native_app_version = Application.nativeApplicationVersion;
          deviceProps.native_build_version = Application.nativeBuildVersion;
        } catch (error) {
          console.warn('Failed to get native version from Application:', error);
        }
      }

      // Set device properties in Amplitude
      amplitude.setDeviceId();
      amplitude.setVersionName(deviceProps.app_version || '1.0.0');

      console.log('📊 Device properties set:', deviceProps);
    } catch (error) {
      console.error('❌ Failed to set device properties:', error);
    }
  }

  // Set user context
  setUser(user: UserProperties): void {
    if (!this.isAvailable) return;

    try {
      this.userId = user.user_id || null;
      
      if (user.user_id) {
        amplitude.setUserId(user.user_id);
      }

      // Set user properties (these persist across sessions)
      const userProps: Record<string, any> = {};
      
      if (user.email) userProps.email = user.email;
      if (user.tier) userProps.tier = user.tier;
      if (user.display_name) userProps.display_name = user.display_name;
      if (user.has_completed_onboarding !== undefined) userProps.has_completed_onboarding = user.has_completed_onboarding;
      if (user.subscription_status) userProps.subscription_status = user.subscription_status;
      if (user.platform) userProps.platform = user.platform;
      if (user.app_version) userProps.app_version = user.app_version;

      amplitude.setUserProperties(userProps);

      console.log('📊 User context set:', { user_id: user.user_id, tier: user.tier, email: user.email });
    } catch (error) {
      console.error('❌ Failed to set user context:', error);
    }
  }

  // Clear user context (on logout)
  clearUser(): void {
    if (!this.isAvailable) return;

    try {
      amplitude.setUserId(null);
      this.userId = null;
      
      // Clear user properties but keep device properties
      amplitude.clearUserProperties();
      
      console.log('📊 User context cleared');
    } catch (error) {
      console.error('❌ Failed to clear user context:', error);
    }
  }

  // Track generic event
  track(eventName: string, properties?: Record<string, any>): void {
    if (!this.isAvailable) return;

    try {
      const eventProps = {
        ...properties,
        timestamp: new Date().toISOString(),
        user_id: this.userId,
        is_development: __DEV__,
      };

      amplitude.track(eventName, eventProps);
      console.log('📊 Event tracked:', eventName, eventProps);
    } catch (error) {
      console.error('❌ Failed to track event:', error);
    }
  }

  // Authentication Events
  trackSignIn(method: string, userId: string, success: boolean): void {
    this.track('sign_in', {
      method,
      user_id: userId,
      success,
    });
  }

  trackSignUp(method: string, userId: string, success: boolean): void {
    this.track('sign_up', {
      method,
      user_id: userId,
      success,
    });
  }

  trackSignOut(userId?: string): void {
    this.track('sign_out', {
      user_id: userId,
    });
  }

  // Onboarding Events
  trackOnboardingStarted(userId: string): void {
    this.track('onboarding_started', {
      user_id: userId,
    });
  }

  trackOnboardingStep(userId: string, step: string, stepNumber: number): void {
    this.track('onboarding_step', {
      user_id: userId,
      step,
      step_number: stepNumber,
    });
  }

  trackOnboardingCompleted(userId: string): void {
    this.track('onboarding_completed', {
      user_id: userId,
    });
  }

  // Screen Tracking
  trackScreenView(screenName: string, properties?: Record<string, any>): void {
    this.track('screen_view', {
      screen_name: screenName,
      ...properties,
    });
  }

  // Chat & Messaging Events
  trackMessageSent(userId: string, sessionId: string, messageLength: number, hasAttachment: boolean = false): void {
    this.track('message_sent', {
      user_id: userId,
      session_id: sessionId,
      message_length: messageLength,
      has_attachment: hasAttachment,
    });
  }

  trackConversationStarted(userId: string, sessionId: string, trigger: string): void {
    this.track('conversation_started', {
      user_id: userId,
      session_id: sessionId,
      trigger, // 'prompt', 'manual_input', etc.
    });
  }

  // Paywall & Monetization Events
  trackPaywallViewed(source: string, userTier: string): void {
    this.track('paywall_viewed', {
      source,
      user_tier: userTier,
    });
  }

  trackSubscriptionSelected(packageId: string, price: number, period: string): void {
    this.track('subscription_selected', {
      package_id: packageId,
      price,
      period,
    });
  }

  trackPurchaseCompleted(packageId: string, price: number, userId: string): void {
    this.track('purchase_completed', {
      package_id: packageId,
      price,
      user_id: userId,
      revenue: price, // Amplitude revenue tracking
    });
  }

  trackPurchaseFailed(packageId: string, error: string, userId: string): void {
    this.track('purchase_failed', {
      package_id: packageId,
      error,
      user_id: userId,
    });
  }

  // Feature Usage Events
  trackFeatureUsed(featureName: string, userId?: string, context?: Record<string, any>): void {
    this.track('feature_used', {
      feature_name: featureName,
      user_id: userId,
      ...context,
    });
  }

  trackVoiceRecordingUsed(userId: string, duration: number): void {
    this.track('voice_recording_used', {
      user_id: userId,
      duration_seconds: duration,
    });
  }

  trackFileUploadUsed(userId: string, fileType: string, fileSize: number): void {
    this.track('file_upload_used', {
      user_id: userId,
      file_type: fileType,
      file_size_bytes: fileSize,
    });
  }

  // Error Tracking
  trackError(error: Error, context?: string, properties?: Record<string, any>): void {
    this.track('error_occurred', {
      error_message: error.message,
      error_stack: error.stack,
      context,
      ...properties,
    });
  }

  // Performance Tracking
  trackPerformance(metric: string, value: number, context?: string): void {
    this.track('performance_metric', {
      metric,
      value,
      context,
    });
  }

  // User Engagement
  trackDailyActive(userId: string, tier: string): void {
    this.track('daily_active_user', {
      user_id: userId,
      tier,
    });
  }

  trackQueryLimitReached(userId: string, tier: string, queryCount: number): void {
    this.track('query_limit_reached', {
      user_id: userId,
      tier,
      query_count: queryCount,
    });
  }

  // Check if analytics is working
  async testAnalytics(): Promise<boolean> {
    if (!this.isAvailable) {
      console.warn('📊 Analytics not available');
      return false;
    }

    try {
      this.track('analytics_test', {
        test: true,
        timestamp: new Date().toISOString(),
      });

      console.log('✅ Analytics test successful');
      return true;
    } catch (error) {
      console.error('❌ Analytics test failed:', error);
      return false;
    }
  }

  // Get availability status
  get available(): boolean {
    return this.isAvailable;
  }

  get initialized(): boolean {
    return this.isInitialized;
  }
}

// Create singleton instance
export const analytics = new AnalyticsService();

// Helper hook for tracking screen views
export const useScreenTracking = (screenName: string, properties?: EventProperties) => {
  React.useEffect(() => {
    analytics.trackScreenView(screenName, properties);
  }, [screenName]);
}; 