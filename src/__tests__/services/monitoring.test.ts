import { monitoring, analytics, crashReporting } from '../../services/monitoring';

// Mock the external libraries
jest.mock('@amplitude/analytics-react-native', () => ({
  init: jest.fn(() => Promise.resolve()),
  track: jest.fn(),
  identify: jest.fn(),
  setUserId: jest.fn(),
  reset: jest.fn(),
}));

jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  setUser: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  addBreadcrumb: jest.fn(),
  setContext: jest.fn(),
  withScope: jest.fn((callback) => callback({ setTag: jest.fn() })),
}));

jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {
      amplitudeApiKey: 'test-amplitude-key',
      sentryDsn: 'test-sentry-dsn',
    },
  },
}));

jest.mock('expo-application', () => ({
  nativeApplicationVersion: '1.0.0',
  nativeBuildVersion: '1',
}));

describe('Monitoring Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize both analytics and crash reporting', async () => {
      await monitoring.initialize();
      
      // Check that both services were called
      expect(require('@amplitude/analytics-react-native').init).toHaveBeenCalled();
      expect(require('@sentry/react-native').init).toHaveBeenCalled();
    });

    it('should not initialize twice', async () => {
      await monitoring.initialize();
      await monitoring.initialize(); // Second call
      
      // Should only be called once
      expect(require('@amplitude/analytics-react-native').init).toHaveBeenCalledTimes(1);
    });
  });

  describe('user management', () => {
    beforeEach(async () => {
      await monitoring.initialize();
    });

    it('should set user context in both services', () => {
      const user = {
        id: 'test-user-123',
        email: 'test@example.com',
        tier: 'shark' as const,
        displayName: 'Test User',
        hasCompletedOnboarding: true,
        subscriptionStatus: 'active',
      };

      monitoring.setUser(user);

      expect(require('@sentry/react-native').setUser).toHaveBeenCalledWith({
        id: user.id,
        email: user.email,
        tier: user.tier,
        displayName: user.displayName,
      });

      expect(require('@amplitude/analytics-react-native').setUserId).toHaveBeenCalledWith(user.id);
    });

    it('should clear user context from both services', () => {
      monitoring.clearUser();

      expect(require('@sentry/react-native').setUser).toHaveBeenCalledWith(null);
      expect(require('@amplitude/analytics-react-native').reset).toHaveBeenCalled();
    });
  });

  describe('event tracking', () => {
    beforeEach(async () => {
      await monitoring.initialize();
    });

    it('should track sign up events', () => {
      monitoring.trackSignUp('google', 'user-123', true);

      expect(require('@amplitude/analytics-react-native').track).toHaveBeenCalledWith(
        'Sign Up Completed',
        expect.objectContaining({
          method: 'google',
          user_id: 'user-123',
          is_new_user: true,
        })
      );

      expect(require('@sentry/react-native').addBreadcrumb).toHaveBeenCalledWith({
        message: 'User signed up via google',
        category: 'auth',
        level: 'info',
        data: { userId: 'user-123' },
        timestamp: expect.any(Number),
      });
    });

    it('should track onboarding completion', () => {
      monitoring.trackOnboardingCompleted('user-123');

      expect(require('@amplitude/analytics-react-native').track).toHaveBeenCalledWith(
        'Onboarding Completed',
        expect.any(Object)
      );

      expect(require('@sentry/react-native').addBreadcrumb).toHaveBeenCalledWith({
        message: 'User completed onboarding',
        category: 'onboarding',
        level: 'info',
        data: { userId: 'user-123' },
        timestamp: expect.any(Number),
      });
    });

    it('should track paywall views', () => {
      monitoring.trackPaywallViewed('onboarding_flow', 'trial');

      expect(require('@amplitude/analytics-react-native').track).toHaveBeenCalledWith(
        'Paywall Viewed',
        expect.objectContaining({
          source: 'onboarding_flow',
          current_tier: 'trial',
        })
      );
    });

    it('should track purchase completion', () => {
      monitoring.trackPurchaseCompleted('monthly_plan', 29.99, 'user-123');

      expect(require('@amplitude/analytics-react-native').track).toHaveBeenCalledWith(
        'Purchase Completed',
        expect.objectContaining({
          plan_id: 'monthly_plan',
          price: 29.99,
        })
      );

      expect(require('@sentry/react-native').setContext).toHaveBeenCalledWith(
        'subscription',
        expect.objectContaining({
          plan_id: 'monthly_plan',
          price: 29.99,
          purchase_date: expect.any(String),
        })
      );
    });

    it('should track errors in both services', () => {
      const error = new Error('Test error');
      const context = 'test_context';

      monitoring.trackError(error, context, { extra: 'data' });

      expect(require('@amplitude/analytics-react-native').track).toHaveBeenCalledWith(
        'Error Occurred',
        expect.objectContaining({
          error_message: 'Test error',
          error_context: context,
          extra: 'data',
        })
      );

      expect(require('@sentry/react-native').captureException).toHaveBeenCalledWith(error);
    });

    it('should track screen views', () => {
      monitoring.trackScreenView('Home', { user_tier: 'shark' });

      expect(require('@amplitude/analytics-react-native').track).toHaveBeenCalledWith(
        'Screen Viewed',
        expect.objectContaining({
          screen_name: 'Home',
          user_tier: 'shark',
        })
      );

      expect(require('@sentry/react-native').addBreadcrumb).toHaveBeenCalledWith({
        message: 'Screen viewed: Home',
        category: 'navigation',
        level: 'info',
        data: { user_tier: 'shark' },
        timestamp: expect.any(Number),
      });
    });
  });

  describe('status and diagnostics', () => {
    it('should return correct status', () => {
      const status = monitoring.getStatus();
      
      expect(status).toEqual({
        initialized: expect.any(Boolean),
        services: {
          analytics: expect.any(Boolean),
          crashReporting: expect.any(Boolean),
        },
      });
    });

    it('should run diagnostics successfully', async () => {
      await monitoring.initialize();
      
      const diagnostics = await monitoring.runDiagnostics();
      
      expect(diagnostics).toEqual({
        analytics: true,
        crashReporting: true,
        overall: true,
      });
    });
  });
}); 