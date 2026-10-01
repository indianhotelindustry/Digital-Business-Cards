import React, { useState } from 'react';
import { Company } from '../../types';
import { Plan, EntitlementOverride, EffectiveEntitlement } from '../../types/entitlement';
import {
  FEATURE_CATALOGUE,
  FEATURE_MAP,
  entitlementService,
} from '../../services/entitlementService';
import {
  Building2,
  Plus,
  Trash2,
  Sparkles,
  Shield,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  HardDrive,
  Users2,
  Calendar,
} from 'lucide-react';
import { OverrideModal } from './OverrideModal';
import { EntitlementBadge } from '../entitlements/EntitlementBadge';

interface SaaSCompanyEntitlementsTabProps {
  companies: Company[];
  plans: Plan[];
  overrides: EntitlementOverride[];
  selectedCompanyId?: string | null;
  onRefresh: () => void;
  actorInfo?: { id: string; name: string };
}

export const SaaSCompanyEntitlementsTab: React.FC<SaaSCompanyEntitlementsTabProps> = ({
  companies,
  plans,
  overrides,
  selectedCompanyId: initialSelectedCompanyId,
  onRefresh,
  actorInfo,
}) => {
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(
    initialSelectedCompanyId || companies[0]?.id || ''
  );
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
  const [overrideToEdit, setOverrideToEdit] = useState<EntitlementOverride | null>(null);
  const [defaultFeatureForOverride, setDefaultFeatureForOverride] = useState<string>(
    'company.ai_assistance'
  );

  const activeCompany = companies.find((c) => c.id === selectedCompanyId) || companies[0];
  const companyPlan = plans.find((p) => p.id === activeCompany?.planId) || plans.find((p) => p.id === 'company_free') || plans[0];

  const companyOverrides = overrides.filter(
    (o) => o.targetType === 'company' && o.targetId === activeCompany?.id
  );

  // Calculate effective entitlements for this company
  const companyFeatures = FEATURE_CATALOGUE.filter(
    (f) => f.scope === 'company' || f.scope === 'both'
  );

  const effectiveMap: Record<string, EffectiveEntitlement> = {};
  if (activeCompany) {
    companyFeatures.forEach((f) => {
      effectiveMap[f.id] = entitlementService.getEffectiveEntitlement(
        {
          companyId: activeCompany.id,
          role: 'company_admin',
          planId: activeCompany.planId,
        },
        f.id
      );
    });
  }

  const handleOpenGrantModal = (featureId?: string) => {
    setOverrideToEdit(null);
    setDefaultFeatureForOverride(featureId || 'company.ai_assistance');
    setIsOverrideModalOpen(true);
  };

  const handleEditOverride = (override: EntitlementOverride) => {
    setOverrideToEdit(override);
    setIsOverrideModalOpen(true);
  };

  const handleDeleteOverride = (id: string) => {
    if (window.confirm('Revert this override and restore standard plan policy?')) {
      entitlementService.deleteOverride(id, actorInfo);
      onRefresh();
    }
  };

  if (!activeCompany) {
    return (
      <div className="bg-white rounded-2xl p-8 text-center text-slate-500 border border-slate-200">
        No companies available. Please onboard a company first.
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Company Selector Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center space-x-3">
          <div
            className="w-10 h-10 rounded-xl text-white font-bold text-base flex items-center justify-center shrink-0"
            style={{ backgroundColor: activeCompany.branding?.primaryColor || '#0f766e' }}
          >
            {activeCompany.name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-bold text-slate-900">{activeCompany.name}</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-teal-50 text-teal-700 font-bold border border-teal-200">
                Plan: {companyPlan?.name || activeCompany.planId}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              ID: {activeCompany.id} • {activeCompany.email} • {activeCompany.phone}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <select
            value={selectedCompanyId}
            onChange={(e) => setSelectedCompanyId(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 font-semibold"
          >
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.id})
              </option>
            ))}
          </select>

          <button
            onClick={() => handleOpenGrantModal()}
            className="inline-flex items-center px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            <span>Add Override</span>
          </button>
        </div>
      </div>

      {/* Quota Overview Quick Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase tracking-wider">
            <span>Team Member Seats</span>
            <Users2 className="w-4 h-4 text-teal-600" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-bold text-slate-900">
              {effectiveMap['company.team_members']?.limit ?? 3} Seats
            </span>
            <span className="text-xs text-slate-500 font-mono">
              Source: {effectiveMap['company.team_members']?.sourceDescription}
            </span>
          </div>
          <button
            onClick={() => handleOpenGrantModal('company.team_members')}
            className="mt-3 text-[11px] font-semibold text-teal-700 hover:underline flex items-center"
          >
            + Increase Team Member Quota
          </button>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase tracking-wider">
            <span>Media Storage</span>
            <HardDrive className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-bold text-slate-900">
              {effectiveMap['company.storage']?.limit ?? 500} MB
            </span>
            <span className="text-xs text-slate-500 font-mono">
              Source: {effectiveMap['company.storage']?.sourceDescription}
            </span>
          </div>
          <button
            onClick={() => handleOpenGrantModal('company.storage')}
            className="mt-3 text-[11px] font-semibold text-indigo-700 hover:underline flex items-center"
          >
            + Expand Storage Quota
          </button>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase tracking-wider">
            <span>AI Copywriting Suite</span>
            <Sparkles className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-bold text-slate-900">
              {effectiveMap['company.ai_assistance']?.isGranted ? 'Enabled' : 'Disabled'}
            </span>
            <span className="text-xs text-slate-500 font-mono">
              Source: {effectiveMap['company.ai_assistance']?.sourceDescription}
            </span>
          </div>
          <button
            onClick={() => handleOpenGrantModal('company.ai_assistance')}
            className="mt-3 text-[11px] font-semibold text-amber-700 hover:underline flex items-center"
          >
            + Grant AI Assistance Access
          </button>
        </div>
      </div>

      {/* Active Overrides on this Company */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Active Overrides for {activeCompany.name} ({companyOverrides.length})</span>
            </h3>
            <p className="text-xs text-slate-500">
              Company-level exceptions taking precedence over the underlying {companyPlan?.name} plan.
            </p>
          </div>
        </div>

        {companyOverrides.length === 0 ? (
          <div className="p-6 bg-slate-50 rounded-xl text-center text-xs text-slate-400 border border-dashed border-slate-200">
            No active company overrides. This company strictly follows its {companyPlan?.name} plan policy.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {companyOverrides.map((ov) => {
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

      {/* Effective Entitlements Breakdown Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            All Effective Corporate Entitlements ({companyFeatures.length})
          </h3>
          <span className="text-[11px] text-slate-400">Deterministic resolution output</span>
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
              {companyFeatures.map((feat) => {
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
                          eff.source === 'company_override'
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
        defaultTargetType="company"
        defaultTargetId={activeCompany.id}
        defaultTargetName={activeCompany.name}
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
