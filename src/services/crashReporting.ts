import * as Sentry from '@sentry/react-native';

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

// Sentry configuration
const getExtraConfig = () => {
  try {
    return (Constants?.expoConfig as any)?.extra || {};
  } catch (error) {
    console.warn('⚠️ Unable to get expo config:', error);
    return {};
  }
};

const extra = getExtraConfig();
const SENTRY_DSN = extra.sentryDsn ?? process.env.EXPO_PUBLIC_SENTRY_DSN ?? 'YOUR_SENTRY_DSN_HERE';

interface CrashReportingConfig {
  dsn: string;
  debug: boolean;
  environment: string;
  release?: string;
  dist?: string;
}

class CrashReportingService {
  private isInitialized = false;
  private isAvailable = true;

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.warn('🚨 Crash reporting already initialized');
      return;
    }

    // Check if required dependencies are available
    if (!Constants || !Application) {
      console.warn('🚨 Crash reporting disabled - missing expo dependencies');
      this.isAvailable = false;
      return;
    }

    // Check if DSN is properly configured
    if (!SENTRY_DSN || SENTRY_DSN === 'YOUR_SENTRY_DSN_HERE') {
      console.warn('🚨 Crash reporting disabled - no valid Sentry DSN configured');
      this.isAvailable = false;
      return;
    }

    try {
      const config: CrashReportingConfig = {
        dsn: SENTRY_DSN,
        debug: __DEV__,
        environment: __DEV__ ? 'development' : 'production',
        release: await this.getAppVersion(),
        dist: await this.getBuildVersion(),
      };

      console.log('🚨 Initializing Sentry crash reporting...', {
        environment: config.environment,
        release: config.release,
        debug: config.debug,
      });

      Sentry.init({
        dsn: config.dsn,
        debug: config.debug,
        environment: config.environment,
        release: config.release,
        dist: config.dist,
        
        // Configure error sampling
        beforeSend: (event, hint) => {
          if (__DEV__) {
            console.log('🚨 Sentry capturing event:', event);
          }
          return event;
        },

        // Configure performance monitoring
        tracesSampleRate: __DEV__ ? 1.0 : 0.1,
        
        // Configure session tracking
        autoSessionTracking: true,
        
        // Configure native crash handling
        enableNative: true,
        enableNativeCrashHandling: true,
        
        // Configure JavaScript error handling
        enableCaptureFailedRequests: true,
        
        // Note: Advanced integrations like ReactNativeTracing may not be available in all versions
        integrations: [],
      });

      // Set up global error boundaries
      this.setupGlobalErrorHandlers();

      this.isInitialized = true;
      console.log('✅ Sentry crash reporting initialized successfully');

    } catch (error) {
      console.error('❌ Failed to initialize Sentry:', error);
      this.isAvailable = false;
      // Don't throw - app should continue without crash reporting
    }
  }

  private setupGlobalErrorHandlers(): void {
    if (!this.isAvailable) return;

    // Note: Unhandled promise rejection tracking is handled automatically by Sentry in React Native

    // Set up React Native error handler
    const originalHandler = ErrorUtils.getGlobalHandler();
    ErrorUtils.setGlobalHandler((error, isFatal) => {
      console.error('🚨 Global error handler:', error, 'Fatal:', isFatal);
      
      this.captureException(error, {
        type: 'global_error',
        isFatal,
      });

      // Call the original handler
      if (originalHandler) {
        originalHandler(error, isFatal);
      }
    });
  }

  private async getAppVersion(): Promise<string> {
    try {
      if (!Constants || !Application) {
        return 'xavo@unknown';
      }
      
      const version = Constants.expoConfig?.version || Application.nativeApplicationVersion || '1.0.0';
      return `${Constants.expoConfig?.name || 'xavo'}@${version}`;
    } catch (error) {
      console.warn('Failed to get app version:', error);
      return 'xavo@unknown';
    }
  }

  private async getBuildVersion(): Promise<string> {
    try {
      if (!Application) {
        return '1';
      }
      
      return Application.nativeBuildVersion || '1';
    } catch (error) {
      console.warn('Failed to get build version:', error);
      return '1';
    }
  }

  // Set user context for crash reports
  setUser(user: {
    id?: string;
    email?: string;
    tier?: string;
    displayName?: string;
  }): void {
    if (!this.isInitialized || !this.isAvailable) return;

    try {
      Sentry.setUser({
        id: user.id,
        email: user.email,
        username: user.displayName,
        tier: user.tier,
      });

      console.log('🚨 Sentry user context set:', { id: user.id, email: user.email, tier: user.tier });
    } catch (error) {
      console.error('❌ Failed to set Sentry user:', error);
    }
  }

  // Clear user context (on logout)
  clearUser(): void {
    if (!this.isInitialized || !this.isAvailable) return;

    try {
      Sentry.setUser(null);
      console.log('🚨 Sentry user context cleared');
    } catch (error) {
      console.error('❌ Failed to clear Sentry user:', error);
    }
  }

  // Set additional context
  setContext(key: string, context: Record<string, any>): void {
    if (!this.isInitialized || !this.isAvailable) return;

    try {
      Sentry.setContext(key, context);
    } catch (error) {
      console.error('❌ Failed to set Sentry context:', error);
    }
  }

  // Add breadcrumb for debugging
  addBreadcrumb(message: string, category?: string, level?: 'info' | 'warning' | 'error', data?: Record<string, any>): void {
    if (!this.isInitialized || !this.isAvailable) return;

    try {
      Sentry.addBreadcrumb({
        message,
        category: category || 'app',
        level: level || 'info',
        data,
        timestamp: Date.now() / 1000,
      });
    } catch (error) {
      console.error('❌ Failed to add Sentry breadcrumb:', error);
    }
  }

  // Capture exception manually
  captureException(error: Error | string, context?: Record<string, any>): void {
    if (!this.isInitialized || !this.isAvailable) return;

    try {
      if (context) {
        Sentry.withScope((scope) => {
          Object.keys(context).forEach(key => {
            scope.setTag(key, String(context[key]));
          });
          Sentry.captureException(error);
        });
      } else {
        Sentry.captureException(error);
      }

      console.log('🚨 Exception captured by Sentry:', error);
    } catch (captureError) {
      console.error('❌ Failed to capture exception in Sentry:', captureError);
    }
  }

  // Capture message manually
  captureMessage(message: string, level?: 'info' | 'warning' | 'error', context?: Record<string, any>): void {
    if (!this.isInitialized || !this.isAvailable) return;

    try {
      if (context) {
        Sentry.withScope((scope) => {
          Object.keys(context).forEach(key => {
            scope.setTag(key, String(context[key]));
          });
          Sentry.captureMessage(message, level || 'info');
        });
      } else {
        Sentry.captureMessage(message, level || 'info');
      }

      console.log('🚨 Message captured by Sentry:', message);
    } catch (captureError) {
      console.error('❌ Failed to capture message in Sentry:', captureError);
    }
  }

  // Performance monitoring (simplified - advanced tracing may not be available)
  startTransaction(name: string, operation?: string): any {
    if (!this.isInitialized || !this.isAvailable) return null;

    try {
      // Simple performance tracking - just log for now
      console.log(`🚨 Performance tracking: ${name} (${operation || 'operation'})`);
      return { name, operation, startTime: Date.now() };
    } catch (error) {
      console.error('❌ Failed to start performance tracking:', error);
      return null;
    }
  }

  // Check if Sentry is working
  async testCrashReporting(): Promise<boolean> {
    if (!this.isInitialized || !this.isAvailable) {
      console.warn('🚨 Crash reporting not initialized or available');
      return false;
    }

    try {
      // Send a test message to verify Sentry is working
      this.captureMessage('Test message from Xavo app', 'info', {
        test: true,
        timestamp: new Date().toISOString(),
      });

      console.log('✅ Crash reporting test successful');
      return true;
    } catch (error) {
      console.error('❌ Crash reporting test failed:', error);
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
export const crashReporting = new CrashReportingService();

// Helper function to wrap async functions with error handling
export function withErrorBoundary<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context?: string
): T {
  return (async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      crashReporting.addBreadcrumb(
        `Error in ${context || fn.name || 'anonymous function'}`,
        'error_boundary',
        'error',
        { args: args.length }
      );
      crashReporting.captureException(error as Error, { context: context || fn.name });
      throw error; // Re-throw to maintain original behavior
    }
  }) as T;
}

// Helper function to wrap sync functions with error handling
export function withSyncErrorBoundary<T extends (...args: any[]) => any>(
  fn: T,
  context?: string
): T {
  return ((...args: any[]) => {
    try {
      return fn(...args);
    } catch (error) {
      crashReporting.addBreadcrumb(
        `Error in ${context || fn.name || 'anonymous function'}`,
        'error_boundary',
        'error',
        { args: args.length }
      );
      crashReporting.captureException(error as Error, { context: context || fn.name });
      throw error; // Re-throw to maintain original behavior
    }
  }) as T;
} 