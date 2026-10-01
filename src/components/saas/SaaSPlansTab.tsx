import React, { useState } from 'react';
import { Plan } from '../../types/entitlement';
import { entitlementService, FEATURE_MAP } from '../../services/entitlementService';
import {
  Plus,
  Edit,
  Copy,
  Trash2,
  CheckCircle2,
  Sparkles,
  Layers,
  ArrowRight,
  Shield,
} from 'lucide-react';
import { PlanEditorModal } from './PlanEditorModal';

interface SaaSPlansTabProps {
  plans: Plan[];
  onRefresh: () => void;
  actorInfo?: { id: string; name: string };
}

export const SaaSPlansTab: React.FC<SaaSPlansTabProps> = ({ plans, onRefresh, actorInfo }) => {
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'individual' | 'company'>('all');

  const filteredPlans = plans.filter((p) => {
    if (filterType === 'all') return true;
    return p.targetType === filterType;
  });

  const handleCreateNew = () => {
    setSelectedPlan(null);
    setIsEditorOpen(true);
  };

  const handleEdit = (plan: Plan) => {
    setSelectedPlan(plan);
    setIsEditorOpen(true);
  };

  const handleDuplicate = (plan: Plan) => {
    entitlementService.duplicatePlan(plan.id, actorInfo);
    onRefresh();
  };

  const handleDelete = (plan: Plan) => {
    if (window.confirm(`Are you sure you want to deactivate and remove plan "${plan.name}"?`)) {
      entitlementService.deletePlan(plan.id, actorInfo);
      onRefresh();
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">SaaS Subscription Plans</h2>
          <p className="text-xs text-slate-500">
            Define pricing, billing cycles, target scope, and default feature sets without code deployments.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {/* Target Filter Tabs */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 rounded-lg transition ${
                filterType === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({plans.length})
            </button>
            <button
              onClick={() => setFilterType('individual')}
              className={`px-3 py-1.5 rounded-lg transition ${
                filterType === 'individual'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Individual ({plans.filter((p) => p.targetType === 'individual').length})
            </button>
            <button
              onClick={() => setFilterType('company')}
              className={`px-3 py-1.5 rounded-lg transition ${
                filterType === 'company'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Company ({plans.filter((p) => p.targetType === 'company').length})
            </button>
          </div>

          <button
            onClick={handleCreateNew}
            className="inline-flex items-center px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            <span>Create Plan</span>
          </button>
        </div>
      </div>

      {/* Plan Cards Grid */}
      <div className="grid md:grid-cols-3 gap-6">
        {filteredPlans.map((plan) => {
          const enabledCount = Object.values(plan.features).filter(
            (f) => f.status === 'ENABLED' || f.status === 'UNLIMITED'
          ).length;
          const limitedCount = Object.values(plan.features).filter((f) => f.status === 'LIMITED').length;

          return (
            <div
              key={plan.id}
              className={`bg-white rounded-2xl p-6 border transition relative flex flex-col justify-between ${
                plan.isPopular
                  ? 'border-teal-500 shadow-md ring-2 ring-teal-500/20'
                  : 'border-slate-200/90 shadow-xs hover:border-slate-300'
              }`}
            >
              {plan.isPopular && (
                <span className="absolute -top-3 left-6 bg-teal-600 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-0.5 rounded-full shadow-xs">
                  Most Popular
                </span>
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md">
                    {plan.targetType}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">ID: {plan.id}</span>
                </div>

                <h3 className="text-base font-bold text-slate-900">{plan.name}</h3>
                <p className="text-xs text-slate-500 mt-1 min-h-[36px]">{plan.description}</p>

                <div className="mt-4 mb-5 pb-4 border-b border-slate-100">
                  <div className="flex items-baseline">
                    <span className="text-2xl font-extrabold text-slate-900">
                      {plan.price === 0 ? 'Free' : `₹${plan.price.toLocaleString()}`}
                    </span>
                    {plan.price > 0 && (
                      <span className="text-xs text-slate-500 ml-1">/{plan.billingCycle}</span>
                    )}
                  </div>
                  <div className="flex items-center space-x-3 text-[11px] text-slate-500 mt-2">
                    <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md">
                      {enabledCount} Included
                    </span>
                    <span className="text-blue-700 font-semibold bg-blue-50 px-2 py-0.5 rounded-md">
                      {limitedCount} Limited
                    </span>
                  </div>
                </div>

                {/* Key feature preview */}
                <div className="space-y-1.5 text-xs text-slate-600 mb-6">
                  {Object.entries(plan.features)
                    .filter(([_, r]) => r.status !== 'DISABLED')
                    .slice(0, 5)
                    .map(([fId, r]) => {
                      const def = FEATURE_MAP.get(fId);
                      return (
                        <div key={fId} className="flex items-center space-x-2 truncate">
                          <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                          <span className="truncate">
                            {def?.name || fId}
                            {r.status === 'LIMITED' && r.limit && (
                              <span className="text-slate-400 ml-1">({r.limit} {r.limitUnit || ''})</span>
                            )}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <button
                  onClick={() => handleEdit(plan)}
                  className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition"
                >
                  <Edit className="w-3.5 h-3.5 mr-1.5" /> Edit
                </button>

                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => handleDuplicate(plan)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                    title="Duplicate Plan"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleDelete(plan)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                    title="Delete Plan"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Plan Editor Modal */}
      <PlanEditorModal
        isOpen={isEditorOpen}
        plan={selectedPlan}
        onClose={() => setIsEditorOpen(false)}
        onSave={() => {
          setIsEditorOpen(false);
          onRefresh();
        }}
        actorInfo={actorInfo}
      />
    </div>
  );
};
