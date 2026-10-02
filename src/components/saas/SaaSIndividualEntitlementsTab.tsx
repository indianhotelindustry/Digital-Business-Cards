import React, { useState } from 'react';
import { Employee, Company } from '../../types';
import { Plan, EntitlementOverride, EffectiveEntitlement } from '../../types/entitlement';
import {
  FEATURE_CATALOGUE,
  FEATURE_MAP,
  entitlementService,
} from '../../services/entitlementService';
import {
  User,
  Plus,
  Trash2,
  Sparkles,
  Shield,
  Clock,
  CreditCard,
  Zap,
} from 'lucide-react';
import { OverrideModal } from './OverrideModal';
import { EntitlementBadge } from '../entitlements/EntitlementBadge';
import { runBackendAction } from '../../lib/backend';

interface SaaSIndividualEntitlementsTabProps {
  employees: Employee[];
  companies: Company[];
  plans: Plan[];
  overrides: EntitlementOverride[];
  selectedEmployeeId?: string | null;
  onRefresh: () => void;
  actorInfo?: { id: string; name: string };
}

export const SaaSIndividualEntitlementsTab: React.FC<SaaSIndividualEntitlementsTabProps> = ({
  employees,
  companies,
  plans,
  overrides,
  selectedEmployeeId: initialSelectedEmployeeId,
  onRefresh,
  actorInfo,
}) => {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(
    initialSelectedEmployeeId || employees[0]?.id || ''
  );
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
  const [overrideToEdit, setOverrideToEdit] = useState<EntitlementOverride | null>(null);
  const [defaultFeatureForOverride, setDefaultFeatureForOverride] = useState<string>(
    'individual.ai_assistance'
  );

  const activeEmployee = employees.find((e) => e.id === selectedEmployeeId) || employees[0];
  const affiliatedCompany = companies.find((c) => c.id === activeEmployee?.companyId);

  const individualOverrides = overrides.filter(
    (o) => o.targetType === 'individual' && o.targetId === activeEmployee?.id
  );

  // Individual features
  const individualFeatures = FEATURE_CATALOGUE.filter(
    (f) => f.scope === 'individual' || f.scope === 'both'
  );

  const effectiveMap: Record<string, EffectiveEntitlement> = {};
  if (activeEmployee) {
    individualFeatures.forEach((f) => {
      effectiveMap[f.id] = entitlementService.getEffectiveEntitlement(
        {
          userId: activeEmployee.id,
          companyId: activeEmployee.companyId,
          role: 'employee',
          planId: affiliatedCompany?.planId || 'individual_free',
        },
        f.id
      );
    });
  }

  const handleOpenGrantModal = (featureId?: string) => {
    setOverrideToEdit(null);
    setDefaultFeatureForOverride(featureId || 'individual.ai_assistance');
    setIsOverrideModalOpen(true);
  };

  const handleEditOverride = (override: EntitlementOverride) => {
    setOverrideToEdit(override);
    setIsOverrideModalOpen(true);
  };

  const handleDeleteOverride = async (id: string) => {
    if (window.confirm('Remove this individual exception and restore base policy?')) {
      if (await runBackendAction(() => entitlementService.deleteOverride(id, actorInfo))) onRefresh();
    }
  };

  if (!activeEmployee) {
    return (
      <div className="bg-white rounded-2xl p-8 text-center text-slate-500 border border-slate-200">
        No individual cardholders found. Please add an employee first.
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Individual Selector Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-teal-100 text-teal-800 font-bold text-base flex items-center justify-center shrink-0">
            {activeEmployee.firstName.charAt(0)}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-bold text-slate-900">{activeEmployee.displayName}</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-teal-50 text-teal-700 font-bold border border-teal-200">
                {activeEmployee.designation || 'Cardholder'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              ID: {activeEmployee.id} • {activeEmployee.email} •{' '}
              {affiliatedCompany ? `Company: ${affiliatedCompany.name}` : 'Independent User'}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <select
            value={selectedEmployeeId}
            onChange={(e) => setSelectedEmployeeId(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 font-semibold"
          >
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.displayName} ({e.id})
              </option>
            ))}
          </select>

          <button
            onClick={() => handleOpenGrantModal()}
            className="inline-flex items-center px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            <span>Add Individual Override</span>
          </button>
        </div>
      </div>

      {/* Quick Action Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase tracking-wider">
            <span>AI Bio & Copy Generator</span>
            <Sparkles className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-bold text-slate-900">
              {effectiveMap['individual.ai_assistance']?.isGranted ? 'Enabled' : 'Disabled'}
            </span>
            <span className="text-xs text-slate-500 font-mono">
              Source: {effectiveMap['individual.ai_assistance']?.sourceDescription}
            </span>
          </div>
          <button
            onClick={() => handleOpenGrantModal('individual.ai_assistance')}
            className="mt-3 text-[11px] font-semibold text-amber-700 hover:underline flex items-center"
          >
            + Grant AI Assistance Exception
          </button>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase tracking-wider">
            <span>Custom Vanity Slug</span>
            <CreditCard className="w-4 h-4 text-teal-600" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-bold text-slate-900">
              {effectiveMap['individual.custom_slug']?.isGranted ? 'Unlocked' : 'Locked'}
            </span>
            <span className="text-xs text-slate-500 font-mono">
              Source: {effectiveMap['individual.custom_slug']?.sourceDescription}
            </span>
          </div>
          <button
            onClick={() => handleOpenGrantModal('individual.custom_slug')}
            className="mt-3 text-[11px] font-semibold text-teal-700 hover:underline flex items-center"
          >
            + Enable Custom Slug
          </button>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase tracking-wider">
            <span>Personal Card Analytics</span>
            <Zap className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-bold text-slate-900">
              {effectiveMap['individual.analytics']?.isGranted ? 'Full Access' : 'Disabled'}
            </span>
            <span className="text-xs text-slate-500 font-mono">
              Source: {effectiveMap['individual.analytics']?.sourceDescription}
            </span>
          </div>
          <button
            onClick={() => handleOpenGrantModal('individual.analytics')}
            className="mt-3 text-[11px] font-semibold text-indigo-700 hover:underline flex items-center"
          >
            + Unlock Analytics
          </button>
        </div>
      </div>

      {/* Active Overrides for this Individual */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Active Overrides for {activeEmployee.displayName} ({individualOverrides.length})</span>
            </h3>
            <p className="text-xs text-slate-500">
              Individual-level overrides are evaluated at the top of the entitlement hierarchy.
            </p>
          </div>
        </div>

        {individualOverrides.length === 0 ? (
          <div className="p-6 bg-slate-50 rounded-xl text-center text-xs text-slate-400 border border-dashed border-slate-200">
            No active individual overrides. This user resolves features from company/plan policies.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {individualOverrides.map((ov) => {
              const def = FEATURE_MAP.get(ov.featureId);
              const isExpired = ov.expiresAt && new Date(ov.expiresAt) < new Date();

              return (
                <div key={ov.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-slate-900">
                        {def?.name || ov.featureId}
                      </span>
                      <EntitlementBadge
                        status={ov.rule.status}
                        limit={ov.rule.limit}
                        limitUnit={ov.rule.limitUnit}
                        isExpired={!!isExpired}
                      />
                      <span className="text-[10px] px-2 py-0.5 rounded bg-purple-50 text-purple-700 font-semibold">
                        {ov.grantType}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 mt-1">
                      Reason: <span className="text-slate-700 italic font-medium">"{ov.reason}"</span>
                    </p>

                    {ov.expiresAt && (
                      <p className="text-[10px] text-amber-700 font-medium mt-0.5 flex items-center">
                        <Clock className="w-3 h-3 mr-1" />
                        Valid until: {new Date(ov.expiresAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <button
                      onClick={() => handleEditOverride(ov)}
                      className="px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteOverride(ov.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                      title="Delete Override"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Effective Individual Entitlements */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            All Effective Individual Entitlements ({individualFeatures.length})
          </h3>
          <span className="text-[11px] text-slate-400">Winning policy resolution breakdown</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-white text-slate-400 font-semibold uppercase text-[10px] border-b border-slate-100">
              <tr>
                <th className="py-3 px-4">Feature Name</th>
                <th className="py-3 px-4">Effective State</th>
                <th className="py-3 px-4">Effective Limit</th>
                <th className="py-3 px-4">Winning Source</th>
                <th className="py-3 px-4 text-right">Quick Override</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {individualFeatures.map((feat) => {
                const eff = effectiveMap[feat.id] || {
                  featureId: feat.id,
                  featureName: feat.name,
                  status: 'DISABLED',
                  isGranted: false,
                  source: 'global_policy',
                  sourceDescription: 'Default',
                };

                return (
                  <tr key={feat.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-900 block">{feat.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{feat.id}</span>
                    </td>

                    <td className="py-3 px-4">
                      <EntitlementBadge
                        status={eff.status}
                        limit={eff.limit}
                        limitUnit={eff.limitUnit}
                        used={eff.used}
                        remaining={eff.remaining}
                      />
                    </td>

                    <td className="py-3 px-4 font-mono font-medium text-slate-700">
                      {eff.status === 'UNLIMITED'
                        ? 'UNLIMITED'
                        : eff.limit !== undefined
                        ? `${eff.limit} ${eff.limitUnit || ''}`
                        : '—'}
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                          eff.source === 'individual_override'
                            ? 'bg-purple-100 text-purple-900 font-bold'
                            : eff.source === 'company_override'
                            ? 'bg-amber-100 text-amber-900 font-bold'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {eff.sourceDescription}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleOpenGrantModal(feat.id)}
                        className="text-[11px] font-semibold text-teal-600 hover:text-teal-800"
                      >
                        + Set Override
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Override Modal */}
      <OverrideModal
        isOpen={isOverrideModalOpen}
        override={overrideToEdit}
        defaultTargetType="individual"
        defaultTargetId={activeEmployee.id}
        defaultTargetName={activeEmployee.displayName}
        defaultFeatureId={defaultFeatureForOverride}
        onClose={() => setIsOverrideModalOpen(false)}
        onSave={() => {
          setIsOverrideModalOpen(false);
          onRefresh();
        }}
        actorInfo={actorInfo}
      />
    </div>
  );
};
