import React, { useState } from 'react';
import {
  Check,
  X,
  Sparkles,
  ArrowRight,
  Shield,
  HelpCircle,
  Building2,
  User,
  ArrowLeft,
  CreditCard,
  Zap,
} from 'lucide-react';
import { entitlementService, FEATURE_CATALOGUE } from '../../services/entitlementService';
import { Plan, FeatureDefinition } from '../../types/entitlement';

interface PublicPricingPageProps {
  onBackToApp: () => void;
  onSelectPlan?: (planId: string) => void;
}

export const PublicPricingPage: React.FC<PublicPricingPageProps> = ({
  onBackToApp,
  onSelectPlan,
}) => {
  const [targetType, setTargetType] = useState<'individual' | 'company'>('individual');
  const [billingCycle, setBillingCycle] = useState<'yearly' | 'monthly'>('yearly');

  const plans = entitlementService.getPlans().filter((p) => p.isActive);
  const relevantPlans = plans.filter((p) => p.targetType === targetType);

  // Group features by category/scope
  const individualFeatures = FEATURE_CATALOGUE.filter(
    (f) => f.scope === 'individual' || f.category === 'individual'
  );
  const companyFeatures = FEATURE_CATALOGUE.filter(
    (f) => f.scope === 'company' || f.category === 'company'
  );

  const activeFeatures = targetType === 'individual' ? individualFeatures : companyFeatures;

  const renderFeatureStatus = (plan: Plan, feature: FeatureDefinition) => {
    const rule = plan.features[feature.id];
    if (!rule || rule.status === 'DISABLED') {
      return (
        <span className="inline-flex items-center text-slate-300">
          <X className="w-4 h-4" />
        </span>
      );
    }
    if (rule.status === 'ENABLED' || rule.status === 'UNLIMITED') {
      return (
        <span className="inline-flex items-center text-teal-600 font-semibold">
          <Check className="w-4 h-4 mr-1" />
          <span className="text-[11px]">{rule.status === 'UNLIMITED' ? 'Unlimited' : 'Included'}</span>
        </span>
      );
    }
    if (rule.status === 'LIMITED') {
      return (
        <span className="inline-flex items-center text-slate-700 font-medium text-[11px]">
          <Check className="w-3.5 h-3.5 mr-1 text-teal-600" />
          Up to {rule.limit} {rule.limitUnit ? rule.limitUnit.toLowerCase().replace('_', ' ') : ''}
        </span>
      );
    }
    return <span className="text-slate-400 text-xs">—</span>;
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans selection:bg-teal-500 selection:text-white">
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40 px-4 sm:px-8 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={onBackToApp}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition flex items-center space-x-1.5 text-xs font-semibold"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to App</span>
            </button>
            <div className="h-4 w-px bg-slate-800 hidden sm:block"></div>
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 rounded-lg bg-teal-600 flex items-center justify-center font-black text-white text-xs">
                DS
              </div>
              <span className="font-bold tracking-tight text-white text-sm">DSBC Commercial SaaS</span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={onBackToApp}
              className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition shadow-xs"
            >
              Go to Workspace
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        {/* Hero Section */}
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
          <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-teal-500/10 text-teal-400 border border-teal-500/20 mb-4">
            <Sparkles className="w-3.5 h-3.5 mr-1.5" />
            Transparent & Configurable SaaS Pricing
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
            Flexible plans designed for individuals & growing enterprises
          </h1>
          <p className="mt-4 text-sm sm:text-base text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Elevate your digital identity, showcase portfolio milestones, capture leads with AI, and empower your corporate workforce with unified smart cards.
          </p>

          {/* Segment Selector Tabs */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <div className="inline-flex p-1 rounded-2xl bg-slate-800 border border-slate-700/80 shadow-inner">
              <button
                onClick={() => setTargetType('individual')}
                className={`flex items-center px-5 py-2.5 rounded-xl text-xs font-bold transition ${
                  targetType === 'individual'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <User className="w-4 h-4 mr-2" />
                Individual Professionals
              </button>
              <button
                onClick={() => setTargetType('company')}
                className={`flex items-center px-5 py-2.5 rounded-xl text-xs font-bold transition ${
                  targetType === 'company'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Building2 className="w-4 h-4 mr-2" />
                Company & Teams
              </button>
            </div>

            {/* Annual vs Monthly Toggle */}
            <div className="inline-flex items-center space-x-2 text-xs text-slate-400 bg-slate-800/60 px-3.5 py-2 rounded-xl border border-slate-700/60">
              <span className={billingCycle === 'monthly' ? 'text-white font-bold' : ''}>Monthly</span>
              <button
                onClick={() => setBillingCycle(billingCycle === 'yearly' ? 'monthly' : 'yearly')}
                className={`w-9 h-5 rounded-full p-0.5 transition-colors ${
                  billingCycle === 'yearly' ? 'bg-teal-600' : 'bg-slate-700'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    billingCycle === 'yearly' ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
              <span className={billingCycle === 'yearly' ? 'text-teal-400 font-bold' : ''}>
                Annual <span className="text-[10px] text-teal-400 font-mono">(Save ~20%)</span>
              </span>
            </div>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 mb-16 items-stretch">
          {relevantPlans.map((plan) => {
            const isFree = plan.price === 0;
            const isPopular = plan.isPopular;
            const displayPrice = isFree
              ? '₹0'
              : billingCycle === 'yearly'
              ? `₹${plan.price}`
              : `₹${Math.round(plan.price / 10)}`;

            const displayInterval = isFree
              ? 'Forever Free'
              : billingCycle === 'yearly'
              ? '/ year'
              : '/ month';

            return (
              <div
                key={plan.id}
                className={`rounded-3xl p-6 sm:p-8 flex flex-col justify-between relative transition duration-200 border ${
                  isPopular
                    ? 'bg-gradient-to-b from-slate-800 to-slate-850 border-teal-500 shadow-xl shadow-teal-950/40 ring-1 ring-teal-500'
                    : 'bg-slate-850 border-slate-800 hover:border-slate-700'
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase bg-teal-500 text-slate-950 shadow-md">
                    Most Popular
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-bold text-white tracking-tight">{plan.name}</h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 border border-slate-700">
                      {plan.targetType.toUpperCase()}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 min-h-[32px] leading-relaxed mb-6">
                    {plan.description}
                  </p>

                  <div className="mb-6 pb-6 border-b border-slate-800 flex items-baseline space-x-1">
                    <span className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                      {displayPrice}
                    </span>
                    <span className="text-xs font-medium text-slate-400">{displayInterval}</span>
                  </div>

                  {/* Highlights */}
                  <div className="space-y-3 mb-8">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Features Included:
                    </div>
                    {Object.entries(plan.features)
                      .filter(([_, rule]) => rule.status !== 'DISABLED')
                      .slice(0, 7)
                      .map(([featId, rule]) => {
                        const feat = FEATURE_CATALOGUE.find((f) => f.id === featId);
                        return (
                          <div key={featId} className="flex items-start text-xs text-slate-300">
                            <Check className="w-4 h-4 text-teal-400 shrink-0 mr-2 mt-0.5" />
                            <span>
                              {feat?.name || featId}
                              {rule.status === 'LIMITED' && (
                                <span className="text-[11px] text-slate-400 ml-1">
                                  ({rule.limit} {rule.limitUnit?.toLowerCase()})
                                </span>
                              )}
                              {rule.status === 'UNLIMITED' && (
                                <span className="text-[11px] text-teal-400 ml-1">(Unlimited)</span>
                              )}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </div>

                <button
                  onClick={() => {
                    if (onSelectPlan) {
                      onSelectPlan(plan.id);
                    } else {
                      onBackToApp();
                    }
                  }}
                  className={`w-full py-3 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 ${
                    isPopular
                      ? 'bg-teal-500 hover:bg-teal-400 text-slate-950 shadow-md hover:shadow-lg'
                      : isFree
                      ? 'bg-slate-800 hover:bg-slate-700 text-white'
                      : 'bg-white hover:bg-slate-100 text-slate-900'
                  }`}
                >
                  <span>{isFree ? 'Get Started Free' : 'Choose ' + plan.name}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Feature Comparison Matrix */}
        <div className="bg-slate-850 rounded-3xl border border-slate-800 overflow-hidden shadow-xl mb-16">
          <div className="p-6 bg-slate-900 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Full Feature & Quota Comparison Matrix
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Authoritatively derived from active App Owner plans in the Entitlement Engine.
              </p>
            </div>
            <span className="text-[10px] font-mono px-3 py-1 rounded-full bg-slate-800 text-teal-400 border border-slate-700">
              Live Verified Catalogue
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/50 text-slate-400 font-semibold uppercase text-[10px]">
                  <th className="py-3.5 px-6 min-w-[220px]">Capability / Feature</th>
                  {relevantPlans.map((plan) => (
                    <th key={plan.id} className="py-3.5 px-4 text-center min-w-[140px]">
                      {plan.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {activeFeatures.map((feat) => (
                  <tr key={feat.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-6">
                      <div className="font-semibold text-slate-200">{feat.name}</div>
                      <div className="text-[10px] text-slate-400 leading-tight">{feat.description}</div>
                    </td>
                    {relevantPlans.map((plan) => (
                      <td key={plan.id} className="py-3 px-4 text-center">
                        {renderFeatureStatus(plan, feat)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto space-y-6">
          <h2 className="text-xl font-bold text-center text-white mb-8">Frequently Asked Questions</h2>

          <div className="bg-slate-850 p-5 rounded-2xl border border-slate-800">
            <h4 className="font-bold text-sm text-white">Can I change or cancel my plan at any time?</h4>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              Yes. Upgrades take effect immediately with full data preservation. Cancellations remain active until the end of your prepaid period.
            </p>
          </div>

          <div className="bg-slate-850 p-5 rounded-2xl border border-slate-800">
            <h4 className="font-bold text-sm text-white">What happens to my data if I downgrade to Free?</h4>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              We never delete your cards, employees, or profile content upon downgrade. Your existing data remains 100% preserved. Over-quota capabilities will simply be locked from adding new items until you re-upgrade.
            </p>
          </div>

          <div className="bg-slate-850 p-5 rounded-2xl border border-slate-800">
            <h4 className="font-bold text-sm text-white">Are payment receipts and tax invoices provided?</h4>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              Yes. Every successful subscription payment automatically generates a GST-compliant tax receipt downloadable anytime from your Account Center.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950 py-8 px-4 text-center text-xs text-slate-500">
        <p>© 2026 DSBC SaaS Platform. All Rights Reserved. Built with Zero-Trust Multi-Tenant Architecture.</p>
      </footer>
    </div>
  );
};
