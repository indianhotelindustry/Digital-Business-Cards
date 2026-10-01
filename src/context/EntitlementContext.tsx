import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { entitlementService, FEATURE_CATALOGUE, FEATURE_MAP } from '../services/entitlementService';
import { subscriptionService } from '../services/subscriptionService';
import {
  EffectiveEntitlement,
  EntitlementStatus,
  LimitUnit,
  Plan,
  EntitlementOverride,
  GlobalPlatformPolicy,
  EntitlementAuditLog,
} from '../types/entitlement';

interface EntitlementContextType {
  can: (featureId: string) => boolean;
  getEntitlement: (featureId: string) => EffectiveEntitlement;
  getLimit: (featureId: string) => { limit: number; unit?: LimitUnit; isUnlimited: boolean };
  getUsage: (featureId: string) => { current: number; limit?: number; unit?: LimitUnit; remaining?: number };
  checkLimit: (featureId: string, requestedAmount?: number) => boolean;
  isLocked: (featureId: string) => { isLocked: boolean; reason: string; upgradePlanId?: string };
  effectiveEntitlements: Record<string, EffectiveEntitlement>;
  plans: Plan[];
  overrides: EntitlementOverride[];
  globalPolicy: GlobalPlatformPolicy;
  auditLogs: EntitlementAuditLog[];
  refresh: () => void;
  openUpgradeModal: (featureId?: string) => void;
  closeUpgradeModal: () => void;
  isUpgradeModalOpen: boolean;
  upgradeModalFeatureId?: string;
}

const EntitlementContext = createContext<EntitlementContextType | null>(null);

export const EntitlementProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userProfile, activeCompany, role } = useAuth();
  const [version, setVersion] = useState(0);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [upgradeModalFeatureId, setUpgradeModalFeatureId] = useState<string | undefined>(undefined);

  useEffect(() => {
    const unsubEnt = entitlementService.subscribe(() => {
      setVersion((v) => v + 1);
    });
    const unsubSub = subscriptionService.subscribe(() => {
      setVersion((v) => v + 1);
    });
    return () => {
      unsubEnt();
      unsubSub();
    };
  }, []);

  const refresh = () => setVersion((v) => v + 1);

  const subject = useMemo(() => {
    const userId = userProfile?.employeeId || userProfile?.id || null;
    const companyId = activeCompany?.id || userProfile?.companyId || null;

    let resolvedPlanId = activeCompany?.planId || 'company_free';
    if (role === 'company_admin' && companyId) {
      const sub = subscriptionService.getSubscriptionForCustomer('company', companyId);
      resolvedPlanId = sub?.planId || activeCompany?.planId || 'company_free';
    } else if (role === 'employee' && userId) {
      const sub = subscriptionService.getSubscriptionForCustomer('individual', userId);
      resolvedPlanId = sub?.planId || activeCompany?.planId || 'individual_free';
    }

    return {
      userId,
      companyId,
      role: role,
      planId: resolvedPlanId,
    };
  }, [userProfile, activeCompany, role, version]);

  const can = (featureId: string): boolean => {
    return entitlementService.can(subject, featureId);
  };

  const getEntitlement = (featureId: string): EffectiveEntitlement => {
    return entitlementService.getEntitlement(subject, featureId);
  };

  const getLimit = (featureId: string) => {
    return entitlementService.getLimit(subject, featureId);
  };

  const getUsage = (featureId: string) => {
    return entitlementService.getUsage(subject, featureId);
  };

  const checkLimit = (featureId: string, requestedAmount = 1) => {
    return entitlementService.checkLimit(subject, featureId, requestedAmount);
  };

  const isLocked = (featureId: string) => {
    return entitlementService.isFeatureLocked(subject, featureId);
  };

  const effectiveEntitlements = useMemo(() => {
    return entitlementService.getAllEffectiveEntitlements(subject);
  }, [subject, version]);

  const plans = useMemo(() => entitlementService.getPlans(), [version]);
  const overrides = useMemo(() => entitlementService.getOverrides(), [version]);
  const globalPolicy = useMemo(() => entitlementService.getGlobalPolicy(), [version]);
  const auditLogs = useMemo(() => entitlementService.getAuditLogs(100), [version]);

  const openUpgradeModal = (featureId?: string) => {
    setUpgradeModalFeatureId(featureId);
    setIsUpgradeModalOpen(true);
  };

  const closeUpgradeModal = () => {
    setIsUpgradeModalOpen(false);
    setUpgradeModalFeatureId(undefined);
  };

  return (
    <EntitlementContext.Provider
      value={{
        can,
        getEntitlement,
        getLimit,
        getUsage,
        checkLimit,
        isLocked,
        effectiveEntitlements,
        plans,
        overrides,
        globalPolicy,
        auditLogs,
        refresh,
        openUpgradeModal,
        closeUpgradeModal,
        isUpgradeModalOpen,
        upgradeModalFeatureId,
      }}
    >
      {children}
    </EntitlementContext.Provider>
  );
};

export const useEntitlement = () => {
  const context = useContext(EntitlementContext);
  if (!context) {
    throw new Error('useEntitlement must be used within an EntitlementProvider');
  }
  return context;
};
