import * as SecureStore from 'expo-secure-store';
import { differenceInDays } from 'date-fns';

export type Tier = 'guest' | 'essential' | 'power';

const MAX_FREE_DAILY = 3;
const ATTEMPTS_KEY = 'dailyAttempts';
const LAST_RESET_KEY = 'lastResetDate';

interface AttemptData {
  count: number;
  lastReset: string;
}

export class AttemptLimiter {
  static async getAttemptsLeft(tier: Tier): Promise<number> {
    if (tier === 'power') {
      return Number.MAX_SAFE_INTEGER; // Unlimited for power users
    }

    try {
      const storedData = await SecureStore.getItemAsync(ATTEMPTS_KEY);
      const today = new Date().toDateString();
      
      if (!storedData) {
        // First time user - set initial attempts
        await this.resetDailyAttempts();
        return MAX_FREE_DAILY;
      }

      const attemptData: AttemptData = JSON.parse(storedData);
      const daysSinceLastReset = differenceInDays(new Date(), new Date(attemptData.lastReset));

      if (daysSinceLastReset >= 1) {
        // New day - reset attempts
        await this.resetDailyAttempts();
        return MAX_FREE_DAILY;
      }

      return Math.max(0, MAX_FREE_DAILY - attemptData.count);
    } catch (error) {
      console.error('Error getting attempts left:', error);
      return MAX_FREE_DAILY;
    }
  }

  static async decrementAttempts(): Promise<void> {
    try {
      const storedData = await SecureStore.getItemAsync(ATTEMPTS_KEY);
      const today = new Date().toDateString();
      
      if (!storedData) {
        // First attempt
        const newData: AttemptData = {
          count: 1,
          lastReset: today
        };
        await SecureStore.setItemAsync(ATTEMPTS_KEY, JSON.stringify(newData));
        return;
      }

      const attemptData: AttemptData = JSON.parse(storedData);
      const daysSinceLastReset = differenceInDays(new Date(), new Date(attemptData.lastReset));

      if (daysSinceLastReset >= 1) {
        // New day - reset and count this as first attempt
        const newData: AttemptData = {
          count: 1,
          lastReset: today
        };
        await SecureStore.setItemAsync(ATTEMPTS_KEY, JSON.stringify(newData));
      } else {
        // Same day - increment count
        attemptData.count += 1;
        await SecureStore.setItemAsync(ATTEMPTS_KEY, JSON.stringify(attemptData));
      }
    } catch (error) {
      console.error('Error decrementing attempts:', error);
    }
  }

  static async resetDailyAttempts(): Promise<void> {
    try {
      const today = new Date().toDateString();
      const newData: AttemptData = {
        count: 0,
        lastReset: today
      };
      await SecureStore.setItemAsync(ATTEMPTS_KEY, JSON.stringify(newData));
    } catch (error) {
      console.error('Error resetting daily attempts:', error);
    }
  }

  static canAsk(attemptsLeft: number): boolean {
    return attemptsLeft > 0;
  }
} 