import React, { useState } from 'react';
import { GlobalPlatformPolicy, Plan } from '../../types/entitlement';
import { entitlementService } from '../../services/entitlementService';
import {
  Settings,
  Save,
  Shield,
  Check,
  AlertTriangle,
  Lock,
  Globe,
  DollarSign,
} from 'lucide-react';
import { runBackendAction } from '../../lib/backend';

interface SaaSPlatformSettingsTabProps {
  globalPolicy: GlobalPlatformPolicy;
  plans: Plan[];
  onRefresh: () => void;
  actorInfo?: { id: string; name: string };
}

export const SaaSPlatformSettingsTab: React.FC<SaaSPlatformSettingsTabProps> = ({
  globalPolicy,
  plans,
  onRefresh,
  actorInfo,
}) => {
  const [formData, setFormData] = useState<GlobalPlatformPolicy>({ ...globalPolicy });
  const [isSaved, setIsSaved] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!(await runBackendAction(() => entitlementService.updateGlobalPolicy(formData, actorInfo)))) return;
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
    onRefresh();
  };

  const individualPlans = plans.filter((p) => p.targetType === 'individual');
  const companyPlans = plans.filter((p) => p.targetType === 'company');

  return (
    <div className="space-y-6 animate-in fade-in max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Platform Global Policy & Settings</h2>
          <p className="text-xs text-slate-500">
            System-wide baselines, registration gates, default subscription assignments, and platform parameters.
          </p>
        </div>

        {isSaved && (
          <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-xl flex items-center">
            <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" />
            Global Settings Saved
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* General Platform Controls */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
            General Platform Settings
          </h3>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Platform Display Name
              </label>
              <input
                type="text"
                value={formData.platformName}
                onChange={(e) => setFormData({ ...formData, platformName: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Currency Code
                </label>
                <select
                  value={formData.currency}
                  onChange={(e) => {
                    const c = e.target.value;
                    let sym = '₹';
                    if (c === 'USD') sym = '$';
                    if (c === 'EUR') sym = '€';
                    if (c === 'GBP') sym = '£';
                    setFormData({ ...formData, currency: c, currencySymbol: sym });
                  }}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500"
                >
                  <option value="INR">INR (₹)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Default Trial Days
                </label>
                <input
                  type="number"
                  min="1"
                  max="90"
                  value={formData.defaultTrialDays}
                  onChange={(e) =>
                    setFormData({ ...formData, defaultTrialDays: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Default Individual Customer Plan
              </label>
              <select
                value={formData.defaultIndividualPlanId}
                onChange={(e) =>
                  setFormData({ ...formData, defaultIndividualPlanId: e.target.value })
                }
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 font-medium"
              >
                {individualPlans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.id})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Default Corporate Tenant Plan
              </label>
              <select
                value={formData.defaultCompanyPlanId}
                onChange={(e) =>
                  setFormData({ ...formData, defaultCompanyPlanId: e.target.value })
                }
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 font-medium"
              >
                {companyPlans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.id})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* System Flags */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
            System Operational Gates & Governance
          </h3>

          <div className="space-y-3">
            <label className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-slate-50 cursor-pointer">
              <div>
                <span className="text-xs font-bold text-slate-900 block">
                  Enforce Quota Limits Strictly
                </span>
                <span className="text-[11px] text-slate-500">
                  Block creation of additional cards, team members, or items when quota is reached.
                </span>
              </div>
              <input
                type="checkbox"
                checked={formData.enforceLimitsStrictly}
                onChange={(e) =>
                  setFormData({ ...formData, enforceLimitsStrictly: e.target.checked })
                }
                className="rounded text-teal-600 focus:ring-teal-500 w-4 h-4"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-slate-50 cursor-pointer">
              <div>
                <span className="text-xs font-bold text-slate-900 block">
                  Allow Self-Service Customer Registration
                </span>
                <span className="text-[11px] text-slate-500">
                  Permit new individual cardholders to create accounts without prior invite.
                </span>
              </div>
              <input
                type="checkbox"
                checked={formData.allowSelfRegistration}
                onChange={(e) =>
                  setFormData({ ...formData, allowSelfRegistration: e.target.checked })
                }
                className="rounded text-teal-600 focus:ring-teal-500 w-4 h-4"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-slate-50 cursor-pointer">
              <div>
                <span className="text-xs font-bold text-slate-900 block">
                  Global Maintenance Mode
                </span>
                <span className="text-[11px] text-slate-500">
                  Suspend portal write operations for system database upgrades (cards remain viewable).
                </span>
              </div>
              <input
                type="checkbox"
                checked={formData.maintenanceMode}
                onChange={(e) => setFormData({ ...formData, maintenanceMode: e.target.checked })}
                className="rounded text-rose-600 focus:ring-rose-500 w-4 h-4"
              />
            </label>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="px-6 py-2.5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-xs transition flex items-center space-x-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Global Platform Policy</span>
          </button>
        </div>
      </form>
    </div>
  );
};
