import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { Subscription, Invoice, CommercialMetrics, CustomerType } from '../types/subscription';
import { subscriptionService, type PlanChangeResult } from '../services/subscriptionService';
import { commercialStore } from '../services/commercialStore';
import { runBackendAction } from '../lib/backend';

// Directive 25: the subscription shown here is the backend's (time-adjusted)
// record. Customers can request a checkout or a cancellation; nothing in the
// browser changes a plan, a status or a payment state.

interface SubscriptionContextType {
  currentSubscription: Subscription | null;
  customerInvoices: Invoice[];
  commercialMetrics: CommercialMetrics;
  allSubscriptions: Subscription[];
  allInvoices: Invoice[];
  upgradeToPlan: (targetPlanId: string) => Promise<PlanChangeResult & { invoice?: Invoice }>;
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
  /** Last message from the backend for a request that did not go through. */
  lastMessage: string | null;
  isLoading: boolean;
}

const SubscriptionContext = createContext<SubscriptionContextType | null>(null);

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userProfile, currentUser } = useAuth();
  const [version, setVersion] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [lastMessage, setLastMessage] = useState<string | null>(null);

  useEffect(() => subscriptionService.subscribe(() => setVersion((v) => v + 1)), []);

  const refreshSubscriptions = useCallback(() => {
    void commercialStore.refreshSnapshot();
    setVersion((v) => v + 1);
  }, []);

  const currentSubscription = useMemo(() => subscriptionService.getCurrentSubscription(), [version]);
  const customerInvoices = useMemo(() => subscriptionService.getInvoices(), [version]);
  const commercialMetrics = useMemo(() => subscriptionService.getCommercialMetrics(), [version]);
  const allSubscriptions = useMemo(() => subscriptionService.getAllSubscriptions(), [version]);
  const allInvoices = useMemo(() => subscriptionService.getInvoices(), [version]);

  const ownCustomer = () => commercialStore.snapshot?.subject ?? null;

  const upgradeToPlan = async (targetPlanId: string): Promise<PlanChangeResult & { invoice?: Invoice }> => {
    const customer = ownCustomer();
    if (!customer) {
      const message = 'Your plan could not be loaded from the server. Please sign in again.';
      setLastMessage(message);
      return { success: false, message };
    }
    setIsLoading(true);
    try {
      const res = await subscriptionService.upgradeSubscription(customer.customerType, customer.customerId, targetPlanId, {
        name: userProfile?.displayName,
        email: currentUser?.email || undefined,
      });
      setLastMessage(res.success ? null : res.message ?? null);
      const invoiceId = res.checkout?.invoiceId;
      return { ...res, invoice: invoiceId ? subscriptionService.getInvoiceById(invoiceId) : undefined };
    } finally {
      setIsLoading(false);
    }
  };

  const downgradeToPlan = async (targetPlanId: string): Promise<boolean> => {
    const customer = ownCustomer();
    if (!customer) return false;
    setIsLoading(true);
    try {
      const res = await subscriptionService.downgradeSubscription(customer.customerType, customer.customerId, targetPlanId);
      setLastMessage(res.message ?? null);
      return res.success;
    } finally {
      setIsLoading(false);
    }
  };

  const cancelSubscription = async (atPeriodEnd = true): Promise<boolean> => {
    if (!currentSubscription) return false;
    setIsLoading(true);
    try {
      const res = await subscriptionService.cancelSubscription(currentSubscription.subscriptionId, atPeriodEnd);
      setLastMessage(res.success ? null : res.message ?? null);
      return res.success;
    } finally {
      setIsLoading(false);
    }
  };

  const grantComplimentary = async (
    customerType: CustomerType,
    customerId: string,
    planId: string,
    durationDays = 365,
    reason = 'VIP Access'
  ): Promise<boolean> => {
    const ok = await runBackendAction(() => subscriptionService.grantComplimentaryAccess(customerType, customerId, planId, durationDays, reason));
    setLastMessage(null);
    return ok;
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
        lastMessage,
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
