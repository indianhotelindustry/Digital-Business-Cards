export type EntitlementStatus = 'DISABLED' | 'ENABLED' | 'LIMITED' | 'UNLIMITED';

export type LimitUnit = 'COUNT' | 'STORAGE_MB' | 'REQUESTS' | 'EMPLOYEES' | 'AI_USAGE';

export type FeatureCategory = 'individual' | 'company' | 'platform';

export type FeatureScope = 'individual' | 'company' | 'both';

export type OverrideGrantType = 'permanent' | 'until_date' | 'trial' | 'complimentary';

export type EntitlementSource =
  | 'global_policy'
  | 'plan_policy'
  | 'company_override'
  | 'individual_override';

export interface EntitlementRule {
  status: EntitlementStatus;
  limit?: number;
  limitUnit?: LimitUnit;
}

export interface FeatureDefinition {
  id: string;
  name: string;
  description: string;
  category: FeatureCategory;
  scope: FeatureScope;
  defaultEntitlement: EntitlementStatus;
  limitUnit?: LimitUnit;
  defaultLimit?: number;
  icon?: string;
  badge?: string;
}

export interface Plan {
  id: string;
  name: string;
  targetType: 'individual' | 'company';
  description: string;
  price: number; // e.g. 0, 100, 500
  currency: string; // 'INR', 'USD', etc.
  billingCycle: 'monthly' | 'yearly' | 'lifetime' | 'free';
  isActive: boolean;
  isPopular?: boolean;
  features: Record<string, EntitlementRule>; // featureId -> EntitlementRule
  createdAt: string;
  updatedAt: string;
}

export interface EntitlementOverride {
  id: string;
  targetType: 'individual' | 'company';
  targetId: string; // userId or companyId
  targetName?: string;
  featureId: string;
  rule: EntitlementRule;
  grantType: OverrideGrantType;
  validFrom: string;
  expiresAt?: string | null;
  reason: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface EffectiveEntitlement {
  featureId: string;
  featureName: string;
  status: EntitlementStatus;
  isGranted: boolean;
  limit?: number;
  limitUnit?: LimitUnit;
  used?: number;
  remaining?: number;
  source: EntitlementSource;
  sourceDescription: string;
  expiresAt?: string | null;
  isExpired?: boolean;
}

export interface EntitlementAuditLog {
  id: string;
  actorUserId: string;
  actorName: string;
  targetType: 'company' | 'individual' | 'plan' | 'global';
  targetId: string;
  targetName: string;
  featureId?: string;
  featureName?: string;
  previousValue: string;
  newValue: string;
  reason: string;
  timestamp: string;
  source: string;
}

export interface GlobalPlatformPolicy {
  id: string;
  maintenanceMode: boolean;
  allowSelfRegistration: boolean;
  defaultIndividualPlanId: string;
  defaultCompanyPlanId: string;
  defaultTrialDays: number;
  enforceLimitsStrictly: boolean;
  currency: string;
  currencySymbol: string;
  platformName: string;
  globalFeatureOverrides: Record<string, EntitlementRule>;
}

export interface UsageMetric {
  targetId: string;
  targetType: 'individual' | 'company';
  featureId: string;
  currentValue: number;
  unit: LimitUnit;
  updatedAt: string;
}
