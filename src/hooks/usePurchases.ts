import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { PurchasesOffering, PurchasesPackage, CustomerInfo } from 'react-native-purchases';
import purchasesService from '../services/purchasesService';

interface PurchasesState {
  // Loading states
  isInitialized: boolean;
  isLoading: boolean;
  isRestoring: boolean;
  isPurchasing: boolean;
  
  // Subscription status
  isSubscribed: boolean;
  isInTrial: boolean;
  expirationDate: Date | null;
  
  // Available products
  currentOffering: PurchasesOffering | null;
  packages: PurchasesPackage[];
  
  // Customer info
  customerInfo: CustomerInfo | null;
}

export const usePurchases = (userId?: string) => {
  const [state, setState] = useState<PurchasesState>({
    isInitialized: false,
    isLoading: true,
    isRestoring: false,
    isPurchasing: false,
    isSubscribed: false,
    isInTrial: false,
    expirationDate: null,
    currentOffering: null,
    packages: [],
    customerInfo: null,
  });

  // Initialize RevenueCat
  const initialize = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));
      
      await purchasesService.initialize(userId);
      await loadOfferings();
      await refreshCustomerInfo();
      
      setState(prev => ({ 
        ...prev, 
        isInitialized: true,
        isLoading: false 
      }));
    } catch (error) {
      console.error('Failed to initialize purchases:', error);
      setState(prev => ({ 
        ...prev, 
        isLoading: false 
      }));
    }
  }, [userId]);

  // Load available offerings
  const loadOfferings = useCallback(async () => {
    try {
      const offering = await purchasesService.getCurrentOffering();
      const packages = offering?.availablePackages || [];
      
      setState(prev => ({
        ...prev,
        currentOffering: offering,
        packages,
      }));
    } catch (error) {
      console.error('Failed to load offerings:', error);
    }
  }, []);

  // Refresh customer info and subscription status
  const refreshCustomerInfo = useCallback(async () => {
    try {
      const [customerInfo, isSubscribed, isInTrial, expirationDate] = await Promise.all([
        purchasesService.getCustomerInfo(),
        purchasesService.hasPowerStrategistSubscription(),
        purchasesService.isInTrialPeriod(),
        purchasesService.getSubscriptionExpirationDate(),
      ]);

      setState(prev => ({
        ...prev,
        customerInfo,
        isSubscribed,
        isInTrial,
        expirationDate,
      }));

      return { customerInfo, isSubscribed, isInTrial, expirationDate };
    } catch (error) {
      console.error('Failed to refresh customer info:', error);
      return null;
    }
  }, []);

  // Purchase a package
  const purchasePackage = useCallback(async (packageToBuy: PurchasesPackage) => {
    try {
      setState(prev => ({ ...prev, isPurchasing: true }));
      
      const result = await purchasesService.purchasePackage(packageToBuy);
      
      // Refresh customer info after successful purchase
      await refreshCustomerInfo();
      
      Alert.alert(
        'Purchase Successful!', 
        'Welcome to Power Strategist! You now have access to all premium features.',
        [{ text: 'OK' }]
      );
      
      return result;
    } catch (error: any) {
      console.error('Purchase failed:', error);
      
      if (error.message === 'Purchase was cancelled by user') {
        // Don't show alert for user cancellation
        return null;
      }
      
      Alert.alert(
        'Purchase Failed',
        error.message || 'An error occurred while processing your purchase. Please try again.',
        [{ text: 'OK' }]
      );
      
      throw error;
    } finally {
      setState(prev => ({ ...prev, isPurchasing: false }));
    }
  }, [refreshCustomerInfo]);

  // Restore purchases
  const restorePurchases = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isRestoring: true }));
      
      await purchasesService.restorePurchases();
      await refreshCustomerInfo();
      
      Alert.alert(
        'Restore Successful',
        'Your purchases have been restored successfully.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Restore failed:', error);
      Alert.alert(
        'Restore Failed',
        'Failed to restore purchases. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setState(prev => ({ ...prev, isRestoring: false }));
    }
  }, [refreshCustomerInfo]);

  // Start free trial (purchase monthly package)
  const startFreeTrial = useCallback(async () => {
    const monthlyPackage = state.packages.find(pkg => 
      pkg.product.identifier.includes('monthly')
    );
    
    if (!monthlyPackage) {
      Alert.alert(
        'Trial Not Available',
        'Free trial is currently not available. Please try again later.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    return await purchasePackage(monthlyPackage);
  }, [state.packages, purchasePackage]);

  // Upgrade to yearly subscription
  const upgradeToYearly = useCallback(async () => {
    const yearlyPackage = state.packages.find(pkg => 
      pkg.product.identifier.includes('yearly')
    );
    
    if (!yearlyPackage) {
      Alert.alert(
        'Upgrade Not Available',
        'Yearly subscription is currently not available. Please try again later.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    return await purchasePackage(yearlyPackage);
  }, [state.packages, purchasePackage]);

  // Get formatted price for a package
  const getPackagePrice = useCallback((packageItem: PurchasesPackage): string => {
    return packageItem.product.priceString;
  }, []);

  // Get package by identifier
  const getPackage = useCallback((identifier: string): PurchasesPackage | undefined => {
    return state.packages.find(pkg => pkg.product.identifier === identifier);
  }, [state.packages]);

  // Initialize on mount and when userId changes
  useEffect(() => {
    initialize();
  }, [initialize]);

  return {
    // State
    ...state,
    
    // Actions
    refreshCustomerInfo,
    purchasePackage,
    restorePurchases,
    startFreeTrial,
    upgradeToYearly,
    
    // Helpers
    getPackagePrice,
    getPackage,
  };
};

export default usePurchases; 