import React, { useState } from 'react';
import { Plan, EntitlementRule, EntitlementStatus, LimitUnit } from '../../types/entitlement';
import { FEATURE_CATALOGUE, entitlementService } from '../../services/entitlementService';
import { X, Save, Plus, Shield, Check, Trash2 } from 'lucide-react';

interface PlanEditorModalProps {
  plan?: Plan | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  actorInfo?: { id: string; name: string };
}

export const PlanEditorModal: React.FC<PlanEditorModalProps> = ({
  plan,
  isOpen,
  onClose,
  onSave,
  actorInfo,
}) => {
  if (!isOpen) return null;

  const isEditing = !!plan;

  const [id, setId] = useState(plan?.id || `plan_${Date.now().toString(36)}`);
  const [name, setName] = useState(plan?.name || '');
  const [targetType, setTargetType] = useState<'individual' | 'company'>(
    plan?.targetType || 'company'
  );
  const [description, setDescription] = useState(plan?.description || '');
  const [price, setPrice] = useState(plan?.price ?? 0);
  const [currency, setCurrency] = useState(plan?.currency || 'INR');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly' | 'lifetime' | 'free'>(
    plan?.billingCycle || 'yearly'
  );
  const [isActive, setIsActive] = useState(plan?.isActive ?? true);
  const [isPopular, setIsPopular] = useState(plan?.isPopular ?? false);

  const [features, setFeatures] = useState<Record<string, EntitlementRule>>(() => {
    if (plan?.features) return { ...plan.features };
    const initial: Record<string, EntitlementRule> = {};
    FEATURE_CATALOGUE.forEach((f) => {
      initial[f.id] = {
        status: f.defaultEntitlement,
        limit: f.defaultLimit,
        limitUnit: f.limitUnit,
      };
    });
    return initial;
  });

  const handleFeatureStatusChange = (
    featId: string,
    status: EntitlementStatus,
    limit?: number,
    limitUnit?: LimitUnit
  ) => {
    setFeatures((prev) => ({
      ...prev,
      [featId]: {
        status,
        limit: status === 'LIMITED' ? limit ?? prev[featId]?.limit ?? 3 : undefined,
        limitUnit: status === 'LIMITED' ? limitUnit ?? prev[featId]?.limitUnit ?? 'COUNT' : undefined,
      },
    }));
  };

  const handleFeatureLimitChange = (featId: string, limitValue: number) => {
    setFeatures((prev) => ({
      ...prev,
      [featId]: {
        ...prev[featId],
        status: 'LIMITED',
        limit: limitValue,
      },
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newPlan: Plan = {
      id: id.trim(),
      name: name.trim(),
      targetType,
      description: description.trim(),
      price: Number(price),
      currency,
      billingCycle,
      isActive,
      isPopular,
      features,
      createdAt: plan?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    entitlementService.savePlan(newPlan, actorInfo);
    onSave();
    onClose();
  };

  const relevantFeatures = FEATURE_CATALOGUE.filter(
    (f) => f.scope === 'both' || f.scope === targetType
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 relative max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              {isEditing ? `Edit Plan: ${plan?.name}` : 'Create New SaaS Plan'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Configure subscription tier pricing, entitlement matrix, and quota limits.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto py-4 space-y-6">
          {/* General Metadata */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Plan ID (Stable Key)
              </label>
              <input
                type="text"
                value={id}
                onChange={(e) => setId(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                disabled={isEditing}
                required
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-hidden disabled:bg-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Plan Display Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="e.g. Company Enterprise Plus"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Target Customer Type
              </label>
              <select
                value={targetType}
                onChange={(e) => setTargetType(e.target.value as 'individual' | 'company')}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
              >
                <option value="company">Company / Enterprise</option>
                <option value="individual">Individual Professional</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Price ({currency})
                </label>
                <input
                  type="number"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Billing Cycle
                </label>
                <select
                  value={billingCycle}
                  onChange={(e) => setBillingCycle(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                >
                  <option value="yearly">Yearly</option>
                  <option value="monthly">Monthly</option>
                  <option value="lifetime">Lifetime</option>
                  <option value="free">Free / ₹0</option>
                </select>
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Description / Value Proposition
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief plan description displayed on pricing cards"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
              />
            </div>

            <div className="flex items-center space-x-6">
              <label className="flex items-center space-x-2 text-xs font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded text-teal-600 focus:ring-teal-500"
                />
                <span>Active & Selectable</span>
              </label>

              <label className="flex items-center space-x-2 text-xs font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPopular}
                  onChange={(e) => setIsPopular(e.target.checked)}
                  className="rounded text-teal-600 focus:ring-teal-500"
                />
                <span>Mark as "Most Popular"</span>
              </label>
            </div>
          </div>

          {/* Feature Matrix for This Plan */}
          <div className="border-t border-slate-200 pt-4">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
              Included Features & Limits
            </h3>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {relevantFeatures.map((feat) => {
                const rule = features[feat.id] || { status: feat.defaultEntitlement };
                return (
                  <div
                    key={feat.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 gap-2"
                  >
                    <div>
                      <span className="text-xs font-semibold text-slate-800 block">
                        {feat.name}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {feat.id} • {feat.description}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      <select
                        value={rule.status}
                        onChange={(e) =>
                          handleFeatureStatusChange(
                            feat.id,
                            e.target.value as EntitlementStatus,
                            rule.limit,
                            feat.limitUnit
                          )
                        }
                        className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                      >
                        <option value="ENABLED">ENABLED</option>
                        <option value="DISABLED">DISABLED</option>
                        <option value="LIMITED">LIMITED</option>
                        <option value="UNLIMITED">UNLIMITED</option>
                      </select>

                      {rule.status === 'LIMITED' && (
                        <div className="flex items-center space-x-1">
                          <input
                            type="number"
                            min="1"
                            value={rule.limit ?? feat.defaultLimit ?? 1}
                            onChange={(e) =>
                              handleFeatureLimitChange(feat.id, Number(e.target.value))
                            }
                            className="w-16 px-2 py-1 text-xs border border-slate-200 rounded-lg bg-white text-center focus:ring-2 focus:ring-teal-500"
                          />
                          <span className="text-[10px] text-slate-500 font-medium">
                            {feat.limitUnit || 'COUNT'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-xs transition flex items-center space-x-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isEditing ? 'Save Plan Changes' : 'Create Plan'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
