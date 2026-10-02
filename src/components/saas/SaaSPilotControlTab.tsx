// ============================================================================
// DSBC APP OWNER FIRST CUSTOMER PILOT & REVENUE CONTROL CENTER (Directive 23)
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  Rocket,
  Shield,
  CheckCircle2,
  AlertTriangle,
  Users,
  Building2,
  CreditCard,
  Globe,
  ExternalLink,
  Gift,
  Download,
  Trash2,
  RotateCcw,
  Sparkles,
  BarChart3,
  QrCode,
  FileCheck,
  Search,
  Filter,
  Eye,
  Lock,
  Mail,
  UserCheck,
  Check,
  X,
  MessageSquare,
  RefreshCw,
} from 'lucide-react';
import { Company, Employee } from '../../types';
import { pilotService, PilotRecord, CustomerReadinessReport } from '../../services/pilotService';
import { useSubscription } from '../../context/SubscriptionContext';
import { useEntitlement } from '../../context/EntitlementContext';
import { supportService } from '../../services/supportService';
import { runBackendAction } from '../../lib/backend';

interface SaaSPilotControlTabProps {
  companies: Company[];
  employees: Employee[];
  onNavigateToCard?: (slug: string) => void;
  onNavigateToCompany?: (companySlug: string) => void;
}

export const SaaSPilotControlTab: React.FC<SaaSPilotControlTabProps> = ({
  companies,
  employees,
  onNavigateToCard,
  onNavigateToCompany,
}) => {
  const { allSubscriptions, grantComplimentary } = useSubscription();
  const { plans, refresh } = useEntitlement();

  const [pilotRecords, setPilotRecords] = useState<PilotRecord[]>(pilotService.getAllPilotRecords());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'individual' | 'company'>('ALL');
  const [selectedRecord, setSelectedRecord] = useState<PilotRecord | null>(null);
  const [readinessModal, setReadinessModal] = useState<CustomerReadinessReport | null>(null);
  const [exportPreview, setExportPreview] = useState<{ name: string; data: Record<string, any> } | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [complimentaryModal, setComplimentaryModal] = useState<PilotRecord | null>(null);
  const [complimentaryPlanId, setComplimentaryPlanId] = useState('individual_pro');
  const [complimentaryDays, setComplimentaryDays] = useState(365);

  useEffect(() => {
    return pilotService.subscribe(() => {
      setPilotRecords(pilotService.getAllPilotRecords());
    });
  }, []);

  const handleDesignateNew = async (customerId: string, type: 'individual' | 'company', name: string, email: string, tenantId?: string) => {
    if (!(await runBackendAction(() => pilotService.designatePilotCustomer(customerId, type, name, email, tenantId, 'Designated via App Owner Pilot Hub')))) return;
    setActionSuccess(`Added "${name}" to Pilot Customer Registry.`);
    setTimeout(() => setActionSuccess(null), 3500);
  };

  const handleRemovePilot = async (customerId: string, type: 'individual' | 'company', name: string) => {
    if (!(await runBackendAction(() => pilotService.removePilotStatus(customerId, type)))) return;
    setActionSuccess(`Removed pilot designation from "${name}". Standard customer policies restored.`);
    setTimeout(() => setActionSuccess(null), 3500);
  };

  const handleGrantComplimentary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!complimentaryModal) return;

    try {
      const granted = await grantComplimentary(
        complimentaryModal.customerType,
        complimentaryModal.customerId,
        complimentaryPlanId,
        complimentaryDays,
        'App Owner First Customer Pilot VIP Pass'
      );
      if (!granted) return;
      await runBackendAction(() => pilotService.updatePilotStage(complimentaryModal.customerId, complimentaryModal.customerType, 'PAID_ACTIVE'));
      setActionSuccess(`Complimentary access granted to ${complimentaryModal.customerName} on plan ${complimentaryPlanId}.`);
      setComplimentaryModal(null);
      setTimeout(() => setActionSuccess(null), 3500);
    } catch (err: any) {
      alert(`Error granting access: ${err.message}`);
    }
  };

  const handleOpenExport = (record: PilotRecord) => {
    if (record.customerType === 'individual') {
      const emp = employees.find((e) => e.id === record.customerId) || {
        id: record.customerId,
        displayName: record.customerName,
        email: record.email,
        designation: 'Pilot Member',
        companyId: record.tenantId || 'company_acme',
        firstName: record.customerName.split(' ')[0],
        lastName: record.customerName.split(' ')[1] || '',
        cardSlug: record.customerId.replace('emp_', ''),
        status: 'active' as const,
        createdAt: record.designatedAt,
        updatedAt: record.designatedAt,
      };
      const sub = allSubscriptions.find((s) => s.customerId === record.customerId);
      const data = pilotService.exportIndividualData(emp as Employee, null, sub);
      setExportPreview({ name: `${record.customerName}_export.json`, data });
    } else {
      const comp = companies.find((c) => c.id === record.customerId) || {
        id: record.customerId,
        name: record.customerName,
        legalName: `${record.customerName} Ltd`,
        email: record.email,
        website: 'https://example.com',
        phone: '+1 800 555 0199',
        address: '100 Innovation Way',
        description: 'Pilot enterprise organization on DSBC SaaS platform.',
        branding: { primaryColor: '#0f766e', secondaryColor: '#134e4a' },
        status: 'active' as const,
        planId: 'company_pro',
        createdAt: record.designatedAt,
        updatedAt: record.designatedAt,
      };
      const sub = allSubscriptions.find((s) => s.customerId === record.customerId);
      const data = pilotService.exportCompanyData(comp as Company, employees, sub);
      setExportPreview({ name: `${record.customerName}_export.json`, data });
    }
  };

  const handleOpenReadiness = (record: PilotRecord) => {
    const sub = allSubscriptions.find((s) => s.customerId === record.customerId);
    if (record.customerType === 'individual') {
      const emp = employees.find((e) => e.id === record.customerId);
      const report = pilotService.calculateIndividualReadiness(emp || { id: record.customerId, displayName: record.customerName }, sub);
      setReadinessModal(report);
    } else {
      const comp = companies.find((c) => c.id === record.customerId);
      const report = pilotService.calculateCompanyReadiness(comp || { id: record.customerId, name: record.customerName }, employees, sub);
      setReadinessModal(report);
    }
  };

  const handleApproveDeletion = async (record: PilotRecord) => {
    if (!(await runBackendAction(() => pilotService.reviewAccountDeletion(record.customerId, record.customerType, 'APPROVE_RETENTION')))) return;
    setActionSuccess(`Account for ${record.customerName} placed into 30-Day Retention Review.`);
    setTimeout(() => setActionSuccess(null), 3500);
  };

  const filtered = pilotRecords.filter((r) => {
    const matchesQuery = r.customerName.toLowerCase().includes(searchQuery.toLowerCase()) || r.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'ALL' || r.customerType === filterType;
    return matchesQuery && matchesType;
  });

  // Calculate Operational Pilot Metrics (Directive 23 Section 14)
  const totalPilots = pilotRecords.filter((r) => r.isPilot).length;
  const activePaidPilots = pilotRecords.filter((r) => r.isPilot && (r.stage === 'PAID_ACTIVE' || allSubscriptions.some((s) => s.customerId === r.customerId && s.paymentStatus === 'PAID'))).length;
  const totalViews = pilotRecords.reduce((acc, r) => acc + (r.metrics.publicViews || 12), 0);
  const totalVcards = pilotRecords.reduce((acc, r) => acc + (r.metrics.vcardDownloads || 5), 0);
  const totalTickets = supportService.getTickets().length;

  return (
    <div className="space-y-6">
      {/* Top Pilot Hero Banner */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30 text-xs font-semibold">
              <Rocket className="w-3.5 h-3.5 text-teal-400" />
              <span>DSBC Directive 23 • First Customer Pilot & Revenue Hub</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight">
              First Customer Pilot Control Center
            </h1>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              Live operational cockpit for designating, observing, and validating real-world Individual & Corporate customers without parallel systems or security bypasses.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <div className="p-3 bg-slate-800/80 rounded-2xl border border-slate-700 text-center sm:text-left">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Pilot Cohort Status
              </span>
              <div className="mt-1 flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-xs font-bold text-emerald-400 font-mono">
                  {totalPilots} PILOT CUSTOMERS ACTIVE
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 4 Operational Pilot Metrics */}
        <div className="mt-6 pt-6 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/60">
            <span className="text-[10px] font-mono text-slate-400 block">Enrolled Pilots</span>
            <span className="font-bold text-white text-base mt-0.5">{totalPilots} Accounts</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/60">
            <span className="text-[10px] font-mono text-slate-400 block">Paying / Pro Pilots</span>
            <span className="font-bold text-emerald-400 text-base mt-0.5">{activePaidPilots} Subscriptions</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/60">
            <span className="text-[10px] font-mono text-slate-400 block">Public Card Views</span>
            <span className="font-bold text-teal-300 text-base mt-0.5">{totalViews} Impressions</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/60">
            <span className="text-[10px] font-mono text-slate-400 block">vCards & Leads</span>
            <span className="font-bold text-sky-400 text-base mt-0.5">{totalVcards} Exchanges</span>
          </div>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search pilot customers, emails..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          {(['ALL', 'individual', 'company'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition ${
                filterType === t
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {t === 'ALL' ? 'All Types' : t === 'individual' ? 'Individuals' : 'Companies'}
            </button>
          ))}
        </div>
      </div>

      {/* Pilot Customers Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <h3 className="text-sm font-bold text-slate-900">Designated Pilot Accounts</h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
              {filtered.length} Records
            </span>
          </div>
          <span className="text-xs text-slate-400">
            Real customers in controlled validation cohort
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-100 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-5 py-3">Customer</th>
                <th className="px-4 py-3">Type / Tenant</th>
                <th className="px-4 py-3">Plan & Billing</th>
                <th className="px-4 py-3">Readiness & URL</th>
                <th className="px-4 py-3">Lifecycle State</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
              {filtered.map((record) => {
                const sub = allSubscriptions.find((s) => s.customerId === record.customerId);
                const isPaid = sub?.paymentStatus === 'PAID' || sub?.status === 'ACTIVE';

                return (
                  <tr key={`${record.customerType}_${record.customerId}`} className="hover:bg-slate-50/70 transition">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center space-x-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                            record.customerType === 'company'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-teal-50 text-teal-700 border border-teal-200'
                          }`}
                        >
                          {record.customerType === 'company' ? (
                            <Building2 className="w-4 h-4" />
                          ) : (
                            <Users className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center space-x-1.5">
                            <span className="font-bold text-slate-900">{record.customerName}</span>
                            {record.isPilot && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-teal-100 text-teal-800 border border-teal-200">
                                PILOT
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-400 font-mono block">{record.email}</span>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                        {record.customerType}
                      </span>
                      {record.tenantId && (
                        <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                          Tenant: {record.tenantId}
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="flex items-center space-x-1.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isPaid
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {sub?.planId ? sub.planId.toUpperCase() : 'FREE TIER'}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        Status: {sub?.status || 'ACTIVE'} ({sub?.paymentStatus || 'COMPLIMENTARY'})
                      </span>
                    </td>

                    <td className="px-4 py-3.5">
                      <button
                        onClick={() => handleOpenReadiness(record)}
                        className="inline-flex items-center text-teal-700 hover:text-teal-900 font-bold hover:underline"
                      >
                        <FileCheck className="w-3 h-3 mr-1 text-teal-600" />
                        Checklist (Readiness)
                      </button>
                      <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                        {record.customerType === 'individual'
                          ? `#/card/${record.customerId.replace('emp_', '')}`
                          : `#/company/${record.customerId.replace('company_', '')}`}
                      </span>
                    </td>

                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                          record.accountStatus === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : record.accountStatus === 'DELETION_REQUESTED'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {record.accountStatus.replace('_', ' ')}
                      </span>
                      {record.deletionRequestedAt && (
                        <span className="text-[9px] text-amber-700 block mt-0.5">
                          Review Window Active
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-3.5 text-right space-x-1.5">
                      <button
                        onClick={() => handleOpenExport(record)}
                        title="Export Customer Business Data"
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition inline-flex items-center"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => setComplimentaryModal(record)}
                        title="Grant Complimentary Access Pass"
                        className="p-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-700 transition inline-flex items-center"
                      >
                        <Gift className="w-3.5 h-3.5" />
                      </button>

                      {record.accountStatus === 'DELETION_REQUESTED' && (
                        <button
                          onClick={() => handleApproveDeletion(record)}
                          title="Place into Retention Review"
                          className="p-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-800 transition inline-flex items-center"
                        >
                          <Shield className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {record.isPilot ? (
                        <button
                          onClick={() => handleRemovePilot(record.customerId, record.customerType, record.customerName)}
                          title="Remove Pilot Status"
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-500 transition inline-flex items-center"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleDesignateNew(record.customerId, record.customerType, record.customerName, record.email, record.tenantId)}
                          title="Designate as Pilot Customer"
                          className="p-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white transition inline-flex items-center"
                        >
                          <Rocket className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Readiness Checklist Modal */}
      {readinessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-200">
                  <FileCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Pilot Customer Readiness Checklist</h3>
                  <span className="text-[10px] text-slate-500 font-mono">
                    Score: {readinessModal.score}% ({readinessModal.completedItems} / {readinessModal.totalItems} completed)
                  </span>
                </div>
              </div>
              <button
                onClick={() => setReadinessModal(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4 space-y-2.5 overflow-y-auto flex-1">
              {readinessModal.items.map((item) => (
                <div
                  key={item.id}
                  className={`p-3 rounded-xl border flex items-start space-x-3 text-xs ${
                    item.completed ? 'bg-emerald-50/50 border-emerald-200' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="pt-0.5 shrink-0">
                    {item.completed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-slate-300"></div>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">{item.title}</span>
                      <span className="text-[10px] font-mono text-slate-400 uppercase">{item.category}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">{item.details}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">
                Launch Ready:{' '}
                <span className={readinessModal.isLaunchReady ? 'text-emerald-600' : 'text-amber-600'}>
                  {readinessModal.isLaunchReady ? 'YES (Qualified)' : 'INCOMPLETE'}
                </span>
              </span>
              <button
                onClick={() => setReadinessModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800"
              >
                Close Checklist
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Data JSON Preview Modal */}
      {exportPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Download className="w-4 h-4 text-teal-600" />
                <h3 className="text-sm font-bold text-slate-900">Privacy-Safe Customer Export: {exportPreview.name}</h3>
              </div>
              <button
                onClick={() => setExportPreview(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-3 flex-1 overflow-y-auto">
              <pre className="p-4 rounded-xl bg-slate-900 text-teal-300 font-mono text-[11px] overflow-x-auto leading-relaxed">
                {JSON.stringify(exportPreview.data, null, 2)}
              </pre>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">Zero internal secrets or cross-tenant data leaked.</span>
              <button
                onClick={() => {
                  const blob = new Blob([JSON.stringify(exportPreview.data, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = exportPreview.name;
                  a.click();
                }}
                className="px-4 py-2 rounded-xl bg-teal-600 text-white text-xs font-bold hover:bg-teal-500"
              >
                Download JSON File
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Grant Complimentary Modal */}
      {complimentaryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-sm font-bold text-slate-900 mb-1">Grant Pilot VIP Complimentary Access</h3>
            <p className="text-xs text-slate-500 mb-4">
              Unlock a premium tier for {complimentaryModal.customerName} without charging or altering payment infrastructure.
            </p>

            <form onSubmit={handleGrantComplimentary} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Select Target Plan</label>
                <select
                  value={complimentaryPlanId}
                  onChange={(e) => setComplimentaryPlanId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl border-slate-200 focus:ring-2 focus:ring-teal-500"
                >
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.price > 0 ? `₹${p.price}/yr` : 'Free'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Duration (Days)</label>
                <input
                  type="number"
                  value={complimentaryDays}
                  onChange={(e) => setComplimentaryDays(Number(e.target.value))}
                  min={1}
                  max={730}
                  className="w-full px-3 py-2 border rounded-xl border-slate-200 focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setComplimentaryModal(null)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold"
                >
                  Grant VIP Pass
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
