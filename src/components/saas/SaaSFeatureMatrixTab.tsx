import React, { useState } from 'react';
import { Plan, EntitlementRule, EntitlementStatus, LimitUnit } from '../../types/entitlement';
import { FEATURE_CATALOGUE, entitlementService } from '../../services/entitlementService';
import {
  CheckCircle2,
  Lock,
  Sparkles,
  Save,
  Check,
  RotateCcw,
  Sliders,
  Filter,
} from 'lucide-react';
import { runBackendAction } from '../../lib/backend';

interface SaaSFeatureMatrixTabProps {
  plans: Plan[];
  onRefresh: () => void;
  actorInfo?: { id: string; name: string };
}

export const SaaSFeatureMatrixTab: React.FC<SaaSFeatureMatrixTabProps> = ({
  plans,
  onRefresh,
  actorInfo,
}) => {
  const [selectedPlanIds, setSelectedPlanIds] = useState<string[]>(
    plans.map((p) => p.id)
  );
  const [activeScope, setActiveScope] = useState<'all' | 'individual' | 'company'>('all');
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  // Active plans displayed as columns
  const activePlans = plans.filter((p) => selectedPlanIds.includes(p.id));

  // Features displayed as rows
  const filteredFeatures = FEATURE_CATALOGUE.filter((f) => {
    if (activeScope === 'all') return true;
    return f.scope === activeScope || f.scope === 'both';
  });

  const handleCellChange = async (
    plan: Plan,
    featureId: string,
    newStatus: EntitlementStatus,
    newLimit?: number
  ) => {
    const updatedFeatures = { ...plan.features };
    const cur = updatedFeatures[featureId] || { status: 'DISABLED' };
    const featDef = FEATURE_CATALOGUE.find((f) => f.id === featureId);

    updatedFeatures[featureId] = {
      status: newStatus,
      limit: newStatus === 'LIMITED' ? newLimit ?? cur.limit ?? featDef?.defaultLimit ?? 3 : undefined,
      limitUnit: newStatus === 'LIMITED' ? cur.limitUnit ?? featDef?.limitUnit ?? 'COUNT' : undefined,
    };

    const saved = await runBackendAction(() =>
      entitlementService.setPlanFeature(plan.id, featureId, updatedFeatures[featureId], `Feature matrix: ${featureId} set to ${newStatus} on ${plan.name}`)
    );
    if (!saved) return;
    setSaveSuccess(`Updated ${featDef?.name || featureId} on ${plan.name}`);
    setTimeout(() => setSaveSuccess(null), 2000);
    onRefresh();
  };

  const handleLimitChange = async (
    plan: Plan,
    featureId: string,
    limitValue: number
  ) => {
    const updatedFeatures = { ...plan.features };
    const cur = updatedFeatures[featureId] || { status: 'LIMITED' };
    const featDef = FEATURE_CATALOGUE.find((f) => f.id === featureId);

    updatedFeatures[featureId] = {
      ...cur,
      status: 'LIMITED',
      limit: limitValue,
      limitUnit: cur.limitUnit || featDef?.limitUnit || 'COUNT',
    };

    const saved = await runBackendAction(() =>
      entitlementService.setPlanFeature(plan.id, featureId, updatedFeatures[featureId], `Feature matrix: ${featureId} limit set to ${limitValue} on ${plan.name}`)
    );
    if (saved) onRefresh();
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Interactive SaaS Feature Matrix</h2>
          <p className="text-xs text-slate-500">
            Click any cell in real-time to toggle entitlements, customize limits, or adjust feature rules.
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex items-center space-x-3">
          {saveSuccess && (
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-lg flex items-center animate-in fade-in">
              <Check className="w-3 h-3 mr-1 text-emerald-600" />
              {saveSuccess}
            </span>
          )}

          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setActiveScope('all')}
              className={`px-3 py-1.5 rounded-lg transition ${
                activeScope === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
              }`}
            >
              All Features
            </button>
            <button
              onClick={() => setActiveScope('individual')}
              className={`px-3 py-1.5 rounded-lg transition ${
                activeScope === 'individual' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
              }`}
            >
              Individual
            </button>
            <button
              onClick={() => setActiveScope('company')}
              className={`px-3 py-1.5 rounded-lg transition ${
                activeScope === 'company' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
              }`}
            >
              Company
            </button>
          </div>
        </div>
      </div>

      {/* Editable Matrix Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="py-4 px-4 min-w-[220px] sticky left-0 bg-slate-50 z-10 border-r border-slate-200">
                  Feature / Capability
                </th>
                {activePlans.map((plan) => (
                  <th key={plan.id} className="py-4 px-4 text-center min-w-[160px] border-r border-slate-200">
                    <div className="flex flex-col items-center">
                      <span className="text-xs font-bold text-slate-900">{plan.name}</span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        {plan.price === 0 ? 'Free' : `₹${plan.price}/${plan.billingCycle}`}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredFeatures.map((feat) => (
                <tr key={feat.id} className="hover:bg-slate-50/60 transition">
                  {/* Feature Label Sticky Column */}
                  <td className="py-3 px-4 sticky left-0 bg-white z-10 border-r border-slate-200 font-medium">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-slate-900">{feat.name}</span>
                      {feat.badge && (
                        <span className="text-[9px] px-1.5 py-0.2 bg-teal-50 text-teal-700 border border-teal-200 rounded font-bold">
                          {feat.badge}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 block truncate max-w-xs mt-0.5">
                      {feat.id}
                    </span>
                  </td>

                  {/* Plan Cells */}
                  {activePlans.map((plan) => {
                    const rule = plan.features[feat.id] || { status: 'DISABLED' };
                    const isEnabled = rule.status === 'ENABLED' || rule.status === 'UNLIMITED';
                    const isLimited = rule.status === 'LIMITED';
                    const isDisabled = rule.status === 'DISABLED';

                    return (
                      <td key={`${plan.id}_${feat.id}`} className="py-2.5 px-3 border-r border-slate-200 text-center">
                        <div className="flex flex-col items-center justify-center space-y-1">
                          <select
                            value={rule.status}
                            onChange={(e) =>
                              handleCellChange(
                                plan,
                                feat.id,
                                e.target.value as EntitlementStatus,
                                rule.limit
                              )
                            }
                            className={`text-xs font-semibold px-2 py-1 rounded-lg border text-center transition cursor-pointer ${
                              isEnabled
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                : isLimited
                                ? 'bg-blue-50 text-blue-800 border-blue-300'
                                : 'bg-slate-100 text-slate-500 border-slate-200'
                            }`}
                          >
                            <option value="ENABLED">✓ ENABLED</option>
                            <option value="LIMITED">⚡ LIMITED</option>
                            <option value="UNLIMITED">★ UNLIMITED</option>
                            <option value="DISABLED">✕ DISABLED</option>
                          </select>

                          {isLimited && (
                            <div className="flex items-center space-x-1 mt-1">
                              <input
                                type="number"
                                min="1"
                                value={rule.limit ?? feat.defaultLimit ?? 1}
                                onChange={(e) =>
                                  handleLimitChange(plan, feat.id, Number(e.target.value))
                                }
                                className="w-14 px-1.5 py-0.5 text-xs text-center border border-slate-200 rounded bg-white font-mono"
                              />
                              <span className="text-[9px] text-slate-400">
                                {feat.limitUnit || 'QTY'}
                              </span>
                            </div>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
