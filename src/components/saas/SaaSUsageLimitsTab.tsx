import React from 'react';
import { Company, Employee } from '../../types';
import { Plan } from '../../types/entitlement';
import { entitlementService } from '../../services/entitlementService';
import {
  BarChart3,
  Users2,
  HardDrive,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react';

interface SaaSUsageLimitsTabProps {
  companies: Company[];
  employees: Employee[];
  plans: Plan[];
}

export const SaaSUsageLimitsTab: React.FC<SaaSUsageLimitsTabProps> = ({
  companies,
  employees,
  plans,
}) => {
  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Live Quota Consumption & Usage Metrics</h2>
          <p className="text-xs text-slate-500">
            Monitor tenant storage utilization, team member seats, and AI request thresholds.
          </p>
        </div>
      </div>

      {/* Tenancy Usage Cards */}
      <div className="grid md:grid-cols-2 gap-6">
        {companies.map((comp) => {
          const compEmployees = employees.filter((e) => e.companyId === comp.id);
          const seatLimit =
            entitlementService.getLimit(
              { companyId: comp.id, role: 'company_admin', planId: comp.planId },
              'company.team_members'
            ).limit || 3;

          const storageLimit =
            entitlementService.getLimit(
              { companyId: comp.id, role: 'company_admin', planId: comp.planId },
              'company.storage'
            ).limit || 500;

          const seatPct = Math.min(100, Math.round((compEmployees.length / seatLimit) * 100));
          const storageUsedEstimate = Math.min(
            storageLimit,
            compEmployees.length * 45 + (comp.logoUrl ? 15 : 0) + (comp.heroImageUrl ? 30 : 0)
          );
          const storagePct = Math.min(100, Math.round((storageUsedEstimate / storageLimit) * 100));

          return (
            <div
              key={comp.id}
              className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <div
                    className="w-8 h-8 rounded-lg text-white font-bold text-xs flex items-center justify-center"
                    style={{ backgroundColor: comp.branding?.primaryColor || '#0f766e' }}
                  >
                    {comp.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">{comp.name}</h3>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Plan: {comp.planId}
                    </span>
                  </div>
                </div>

                {seatPct >= 90 || storagePct >= 90 ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                    <AlertTriangle className="w-3 h-3 mr-1 text-amber-600" /> Quota Warning
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" /> Optimal
                  </span>
                )}
              </div>

              {/* Seats Usage Bar */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold text-slate-700 flex items-center">
                    <Users2 className="w-3.5 h-3.5 mr-1 text-teal-600" /> Team Member Seats
                  </span>
                  <span className="font-mono text-slate-500">
                    {compEmployees.length} / {seatLimit} ({seatPct}%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      seatPct >= 90 ? 'bg-amber-500' : 'bg-teal-600'
                    }`}
                    style={{ width: `${seatPct}%` }}
                  />
                </div>
              </div>

              {/* Storage Usage Bar */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold text-slate-700 flex items-center">
                    <HardDrive className="w-3.5 h-3.5 mr-1 text-indigo-600" /> Media & Document Storage
                  </span>
                  <span className="font-mono text-slate-500">
                    {storageUsedEstimate} MB / {storageLimit} MB ({storagePct}%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      storagePct >= 90 ? 'bg-amber-500' : 'bg-indigo-600'
                    }`}
                    style={{ width: `${storagePct}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
