import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { useAuth } from './AuthContext';
import {
  Subscription,
  Invoice,
  CommercialMetrics,
  CustomerType,
} from '../types/subscription';
import { subscriptionService } from '../services/subscriptionService';
import { updateCompany } from '../services/companyService';

interface SubscriptionContextType {
  currentSubscription: Subscription | null;
  customerInvoices: Invoice[];
  commercialMetrics: CommercialMetrics;
  allSubscriptions: Subscription[];
  allInvoices: Invoice[];
  upgradeToPlan: (targetPlanId: string) => Promise<{ success: boolean; invoice?: Invoice }>;
  downgradeToPlan: (targetPlanId: string) => Promise<boolean>;
  cancelSubscription: (atPeriodEnd?: boolean) => Promise<boolean>;
  grantComplimentary: (
    customerType: CustomerType,
    customerId: string,
    planId: string,
    durationDays?: number,
    reason?: string
  ) => Promise<boolean>;
  refreshSubscriptions: () => void;
  isLoading: boolean;
}

const SubscriptionContext = createContext<SubscriptionContextType | null>(null);

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userProfile, activeCompany, role } = useAuth();
  const [version, setVersion] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Check and reconcile expiring trials / grace periods upon mounting
    subscriptionService.checkAndReconcileSubscriptions();

    const unsubscribe = subscriptionService.subscribe(() => {
      setVersion((v) => v + 1);
    });
    return unsubscribe;
  }, []);

  const refreshSubscriptions = useCallback(() => {
    setVersion((v) => v + 1);
  }, []);

  // Determine current active customer context (Company or Individual)
  const customerContext = useMemo(() => {
    if (role === 'company_admin' && activeCompany?.id) {
      return {
        type: 'company' as CustomerType,
        id: activeCompany.id,
        name: activeCompany.name,
      };
    }
    const empId = userProfile?.employeeId || userProfile?.id || 'anon_user';
    return {
      type: 'individual' as CustomerType,
      id: empId,
      name: userProfile?.displayName || 'Personal Professional',
    };
  }, [role, activeCompany, userProfile]);

  // Current customer subscription
  const currentSubscription = useMemo(() => {
    return subscriptionService.getOrCreateCustomerSubscription(
      customerContext.type,
      customerContext.id,
      customerContext.name
    );
  }, [customerContext, version]);

  // Current customer invoices
  const customerInvoices = useMemo(() => {
    return subscriptionService.getInvoices(customerContext.id);
  }, [customerContext.id, version]);

  // Global metrics for App Owner
  const commercialMetrics = useMemo(() => {
    return subscriptionService.getCommercialMetrics();
  }, [version]);

  const allSubscriptions = useMemo(() => {
    return subscriptionService.getAllSubscriptions();
  }, [version]);

  const allInvoices = useMemo(() => {
    return subscriptionService.getInvoices();
  }, [version]);

  // Upgrade Plan handler
  const upgradeToPlan = async (
    targetPlanId: string
  ): Promise<{ success: boolean; invoice?: Invoice }> => {
    setIsLoading(true);
    try {
      const res = await subscriptionService.upgradeSubscription(
        customerContext.type,
        customerContext.id,
        targetPlanId,
        {
          id: userProfile?.id || customerContext.id,
          role: role || 'customer',
          name: userProfile?.displayName || customerContext.name,
        }
      );

      // If company context, synchronize company.planId
      if (customerContext.type === 'company' && activeCompany?.id) {
        await updateCompany(activeCompany.id, { planId: targetPlanId });
      }

      refreshSubscriptions();
      return { success: true, invoice: res.invoice };
    } catch (err) {
      console.error('Failed to upgrade subscription:', err);
      return { success: false };
    } finally {
      setIsLoading(false);
    }
  };

  // Downgrade Plan handler
  const downgradeToPlan = async (targetPlanId: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      subscriptionService.downgradeSubscription(
        customerContext.type,
        customerContext.id,
        targetPlanId,
        {
          id: userProfile?.id || customerContext.id,
          role: role || 'customer',
          name: userProfile?.displayName || customerContext.name,
        }
      );

      if (customerContext.type === 'company' && activeCompany?.id) {
        await updateCompany(activeCompany.id, { planId: targetPlanId });
      }

      refreshSubscriptions();
      return true;
    } catch (err) {
      console.error('Failed to downgrade subscription:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Cancel Subscription handler
  const cancelSubscription = async (atPeriodEnd = true): Promise<boolean> => {
    if (!currentSubscription) return false;
    setIsLoading(true);
    try {
      subscriptionService.cancelSubscription(currentSubscription.subscriptionId, atPeriodEnd, {
        id: userProfile?.id || customerContext.id,
        role: role || 'customer',
      });
      refreshSubscriptions();
      return true;
    } catch (err) {
      console.error('Failed to cancel subscription:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Grant Complimentary (App Owner)
  const grantComplimentary = async (
    customerType: CustomerType,
    customerId: string,
    planId: string,
    durationDays = 365,
    reason = 'VIP Access'
  ): Promise<boolean> => {
    try {
      subscriptionService.grantComplimentaryAccess(
        customerType,
        customerId,
        planId,
        durationDays,
        reason,
        { id: userProfile?.id || 'app_owner', role: role || 'app_owner' }
      );
      refreshSubscriptions();
      return true;
    } catch (err) {
      console.error('Failed to grant complimentary access:', err);
      return false;
    }
  };

  return (
    <SubscriptionContext.Provider
      value={{
        currentSubscription,
        customerInvoices,
        commercialMetrics,
        allSubscriptions,
        allInvoices,
        upgradeToPlan,
        downgradeToPlan,
        cancelSubscription,
        grantComplimentary,
        refreshSubscriptions,
        isLoading,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = (): SubscriptionContextType => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};
