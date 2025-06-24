import { Platform } from 'react-native';
import * as StoreReview from 'expo-store-review';
import InAppReview from 'react-native-in-app-review';
import { secureStorage } from '../lib/secureStorage';
import { monitoring } from './monitoring';

// Storage keys for review metrics and state
const STORAGE_KEYS = {
  SESSION_COUNT: 'app_review_session_count',
  MESSAGE_COUNT: 'app_review_message_count', 
  USAGE_DATES: 'app_review_usage_dates',
  LAST_REVIEW_PROMPT: 'app_review_last_prompt_date',
  DID_DISMISS_REVIEW: 'app_review_did_dismiss',
  REVIEW_ELIGIBILITY_CHECK: 'app_review_eligibility_check'
} as const;

// Review eligibility criteria
const CRITERIA = {
  MIN_SESSION_COUNT: 4,
  MIN_DISTINCT_DAYS: 5,
  MIN_MESSAGE_COUNT: 12,
  PROMPT_COOLDOWN_DAYS: 15
} as const;

interface ReviewMetrics {
  sessionCount: number;
  messageCount: number;
  usageDates: string[]; // Array of date strings (YYYY-MM-DD)
  distinctDaysUsed: number;
}

interface ReviewState {
  lastReviewPromptDate: string | null;
  didDismissReview: boolean;
}

interface ReviewEligibility {
  isEligible: boolean;
  meetsSessionCount: boolean;
  meetsDistinctDays: boolean;
  meetsMessageCount: boolean;
  withinCooldownPeriod: boolean;
  daysSinceLastPrompt: number;
  metrics: ReviewMetrics;
}

class AppReviewService {
  private initialized = false;
  private lastLogTime = 0;
  private readonly LOG_THROTTLE_MS = 15 * 60 * 1000; // 15 minutes
  
  private shouldLog(): boolean {
    const now = Date.now();
    if (now - this.lastLogTime > this.LOG_THROTTLE_MS) {
      this.lastLogTime = now;
      return true;
    }
    return false;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      console.log('📱 AppReviewService: Initializing...');
      
      // Record today's usage
      await this.recordDailyUsage();
      
      this.initialized = true;
      console.log('✅ AppReviewService: Initialized successfully');
    } catch (error) {
      console.error('❌ AppReviewService: Failed to initialize:', error);
    }
  }

  // Record daily usage (call on app launch)
  async recordDailyUsage(): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      const usageDatesStr = await secureStorage.getItem(STORAGE_KEYS.USAGE_DATES);
      
      let usageDates: string[] = [];
      if (usageDatesStr) {
        usageDates = JSON.parse(usageDatesStr);
      }
      
      // Add today if not already recorded
      if (!usageDates.includes(today)) {
        usageDates.push(today);
        
        // Keep only last 30 days to prevent unlimited growth
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const cutoffDate = thirtyDaysAgo.toISOString().split('T')[0];
        
        usageDates = usageDates.filter(date => date >= cutoffDate);
        
        await secureStorage.setItem(STORAGE_KEYS.USAGE_DATES, JSON.stringify(usageDates));
        
        if (this.shouldLog()) {
          console.log(`📅 AppReviewService: Recorded usage for ${today}. Total distinct days: ${usageDates.length}`);
        }
      }
    } catch (error) {
      console.error('❌ AppReviewService: Failed to record daily usage:', error);
    }
  }

  // Increment session count (call when completing a chat session)
  async incrementSessionCount(): Promise<void> {
    try {
      const sessionCountStr = await secureStorage.getItem(STORAGE_KEYS.SESSION_COUNT);
      const sessionCount = sessionCountStr ? parseInt(sessionCountStr, 10) : 0;
      const newCount = sessionCount + 1;
      
      await secureStorage.setItem(STORAGE_KEYS.SESSION_COUNT, newCount.toString());
      
      if (this.shouldLog()) {
        console.log(`🎯 AppReviewService: Session count incremented to ${newCount}`);
      }
      
      // Track analytics
      try {
        const { analytics } = await import('./analytics');
        analytics.track('session_completed', {
          session_count: newCount,
          meets_session_criteria: newCount >= CRITERIA.MIN_SESSION_COUNT
        });
      } catch (e) {
        console.warn('Failed to track session completion:', e);
      }

      // Check eligibility after session completion
      await this.checkAndPromptReview('session_completion');
    } catch (error) {
      console.error('❌ AppReviewService: Failed to increment session count:', error);
    }
  }

  // Increment message count (call on every send/receive)
  async incrementMessageCount(): Promise<void> {
    try {
      const messageCountStr = await secureStorage.getItem(STORAGE_KEYS.MESSAGE_COUNT);
      const messageCount = messageCountStr ? parseInt(messageCountStr, 10) : 0;
      const newCount = messageCount + 1;
      
      await secureStorage.setItem(STORAGE_KEYS.MESSAGE_COUNT, newCount.toString());
      
      if (this.shouldLog()) {
        console.log(`💬 AppReviewService: Message count incremented to ${newCount}`);
      }

      // Track milestone achievements
      if (newCount === CRITERIA.MIN_MESSAGE_COUNT) {
        try {
          const { analytics } = await import('./analytics');
          analytics.track('review_message_milestone_reached', {
            message_count: newCount
          });
        } catch (e) {
          console.warn('Failed to track message milestone:', e);
        }
      }

      // Check eligibility after significant message milestones
      if (newCount % 5 === 0) { // Check every 5 messages to avoid excessive checks
        await this.checkAndPromptReview('message_milestone');
      }
    } catch (error) {
      console.error('❌ AppReviewService: Failed to increment message count:', error);
    }
  }

  // Get current metrics
  async getMetrics(): Promise<ReviewMetrics> {
    try {
      const sessionCountStr = await secureStorage.getItem(STORAGE_KEYS.SESSION_COUNT);
      const messageCountStr = await secureStorage.getItem(STORAGE_KEYS.MESSAGE_COUNT);
      const usageDatesStr = await secureStorage.getItem(STORAGE_KEYS.USAGE_DATES);
      
      const sessionCount = sessionCountStr ? parseInt(sessionCountStr, 10) : 0;
      const messageCount = messageCountStr ? parseInt(messageCountStr, 10) : 0;
      const usageDates = usageDatesStr ? JSON.parse(usageDatesStr) : [];
      
      return {
        sessionCount,
        messageCount,
        usageDates,
        distinctDaysUsed: usageDates.length
      };
    } catch (error) {
      console.error('❌ AppReviewService: Failed to get metrics:', error);
      return {
        sessionCount: 0,
        messageCount: 0,
        usageDates: [],
        distinctDaysUsed: 0
      };
    }
  }

  // Get review state
  async getReviewState(): Promise<ReviewState> {
    try {
      const lastPromptStr = await secureStorage.getItem(STORAGE_KEYS.LAST_REVIEW_PROMPT);
      const didDismissStr = await secureStorage.getItem(STORAGE_KEYS.DID_DISMISS_REVIEW);
      
      return {
        lastReviewPromptDate: lastPromptStr,
        didDismissReview: didDismissStr === 'true'
      };
    } catch (error) {
      console.error('❌ AppReviewService: Failed to get review state:', error);
      return {
        lastReviewPromptDate: null,
        didDismissReview: false
      };
    }
  }

  // Check if user is eligible for review prompt
  async checkEligibility(): Promise<ReviewEligibility> {
    try {
      const metrics = await this.getMetrics();
      const reviewState = await this.getReviewState();
      
      // Check individual criteria
      const meetsSessionCount = metrics.sessionCount >= CRITERIA.MIN_SESSION_COUNT;
      const meetsDistinctDays = metrics.distinctDaysUsed >= CRITERIA.MIN_DISTINCT_DAYS;
      const meetsMessageCount = metrics.messageCount >= CRITERIA.MIN_MESSAGE_COUNT;
      
      // Check cooldown period
      let daysSinceLastPrompt = 0;
      let withinCooldownPeriod = false;
      
      if (reviewState.lastReviewPromptDate) {
        const lastPromptDate = new Date(reviewState.lastReviewPromptDate);
        const now = new Date();
        daysSinceLastPrompt = Math.floor((now.getTime() - lastPromptDate.getTime()) / (1000 * 60 * 60 * 24));
        withinCooldownPeriod = daysSinceLastPrompt < CRITERIA.PROMPT_COOLDOWN_DAYS;
      }
      
      // User is eligible if they meet ALL criteria AND are not in cooldown
      const isEligible = meetsSessionCount && meetsDistinctDays && meetsMessageCount && !withinCooldownPeriod;
      
      const eligibility: ReviewEligibility = {
        isEligible,
        meetsSessionCount,
        meetsDistinctDays,
        meetsMessageCount,
        withinCooldownPeriod,
        daysSinceLastPrompt,
        metrics
      };
      
      if (this.shouldLog()) {
        console.log('📊 AppReviewService: Eligibility check:', {
          isEligible,
          sessionCount: `${metrics.sessionCount}/${CRITERIA.MIN_SESSION_COUNT}`,
          distinctDays: `${metrics.distinctDaysUsed}/${CRITERIA.MIN_DISTINCT_DAYS}`,
          messageCount: `${metrics.messageCount}/${CRITERIA.MIN_MESSAGE_COUNT}`,
          daysSinceLastPrompt,
          withinCooldownPeriod
        });
      }
      
      return eligibility;
    } catch (error) {
      console.error('❌ AppReviewService: Failed to check eligibility:', error);
      return {
        isEligible: false,
        meetsSessionCount: false,
        meetsDistinctDays: false,
        meetsMessageCount: false,
        withinCooldownPeriod: true,
        daysSinceLastPrompt: 0,
        metrics: await this.getMetrics()
      };
    }
  }

  // Check eligibility and prompt if eligible
  async checkAndPromptReview(trigger: 'session_completion' | 'message_milestone' | 'app_launch' | 'manual'): Promise<boolean> {
    try {
      const eligibility = await this.checkEligibility();
      
      if (!eligibility.isEligible) {
        if (this.shouldLog()) {
          console.log(`📱 AppReviewService: Not eligible for review prompt (trigger: ${trigger})`);
        }
        return false;
      }
      
      console.log(`🌟 AppReviewService: User is eligible! Showing review prompt (trigger: ${trigger})`);
      
      // Track the prompt
      try {
        const { analytics } = await import('./analytics');
        analytics.track('review_prompt_shown', {
          trigger,
          session_count: eligibility.metrics.sessionCount,
          message_count: eligibility.metrics.messageCount,
          distinct_days: eligibility.metrics.distinctDaysUsed,
          days_since_last_prompt: eligibility.daysSinceLastPrompt
        });
      } catch (e) {
        console.warn('Failed to track review prompt:', e);
      }
      
      // Show the platform-specific review prompt
      const success = await this.showReviewPrompt();
      
      // Update state regardless of success (to prevent spam)
      await this.updateReviewState(success);
      
      return success;
    } catch (error) {
      console.error('❌ AppReviewService: Failed to check and prompt review:', error);
      return false;
    }
  }

  // Show platform-specific review prompt
  private async showReviewPrompt(): Promise<boolean> {
    try {
      if (Platform.OS === 'ios') {
        // Check if StoreReview is available
        const isAvailable = await StoreReview.isAvailableAsync();
        if (!isAvailable) {
          console.log('📱 AppReviewService: StoreReview not available on this iOS device');
          return false;
        }
        
        // Request review on iOS
        await StoreReview.requestReview();
        console.log('✅ AppReviewService: iOS review prompt shown');
        return true;
        
      } else if (Platform.OS === 'android') {
        // Check if InAppReview is available
        const isAvailable = InAppReview.isAvailable();
        if (!isAvailable) {
          console.log('📱 AppReviewService: InAppReview not available on this Android device');
          return false;
        }
        
        // Request review on Android
        const success = await InAppReview.RequestInAppReview();
        console.log('✅ AppReviewService: Android review prompt shown');
        return success;
        
      } else {
        console.log('📱 AppReviewService: Review prompts not supported on this platform');
        return false;
      }
    } catch (error) {
      console.error('❌ AppReviewService: Failed to show review prompt:', error);
      return false;
    }
  }

  // Update review state after showing prompt
  private async updateReviewState(success: boolean): Promise<void> {
    try {
      const now = new Date().toISOString();
      
      await Promise.all([
        secureStorage.setItem(STORAGE_KEYS.LAST_REVIEW_PROMPT, now),
        secureStorage.setItem(STORAGE_KEYS.DID_DISMISS_REVIEW, (!success).toString())
      ]);
      
      console.log(`📱 AppReviewService: Review state updated (success: ${success})`);
      
      // Track the result
      try {
        const { analytics } = await import('./analytics');
        analytics.track('review_prompt_result', {
          success,
          timestamp: now
        });
      } catch (e) {
        console.warn('Failed to track review result:', e);
      }
    } catch (error) {
      console.error('❌ AppReviewService: Failed to update review state:', error);
    }
  }

  // Manual trigger for testing or specific moments
  async triggerReviewPrompt(): Promise<boolean> {
    console.log('🎯 AppReviewService: Manual review prompt triggered');
    return await this.checkAndPromptReview('manual');
  }

  // Reset all review data (for testing or user preference)
  async resetReviewData(): Promise<void> {
    try {
      await Promise.all([
        secureStorage.removeItem(STORAGE_KEYS.SESSION_COUNT),
        secureStorage.removeItem(STORAGE_KEYS.MESSAGE_COUNT),
        secureStorage.removeItem(STORAGE_KEYS.USAGE_DATES),
        secureStorage.removeItem(STORAGE_KEYS.LAST_REVIEW_PROMPT),
        secureStorage.removeItem(STORAGE_KEYS.DID_DISMISS_REVIEW)
      ]);
      
      console.log('🔄 AppReviewService: All review data reset');
      
      try {
        const { analytics } = await import('./analytics');
        analytics.track('review_data_reset', {
          timestamp: new Date().toISOString()
        });
      } catch (e) {
        console.warn('Failed to track review data reset:', e);
      }
    } catch (error) {
      console.error('❌ AppReviewService: Failed to reset review data:', error);
    }
  }

  // Get debug info for development
  async getDebugInfo(): Promise<{
    metrics: ReviewMetrics;
    state: ReviewState;
    eligibility: ReviewEligibility;
    criteria: typeof CRITERIA;
  }> {
    const metrics = await this.getMetrics();
    const state = await this.getReviewState();
    const eligibility = await this.checkEligibility();
    
    return {
      metrics,
      state,
      eligibility,
      criteria: CRITERIA
    };
  }
}

// Create and export singleton instance
export const appReviewService = new AppReviewService();

// Export for debugging in development
if (__DEV__) {
  (global as any).appReviewService = appReviewService;
  console.log('🔧 appReviewService available globally in __DEV__ mode');
} 