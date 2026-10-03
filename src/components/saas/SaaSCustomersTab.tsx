import React, { useState } from 'react';
import { Company, Employee } from '../../types';
import { Plan, EntitlementOverride } from '../../types/entitlement';
import {
  Building2,
  User,
  Search,
  Filter,
  ExternalLink,
  Shield,
  Sparkles,
  Sliders,
  CheckCircle,
  Clock,
  ArrowRight,
  UserCheck,
} from 'lucide-react';
import { shouldShowApproveShortcut } from '../../lib/pendingApproval';

interface SaaSCustomersTabProps {
  companies: Company[];
  employees: Employee[];
  plans: Plan[];
  overrides: EntitlementOverride[];
  onInspectCustomer: (type: 'company' | 'individual', id: string, name: string) => void;
  onNavigateToCard?: (slug: string) => void;
  /** Routes the App Owner to the Pending Customers tab to approve a pending account. */
  onGoToPendingApprovals?: () => void;
}

export const SaaSCustomersTab: React.FC<SaaSCustomersTabProps> = ({
  companies,
  employees,
  plans,
  overrides,
  onInspectCustomer,
  onNavigateToCard,
  onGoToPendingApprovals,
}) => {
  const [search, setSearch] = useState('');
  const [targetFilter, setTargetFilter] = useState<'all' | 'companies' | 'individuals'>('all');
  const [planFilter, setPlanFilter] = useState<string>('all');

  // Filtered companies
  const filteredCompanies = companies.filter((c) => {
    const matchSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      c.id.toLowerCase().includes(search.toLowerCase());
    const matchPlan = planFilter === 'all' || c.planId === planFilter;
    return matchSearch && matchPlan;
  });

  // Filtered employees
  const filteredEmployees = employees.filter((e) => {
    const matchSearch =
      e.displayName.toLowerCase().includes(search.toLowerCase()) ||
      e.email.toLowerCase().includes(search.toLowerCase()) ||
      e.id.toLowerCase().includes(search.toLowerCase());
    return matchSearch;
  });

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Search & Filter Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Customer Directory & Entitlements</h2>
          <p className="text-xs text-slate-500">
            Inspect individual customers, active corporate tenants, subscription tiers, and granted exceptions.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, email, or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
            />
          </div>

          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setTargetFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition ${
                targetFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
              }`}
            >
              All ({companies.length + employees.length})
            </button>
            <button
              onClick={() => setTargetFilter('companies')}
              className={`px-3 py-1.5 rounded-lg transition ${
                targetFilter === 'companies' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
              }`}
            >
              Companies ({companies.length})
            </button>
            <button
              onClick={() => setTargetFilter('individuals')}
              className={`px-3 py-1.5 rounded-lg transition ${
                targetFilter === 'individuals' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
              }`}
            >
              Individuals ({employees.length})
            </button>
          </div>
        </div>
      </div>

      {/* Companies Section */}
      {(targetFilter === 'all' || targetFilter === 'companies') && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Building2 className="w-4 h-4 text-indigo-600" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Corporate Tenants ({filteredCompanies.length})
              </h3>
            </div>
            <span className="text-[11px] text-slate-400">Enterprise accounts & seats</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-white text-slate-400 font-semibold uppercase text-[10px] border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">Company Name</th>
                  <th className="py-3 px-4">Current Plan</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Active Overrides</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCompanies.map((comp) => {
                  const plan = plans.find((p) => p.id === comp.planId);
                  const companyOverrides = overrides.filter(
                    (o) => o.targetType === 'company' && o.targetId === comp.id
                  );

                  return (
                    <tr key={comp.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2.5">
                          <div
                            className="w-7 h-7 rounded-lg text-white font-bold text-xs flex items-center justify-center shrink-0"
                            style={{ backgroundColor: comp.branding?.primaryColor || '#0f766e' }}
                          >
                            {comp.name.charAt(0)}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block">{comp.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {comp.id} • {comp.email}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
                          {plan?.name || comp.planId || 'Company Free'}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                            comp.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {comp.status}
                        </span>
                        {shouldShowApproveShortcut(comp.status) && onGoToPendingApprovals && (
                          <button
                            type="button"
                            onClick={onGoToPendingApprovals}
                            title="This account is awaiting approval. Approve it in the Pending Customers tab."
                            className="mt-1 flex items-center text-[10px] font-semibold text-teal-700 hover:text-teal-900"
                          >
                            <UserCheck className="w-3 h-3 mr-1" /> Approve in Pending Customers
                            <ArrowRight className="w-3 h-3 ml-0.5" />
                          </button>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        {companyOverrides.length > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <Sparkles className="w-3 h-3 mr-1 text-amber-500" />
                            {companyOverrides.length} active override{companyOverrides.length > 1 ? 's' : ''}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px]">None (Strict Plan Policy)</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => onInspectCustomer('company', comp.id, comp.name)}
                          className="inline-flex items-center px-3 py-1 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition space-x-1"
                        >
                          <Sliders className="w-3 h-3" />
                          <span>Inspect Entitlements</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Individuals Section */}
      {(targetFilter === 'all' || targetFilter === 'individuals') && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <User className="w-4 h-4 text-teal-600" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Individual Cards & Users ({filteredEmployees.length})
              </h3>
            </div>
            <span className="text-[11px] text-slate-400">Cardholders and standalone professionals</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-white text-slate-400 font-semibold uppercase text-[10px] border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">Name & Email</th>
                  <th className="py-3 px-4">Designation</th>
                  <th className="py-3 px-4">Affiliated Company</th>
                  <th className="py-3 px-4">Individual Overrides</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEmployees.map((emp) => {
                  const comp = companies.find((c) => c.id === emp.companyId);
                  const empOverrides = overrides.filter(
                    (o) => o.targetType === 'individual' && o.targetId === emp.id
                  );

                  return (
                    <tr key={emp.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2.5">
                          <div className="w-7 h-7 rounded-full bg-teal-100 text-teal-800 font-bold text-xs flex items-center justify-center shrink-0">
                            {emp.firstName.charAt(0)}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block">{emp.displayName}</span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {emp.email} • ID: {emp.id}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-slate-600 font-medium">
                        {emp.designation || 'Specialist'}
                      </td>

                      <td className="py-3 px-4">
                        <span className="text-slate-800 font-medium">
                          {comp ? comp.name : 'Independent'}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        {empOverrides.length > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <Sparkles className="w-3 h-3 mr-1 text-amber-500" />
                            {empOverrides.length} active override{empOverrides.length > 1 ? 's' : ''}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px]">None (Follows Plan)</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => onInspectCustomer('individual', emp.id, emp.displayName)}
                          className="inline-flex items-center px-3 py-1 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition space-x-1"
                        >
                          <Sliders className="w-3 h-3" />
                          <span>Inspect Entitlements</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
