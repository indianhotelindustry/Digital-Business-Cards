import React from 'react';
import { Plan, EntitlementOverride, EntitlementAuditLog } from '../../types/entitlement';
import { Company } from '../../types';
import {
  Building2,
  Users,
  CreditCard,
  Sparkles,
  ShieldCheck,
  TrendingUp,
  Layers,
  ArrowUpRight,
  Clock,
  CheckCircle,
} from 'lucide-react';

interface SaaSOverviewTabProps {
  companies: Company[];
  plans: Plan[];
  overrides: EntitlementOverride[];
  auditLogs: EntitlementAuditLog[];
  onSelectTab: (tab: string) => void;
}

export const SaaSOverviewTab: React.FC<SaaSOverviewTabProps> = ({
  companies,
  plans,
  overrides,
  auditLogs,
  onSelectTab,
}) => {
  const activeCompanies = companies.filter((c) => c.status === 'active');
  const activeOverrides = overrides.filter((o) => !o.expiresAt || new Date(o.expiresAt) > new Date());

  // Plan distribution
  const planCounts: Record<string, number> = {};
  companies.forEach((c) => {
    const pId = c.planId || 'company_free';
    planCounts[pId] = (planCounts[pId] || 0) + 1;
  });

  // Calculate annual recurring revenue estimate
  const estimatedARR = companies.reduce((acc, c) => {
    const p = plans.find((plan) => plan.id === c.planId);
    if (!p) return acc;
    if (p.billingCycle === 'yearly') return acc + p.price;
    if (p.billingCycle === 'monthly') return acc + p.price * 12;
    return acc;
  }, 0);

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Active Tenants
            </span>
            <Building2 className="w-4 h-4 text-teal-600" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900">{activeCompanies.length}</span>
            <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full">
              100% Online
            </span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Configured Plans
            </span>
            <Layers className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900">{plans.length}</span>
            <button
              onClick={() => onSelectTab('plans')}
              className="text-[10px] text-indigo-600 font-semibold hover:underline flex items-center"
            >
              Manage <ArrowUpRight className="w-3 h-3 ml-0.5" />
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Active Overrides
            </span>
            <Sparkles className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900">{activeOverrides.length}</span>
            <button
              onClick={() => onSelectTab('company-entitlements')}
              className="text-[10px] text-amber-600 font-semibold hover:underline flex items-center"
            >
              Inspect <ArrowUpRight className="w-3 h-3 ml-0.5" />
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Estimated ARR
            </span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900">₹{estimatedARR.toLocaleString()}</span>
            <span className="text-[10px] text-slate-400 font-medium">SaaS Run-Rate</span>
          </div>
        </div>
      </div>

      {/* Plan Distribution & Entitlement Hierarchy Visual */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* Hierarchy Overview Card */}
        <div className="md:col-span-2 bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Authoritative Entitlement Hierarchy
              </h3>
              <p className="text-xs text-slate-500">
                Deterministic 5-tier policy resolution for all DSBC features & limits.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
              Active Engine
            </span>
          </div>

          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 font-mono text-xs text-slate-700 space-y-2">
            <div className="flex items-center space-x-2">
              <span className="w-6 h-6 rounded-md bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-[10px]">
                1
              </span>
              <span className="font-semibold text-slate-900">GLOBAL PLATFORM POLICY</span>
              <span className="text-slate-400 text-[10px]">(System baselines & global toggles)</span>
            </div>
            <div className="text-slate-300 ml-3">↓</div>
            <div className="flex items-center space-x-2">
              <span className="w-6 h-6 rounded-md bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-[10px]">
                2
              </span>
              <span className="font-semibold text-blue-900">PLAN POLICY</span>
              <span className="text-slate-400 text-[10px]">(Individual/Company Free, Pro, Custom)</span>
            </div>
            <div className="text-slate-300 ml-3">↓</div>
            <div className="flex items-center space-x-2">
              <span className="w-6 h-6 rounded-md bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-[10px]">
                3
              </span>
              <span className="font-semibold text-amber-900">COMPANY OVERRIDE</span>
              <span className="text-slate-400 text-[10px]">(Enterprise seats, AI grants, storage)</span>
            </div>
            <div className="text-slate-300 ml-3">↓</div>
            <div className="flex items-center space-x-2">
              <span className="w-6 h-6 rounded-md bg-purple-100 text-purple-800 flex items-center justify-center font-bold text-[10px]">
                4
              </span>
              <span className="font-semibold text-purple-900">INDIVIDUAL USER OVERRIDE</span>
              <span className="text-slate-400 text-[10px]">(VIP passes, keynote trials, exceptions)</span>
            </div>
            <div className="text-slate-300 ml-3">↓</div>
            <div className="flex items-center space-x-2 bg-teal-50 border border-teal-200 rounded-lg p-2">
              <span className="w-6 h-6 rounded-md bg-teal-600 text-white flex items-center justify-center font-bold text-[10px]">
                ★
              </span>
              <span className="font-bold text-teal-900">EFFECTIVE ENTITLEMENT</span>
              <span className="text-teal-700 text-[10px] font-medium">(Most specific rule strictly wins)</span>
            </div>
          </div>
        </div>

        {/* Plan Breakdown */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-1">Tenancy by Plan</h3>
            <p className="text-xs text-slate-500 mb-4">Customer subscription breakdown</p>

            <div className="space-y-3">
              {plans.map((p) => {
                const count = planCounts[p.id] || 0;
                const pct = companies.length > 0 ? Math.round((count / companies.length) * 100) : 0;
                return (
                  <div key={p.id}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-semibold text-slate-700">{p.name}</span>
                      <span className="text-slate-500 font-mono">
                        {count} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-teal-600 h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 mt-4">
            <button
              onClick={() => onSelectTab('matrix')}
              className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition flex items-center justify-center space-x-1.5"
            >
              <span>Open Editable Feature Matrix</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Recent Audit Trail Preview */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Recent SaaS Entitlement Audit Trail</h3>
            <p className="text-xs text-slate-500">
              Immutable logs of plan updates, override grants, and administrative operations.
            </p>
          </div>
          <button
            onClick={() => onSelectTab('audit')}
            className="text-xs text-teal-600 hover:text-teal-700 font-semibold"
          >
            View All Audit Logs →
          </button>
        </div>

        <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
          {auditLogs.slice(0, 5).map((log) => (
            <div key={log.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-start space-x-3">
                <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center shrink-0 mt-0.5">
                  <Clock className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-slate-900">{log.targetName}</span>
                    <span className="text-[10px] px-2 py-0.2 bg-slate-100 text-slate-600 rounded-md font-mono">
                      {log.targetType}
                    </span>
                    {log.featureName && (
                      <span className="text-[10px] text-slate-400">• {log.featureName}</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">
                    <span className="font-semibold text-slate-800">{log.previousValue}</span> →{' '}
                    <span className="font-semibold text-teal-700">{log.newValue}</span>
                  </p>
                  <p className="text-[11px] text-slate-400 italic mt-0.5">"{log.reason}"</p>
                </div>
              </div>
              <div className="text-right text-[10px] text-slate-400 shrink-0 font-mono">
                {new Date(log.timestamp).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
