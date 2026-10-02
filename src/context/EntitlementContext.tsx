import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import { entitlementService } from '../services/entitlementService';
import { commercialStore, purgeLegacyAuthorityKeys, type CommercialSession } from '../services/commercialStore';
import {
  EffectiveEntitlement,
  LimitUnit,
  Plan,
  EntitlementOverride,
  GlobalPlatformPolicy,
  EntitlementAuditLog,
} from '../types/entitlement';

// Directive 25: entitlements shown here come from the backend
// (getMyCommercialState). The provider only tells the commercial store who is
// signed in; it never decides a plan, role or entitlement itself.

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
  /** True once the server snapshot for the signed-in user has loaded. */
  entitlementsLoaded: boolean;
  entitlementsError: string | null;
  refresh: () => void;
  openUpgradeModal: (featureId?: string) => void;
  closeUpgradeModal: () => void;
  isUpgradeModalOpen: boolean;
  upgradeModalFeatureId?: string;
}

const EntitlementContext = createContext<EntitlementContextType | null>(null);

export const EntitlementProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, userProfile, activeCompany, isAppOwner } = useAuth();
  const [version, setVersion] = useState(0);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [upgradeModalFeatureId, setUpgradeModalFeatureId] = useState<string | undefined>(undefined);

  useEffect(() => {
    purgeLegacyAuthorityKeys();
    return entitlementService.subscribe(() => setVersion((v) => v + 1));
  }, []);

  // Only a real Firebase session has a server identity. Demo personas (DEV
  // only) get no commercial session, so every gated feature shows as locked.
  const session = useMemo<CommercialSession | null>(() => {
    if (!currentUser) return null;
    return {
      uid: currentUser.uid,
      isAppOwner: isAppOwner,
      userIds: [userProfile?.employeeId, currentUser.uid].filter((v): v is string => !!v),
      companyId: userProfile?.companyId || activeCompany?.id || null,
    };
  }, [currentUser, isAppOwner, userProfile?.employeeId, userProfile?.companyId, activeCompany?.id]);

  useEffect(() => {
    commercialStore.setSession(session);
  }, [session]);

  const refresh = () => {
    void commercialStore.refreshSnapshot();
    setVersion((v) => v + 1);
  };

  const subject = useMemo(
    () => ({
      userId: userProfile?.employeeId || userProfile?.id || null,
      companyId: activeCompany?.id || userProfile?.companyId || null,
    }),
    [userProfile, activeCompany]
  );

  const effectiveEntitlements = useMemo(() => entitlementService.getAllEffectiveEntitlements(subject), [subject, version]);
  const plans = useMemo(() => entitlementService.getPlans(), [version]);
  const overrides = useMemo(() => entitlementService.getOverrides(), [version]);
  const globalPolicy = useMemo(() => entitlementService.getGlobalPolicy(), [version]);
  const auditLogs = useMemo(() => entitlementService.getAuditLogs(100), [version]);

  return (
    <EntitlementContext.Provider
      value={{
        can: (featureId) => entitlementService.can(subject, featureId),
        getEntitlement: (featureId) => entitlementService.getEntitlement(subject, featureId),
        getLimit: (featureId) => entitlementService.getLimit(subject, featureId),
        getUsage: (featureId) => entitlementService.getUsage(subject, featureId),
        checkLimit: (featureId, requestedAmount = 1) => entitlementService.checkLimit(subject, featureId, requestedAmount),
        isLocked: (featureId) => entitlementService.isFeatureLocked(subject, featureId),
        effectiveEntitlements,
        plans,
        overrides,
        globalPolicy,
        auditLogs,
        entitlementsLoaded: !!commercialStore.snapshot,
        entitlementsError: commercialStore.snapshotError,
        refresh,
        openUpgradeModal: (featureId?: string) => {
          setUpgradeModalFeatureId(featureId);
          setIsUpgradeModalOpen(true);
        },
        closeUpgradeModal: () => {
          setIsUpgradeModalOpen(false);
          setUpgradeModalFeatureId(undefined);
        },
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
