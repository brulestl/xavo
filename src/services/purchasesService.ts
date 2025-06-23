import Purchases, { 
  CustomerInfo, 
  PurchasesOffering, 
  PurchasesPackage,
  LOG_LEVEL 
} from 'react-native-purchases';
import { Platform } from 'react-native';

// RevenueCat API Keys (these should be in environment variables in production)
const REVENUECAT_API_KEY_ANDROID = 'goog_YOUR_GOOGLE_API_KEY'; // Replace with actual key
const REVENUECAT_API_KEY_IOS = 'appl_YOUR_APPLE_API_KEY'; // Replace with actual key

// Subscription product IDs
export const SUBSCRIPTION_PRODUCTS = {
  POWER_STRATEGIST_MONTHLY: 'power_strategist_monthly',
  POWER_STRATEGIST_YEARLY: 'power_strategist_yearly',
} as const;

// Entitlement identifiers
export const ENTITLEMENTS = {
  POWER_STRATEGIST: 'power_strategist',
} as const;

class PurchasesService {
  private isInitialized = false;

  /**
   * Initialize RevenueCat SDK
   */
  async initialize(userId?: string): Promise<void> {
    if (this.isInitialized) return;

    try {
      const apiKey = Platform.OS === 'ios' 
        ? REVENUECAT_API_KEY_IOS 
        : REVENUECAT_API_KEY_ANDROID;

      await Purchases.setLogLevel(LOG_LEVEL.INFO);
      await Purchases.configure({ apiKey });
      
      if (userId) {
        await this.setUserId(userId);
      }

      this.isInitialized = true;
      console.log('✅ RevenueCat initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize RevenueCat:', error);
      throw error;
    }
  }

  /**
   * Set user ID for RevenueCat
   */
  async setUserId(userId: string): Promise<void> {
    try {
      await Purchases.logIn(userId);
      console.log('✅ RevenueCat user logged in:', userId);
    } catch (error) {
      console.error('❌ Failed to log in user to RevenueCat:', error);
      throw error;
    }
  }

  /**
   * Get available offerings
   */
  async getOfferings(): Promise<PurchasesOffering[]> {
    try {
      const offerings = await Purchases.getOfferings();
      return Object.values(offerings.all);
    } catch (error) {
      console.error('❌ Failed to get offerings:', error);
      throw error;
    }
  }

  /**
   * Get current offering (the default one)
   */
  async getCurrentOffering(): Promise<PurchasesOffering | null> {
    try {
      const offerings = await Purchases.getOfferings();
      return offerings.current;
    } catch (error) {
      console.error('❌ Failed to get current offering:', error);
      return null;
    }
  }

  /**
   * Purchase a package
   */
  async purchasePackage(packageToBuy: PurchasesPackage): Promise<{
    customerInfo: CustomerInfo;
    productIdentifier: string;
  }> {
    try {
      const result = await Purchases.purchasePackage(packageToBuy);
      console.log('✅ Purchase successful:', result.productIdentifier);
      return result;
    } catch (error: any) {
      console.error('❌ Purchase failed:', error);
      
      // Handle user cancelled purchase
      if (error.userCancelled) {
        throw new Error('Purchase was cancelled by user');
      }
      
      throw error;
    }
  }

  /**
   * Restore purchases
   */
  async restorePurchases(): Promise<CustomerInfo> {
    try {
      const customerInfo = await Purchases.restorePurchases();
      console.log('✅ Purchases restored successfully');
      return customerInfo;
    } catch (error) {
      console.error('❌ Failed to restore purchases:', error);
      throw error;
    }
  }

  /**
   * Get customer info
   */
  async getCustomerInfo(): Promise<CustomerInfo> {
    try {
      return await Purchases.getCustomerInfo();
    } catch (error) {
      console.error('❌ Failed to get customer info:', error);
      throw error;
    }
  }

  /**
   * Check if user has Power Strategist subscription
   */
  async hasPowerStrategistSubscription(): Promise<boolean> {
    try {
      const customerInfo = await this.getCustomerInfo();
      const entitlement = customerInfo.entitlements.active[ENTITLEMENTS.POWER_STRATEGIST];
      return entitlement !== undefined;
    } catch (error) {
      console.error('❌ Failed to check subscription status:', error);
      return false;
    }
  }

  /**
   * Get subscription expiration date
   */
  async getSubscriptionExpirationDate(): Promise<Date | null> {
    try {
      const customerInfo = await this.getCustomerInfo();
      const entitlement = customerInfo.entitlements.active[ENTITLEMENTS.POWER_STRATEGIST];
      
      if (entitlement?.expirationDate) {
        return new Date(entitlement.expirationDate);
      }
      
      return null;
    } catch (error) {
      console.error('❌ Failed to get expiration date:', error);
      return null;
    }
  }

  /**
   * Check if user is in trial period
   */
  async isInTrialPeriod(): Promise<boolean> {
    try {
      const customerInfo = await this.getCustomerInfo();
      const entitlement = customerInfo.entitlements.active[ENTITLEMENTS.POWER_STRATEGIST];
      return entitlement?.periodType === 'trial';
    } catch (error) {
      console.error('❌ Failed to check trial status:', error);
      return false;
    }
  }

  /**
   * Log out current user
   */
  async logOut(): Promise<void> {
    try {
      await Purchases.logOut();
      console.log('✅ User logged out from RevenueCat');
    } catch (error) {
      console.error('❌ Failed to log out user:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const purchasesService = new PurchasesService();
export default purchasesService; 