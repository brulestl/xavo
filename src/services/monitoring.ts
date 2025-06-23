import { crashReporting } from './crashReporting';
import { analytics } from './analytics';

// Central monitoring service that coordinates analytics and crash reporting
class MonitoringService {
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.warn('📊 Monitoring already initialized');
      return;
    }

    try {
      console.log('📊 Initializing monitoring services...');

      // Initialize crash reporting first (so we can capture analytics errors)
      await crashReporting.initialize();

      // Initialize analytics
      await analytics.initialize();

      this.isInitialized = true;
      console.log('✅ Monitoring services initialized successfully');

      // Test both services in development
      if (__DEV__) {
        setTimeout(async () => {
          await this.runDiagnostics();
        }, 2000);
      }

    } catch (error) {
      console.error('❌ Failed to initialize monitoring:', error);
      // Capture this error in crash reporting if available
      crashReporting.captureException(error as Error, { context: 'monitoring_initialization' });
    }
  }

  // Set user context for both services
  setUser(user: {
    id: string;
    email?: string;
    tier?: 'trial' | 'strategist' | 'shark';
    displayName?: string;
    hasCompletedOnboarding?: boolean;
    subscriptionStatus?: string;
  }): void {
    if (!this.isInitialized) return;

    try {
      // Set user in crash reporting
      crashReporting.setUser({
        id: user.id,
        email: user.email,
        tier: user.tier,
        displayName: user.displayName,
      });

      // Set user in analytics
      analytics.setUser({
        user_id: user.id,
        email: user.email,
        tier: user.tier,
        display_name: user.displayName,
        has_completed_onboarding: user.hasCompletedOnboarding,
        subscription_status: user.subscriptionStatus as 'trial' | 'active' | 'cancelled' | 'expired' | undefined,
      });

      console.log('📊 User context set for monitoring services:', {
        id: user.id,
        tier: user.tier,
        email: user.email,
      });

    } catch (error) {
      console.error('❌ Failed to set user context:', error);
      crashReporting.captureException(error as Error, { context: 'set_user_context' });
    }
  }

  // Clear user context (on logout)
  clearUser(): void {
    if (!this.isInitialized) return;

    try {
      crashReporting.clearUser();
      analytics.clearUser();
      console.log('📊 User context cleared from monitoring services');
    } catch (error) {
      console.error('❌ Failed to clear user context:', error);
    }
  }

  // Track authentication events
  trackSignUp(method: 'email' | 'google' | 'apple', userId: string, success: boolean): void {
    try {
      if (success) {
        analytics.trackSignUp(method, userId, true);
        crashReporting.addBreadcrumb(`User signed up via ${method}`, 'auth', 'info', { userId });
      } else {
        analytics.track('error_occurred', {
          error_type: 'sign_up_failed',
          method,
        });
      }
    } catch (error) {
      console.error('❌ Failed to track sign up:', error);
    }
  }

  trackSignIn(method: 'email' | 'google' | 'apple', userId: string, success: boolean): void {
    try {
      if (success) {
        analytics.trackSignIn(method, userId, true);
        crashReporting.addBreadcrumb(`User signed in via ${method}`, 'auth', 'info', { userId });
      } else {
        analytics.track('authentication_error', {
          error_type: 'sign_in_failed',
          method,
        });
      }
    } catch (error) {
      console.error('❌ Failed to track sign in:', error);
    }
  }

  // Track onboarding completion
  trackOnboardingCompleted(userId: string): void {
    try {
      analytics.trackOnboardingCompleted(userId);
      crashReporting.addBreadcrumb('User completed onboarding', 'onboarding', 'info', { userId });
    } catch (error) {
      console.error('❌ Failed to track onboarding completion:', error);
    }
  }

  // Track paywall interactions
  trackPaywallViewed(source: string, currentTier?: string): void {
    try {
      analytics.trackPaywallViewed(source, currentTier || 'unknown');
      crashReporting.addBreadcrumb('Paywall viewed', 'paywall', 'info', { source, currentTier });
    } catch (error) {
      console.error('❌ Failed to track paywall view:', error);
    }
  }

  trackPurchaseCompleted(planId: string, price: number, userId: string): void {
    try {
      analytics.trackPurchaseCompleted(planId, price, userId);
      crashReporting.addBreadcrumb('Purchase completed', 'purchase', 'info', { 
        planId, 
        price, 
        userId 
      });
      
      // Update user tier in monitoring after purchase
      crashReporting.setContext('subscription', {
        plan_id: planId,
        price,
        purchase_date: new Date().toISOString(),
      });
    } catch (error) {
      console.error('❌ Failed to track purchase:', error);
    }
  }

  // Track errors with both services
  trackError(error: Error | string, context?: string, properties?: Record<string, any>): void {
    try {
      const errorMessage = typeof error === 'string' ? error : error.message;
      
      // Track in analytics
      analytics.track('error_occurred', {
        error_message: errorMessage,
        error_context: context,
        ...properties,
      });

      // Capture in crash reporting
      crashReporting.captureException(error, {
        context,
        ...properties,
      });

      console.error('📊 Error tracked in monitoring:', errorMessage, context);
    } catch (trackingError) {
      console.error('❌ Failed to track error:', trackingError);
    }
  }

  // Track screen views
  trackScreenView(screenName: string, properties?: Record<string, any>): void {
    try {
      analytics.trackScreenView(screenName, properties);
      crashReporting.addBreadcrumb(`Screen viewed: ${screenName}`, 'navigation', 'info', properties);
    } catch (error) {
      console.error('❌ Failed to track screen view:', error);
    }
  }

  // Add performance monitoring
  startPerformanceTracking(operationName: string): any {
    try {
      return crashReporting.startTransaction(operationName);
    } catch (error) {
      console.error('❌ Failed to start performance tracking:', error);
      return null;
    }
  }

  // Run diagnostics to verify services are working
  async runDiagnostics(): Promise<{
    analytics: boolean;
    crashReporting: boolean;
    overall: boolean;
  }> {
    console.log('🔍 Running monitoring diagnostics...');

    const results = {
      analytics: false,
      crashReporting: false,
      overall: false,
    };

    try {
      // Test analytics
      const analyticsTestResult = await analytics.testAnalytics();
      results.analytics = analyticsTestResult;
      if (analyticsTestResult) {
        console.log('✅ Analytics diagnostic passed');
      } else {
        console.warn('⚠️ Analytics diagnostic failed');
      }
    } catch (error) {
      console.error('❌ Analytics diagnostic failed:', error);
    }

    try {
      // Test crash reporting
      const testResult = await crashReporting.testCrashReporting();
      results.crashReporting = testResult;
      if (testResult) {
        console.log('✅ Crash reporting diagnostic passed');
      } else {
        console.warn('⚠️ Crash reporting diagnostic failed');
      }
    } catch (error) {
      console.error('❌ Crash reporting diagnostic failed:', error);
    }

    results.overall = results.analytics && results.crashReporting;

    console.log('📊 Monitoring diagnostics completed:', results);

    // Track diagnostic results
    if (results.analytics) {
      analytics.track('monitoring_diagnostic', {
        analytics_working: results.analytics,
        crash_reporting_working: results.crashReporting,
        overall_status: results.overall ? 'success' : 'partial_failure',
      });
    }

    return results;
  }

  // Get monitoring status
  getStatus(): {
    initialized: boolean;
    services: {
      analytics: { available: boolean; initialized: boolean };
      crashReporting: { available: boolean; initialized: boolean };
    };
  } {
    return {
      initialized: this.isInitialized,
      services: {
        analytics: {
          available: analytics.available,
          initialized: analytics.initialized,
        },
        crashReporting: {
          available: crashReporting.available,
          initialized: crashReporting.initialized,
        },
      },
    };
  }
}

// Create singleton instance
export const monitoring = new MonitoringService();

// Export individual services for direct access if needed
export { crashReporting, analytics };

// Global error handler integration
if (!__DEV__) {
  // In production, automatically capture all console.error calls
  const originalConsoleError = console.error;
  console.error = (...args: any[]) => {
    try {
      const errorMessage = args.map(arg => String(arg)).join(' ');
      monitoring.trackError(errorMessage, 'console_error');
    } catch (e) {
      // Ignore errors in error tracking
    }
    originalConsoleError(...args);
  };
} 