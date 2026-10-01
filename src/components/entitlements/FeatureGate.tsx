import React from 'react';
import { useEntitlement } from '../../context/EntitlementContext';
import { FEATURE_MAP } from '../../services/entitlementService';
import { Lock, Sparkles, ArrowUpRight, AlertCircle } from 'lucide-react';

interface FeatureGateProps {
  feature: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showLockedCard?: boolean;
  inlineBadgeOnly?: boolean;
}

export const FeatureGate: React.FC<FeatureGateProps> = ({
  feature,
  children,
  fallback,
  showLockedCard = false,
  inlineBadgeOnly = false,
}) => {
  const { can, isLocked, getEntitlement, openUpgradeModal } = useEntitlement();
  const allowed = can(feature);
  const lockInfo = isLocked(feature);
  const entitlement = getEntitlement(feature);
  const def = FEATURE_MAP.get(feature);

  if (allowed) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (inlineBadgeOnly) {
    return (
      <span
        onClick={() => openUpgradeModal(feature)}
        className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 cursor-pointer hover:bg-amber-100 transition"
      >
        <Lock className="w-3 h-3 mr-1 text-amber-600" /> Upgrade Required
      </span>
    );
  }

  if (showLockedCard) {
    return (
      <div className="bg-slate-50/80 border border-dashed border-slate-300 rounded-2xl p-6 text-center">
        <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-3">
          <Lock className="w-5 h-5" />
        </div>
        <h4 className="text-sm font-bold text-slate-800">
          {def?.name || 'Feature Locked'}
        </h4>
        <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
          {lockInfo.reason || 'This feature is not included in your current subscription tier.'}
        </p>
        <button
          onClick={() => openUpgradeModal(feature)}
          className="inline-flex items-center px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 shadow-xs transition"
        >
          <Sparkles className="w-3.5 h-3.5 mr-1.5 text-teal-400" />
          <span>Unlock Feature</span>
          <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
        </button>
      </div>
    );
  }

  return null;
};
