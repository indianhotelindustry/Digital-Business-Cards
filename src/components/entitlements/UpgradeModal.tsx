import React, { useState } from 'react';
import { useEntitlement } from '../../context/EntitlementContext';
import { useAuth } from '../../context/AuthContext';
import { useSubscription } from '../../context/SubscriptionContext';
import { FEATURE_MAP } from '../../services/entitlementService';
import {
  X,
  Check,
  Zap,
  Shield,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Lock,
} from 'lucide-react';

export const UpgradeModal: React.FC = () => {
  const { isUpgradeModalOpen, closeUpgradeModal, upgradeModalFeatureId, plans, refresh, effectiveEntitlements } =
    useEntitlement();
  const { activeCompany, role, userProfile } = useAuth();
  const { currentSubscription, upgradeToPlan, isLoading } = useSubscription();

  const [isProcessing, setIsProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  if (!isUpgradeModalOpen) return null;

  const targetFeature = upgradeModalFeatureId ? FEATURE_MAP.get(upgradeModalFeatureId) : null;
  const isCompanyContext = !!activeCompany?.id || role === 'company_admin';

  const relevantPlans = plans.filter((p) =>
    isCompanyContext ? p.targetType === 'company' : p.targetType === 'individual'
  );

  const currentPlan = plans.find((p) => p.id === currentSubscription?.planId) || relevantPlans[0];
  const proPlan = relevantPlans.find((p) => p.id.includes('pro')) || relevantPlans[1] || relevantPlans[0];

  const handleUpgrade = async (planId: string) => {
    setIsProcessing(true);
    setNoticeMessage(null);
    try {
      const res = await upgradeToPlan(planId);
      if (!res.success) setNoticeMessage(res.message || 'Your plan was not changed.');
      if (res.success) {
        refresh();
        setSuccessMessage(`Subscription plan successfully upgraded to ${plans.find(p => p.id === planId)?.name}! Data preserved.`);
        setTimeout(() => {
          setSuccessMessage(null);
          closeUpgradeModal();
        }, 1500);
      }
    } catch (err) {
      console.error('Failed to upgrade plan:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-4xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 relative max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={closeUpgradeModal}
          className="absolute top-6 right-6 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Feature Lock Notice Header (Requirement 8) */}
        {targetFeature && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-50/80 border border-amber-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
                    Feature Locked
                  </span>
                  <span className="text-xs font-bold text-slate-900">— {targetFeature.name}</span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  Your current plan ({currentPlan?.name}) does not include {targetFeature.name.toLowerCase()}.
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5 italic">
                  {targetFeature.description}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3 shrink-0">
              <div className="text-right hidden sm:block">
                <span className="text-[10px] text-slate-400 block uppercase">Required Tier</span>
                <span className="text-xs font-bold text-slate-900">{proPlan?.name}</span>
              </div>
              <button
                onClick={() => handleUpgrade(proPlan.id)}
                disabled={isProcessing}
                className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-xs transition"
              >
                Upgrade to {proPlan?.name}
              </button>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="text-center max-w-xl mx-auto mb-8">
          <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200 mb-3">
            <Sparkles className="w-3.5 h-3.5 mr-1.5 text-teal-600" />
            Flexible SaaS Entitlements & Pricing
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            {targetFeature ? `Upgrade to Unlock ${targetFeature.name}` : 'Upgrade Your Subscription'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-2">
            Switch plans with complete data preservation. All previously created cards, employees, and settings remain 100% intact.
          </p>
        </div>

        {noticeMessage && (
          <div className="mb-4 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium">
            {noticeMessage}
          </div>
        )}
        {successMessage ? (
          <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-2xl text-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
            <p className="text-base font-bold text-emerald-800">{successMessage}</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            {relevantPlans.map((plan) => {
              const isCurrent = currentSubscription?.planId === plan.id;
              const isPopular = plan.isPopular;

              return (
                <div
                  key={plan.id}
                  className={`rounded-2xl p-6 border flex flex-col justify-between relative transition ${
                    isCurrent
                      ? 'border-teal-500/80 bg-teal-50/20 shadow-xs'
                      : isPopular
                      ? 'border-teal-500 shadow-md ring-2 ring-teal-500/20 bg-white'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  {isPopular && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-teal-600 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-0.5 rounded-full shadow-xs">
                      Most Popular
                    </span>
                  )}

                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold text-slate-900">{plan.name}</h3>
                      {isCurrent && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-teal-100 text-teal-800">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1 min-h-[32px]">
                      {plan.description}
                    </p>

                    <div className="mt-4 mb-6">
                      <div className="flex items-baseline">
                        <span className="text-3xl font-extrabold text-slate-900">
                          {plan.price === 0 ? 'Free' : `₹${plan.price}`}
                        </span>
                        {plan.price > 0 && (
                          <span className="text-xs text-slate-500 ml-1">/{plan.billingCycle}</span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2.5 text-xs text-slate-700 border-t border-slate-100 pt-4">
                      {Object.entries(plan.features)
                        .filter(([_, rule]) => rule.status !== 'DISABLED')
                        .slice(0, 6)
                        .map(([featId, rule]) => {
                          const def = FEATURE_MAP.get(featId);
                          return (
                            <div key={featId} className="flex items-center space-x-2">
                              <Check className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                              <span className="truncate">
                                {def?.name || featId}
                                {rule.status === 'LIMITED' && rule.limit && (
                                  <span className="text-slate-400 font-medium ml-1">
                                    (up to {rule.limit})
                                  </span>
                                )}
                              </span>
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-100">
                    {isCurrent ? (
                      <button
                        disabled
                        className="w-full py-2.5 px-4 rounded-xl bg-slate-100 text-slate-400 text-xs font-semibold cursor-not-allowed text-center"
                      >
                        Current Plan
                      </button>
                    ) : (
                      <button
                        onClick={() => handleUpgrade(plan.id)}
                        disabled={isProcessing || isLoading}
                        className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold shadow-xs flex items-center justify-center space-x-1.5 transition ${
                          isPopular
                            ? 'bg-teal-600 hover:bg-teal-700 text-white'
                            : 'bg-slate-900 hover:bg-slate-800 text-white'
                        }`}
                      >
                        <span>Upgrade to {plan.name}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-8 pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400">
          <div className="flex items-center space-x-2">
            <Shield className="w-4 h-4 text-slate-400" />
            <span>Instant provisioning with authoritative entitlement resolution & data preservation</span>
          </div>
          <span className="mt-2 sm:mt-0">Need custom volume limits? Contact Platform Owner</span>
        </div>
      </div>
    </div>
  );
};
