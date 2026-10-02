// ============================================================================
// DSBC APP OWNER PRODUCTION CONTROL CENTER & SAFETY ENGINE (Directive 20)
// ============================================================================

import React, { useState, useEffect } from 'react';
import { Company, Employee } from '../../types';
import { useSubscription } from '../../context/SubscriptionContext';
import { useEntitlement } from '../../context/EntitlementContext';
import { entitlementService } from '../../services/entitlementService';
import { environmentConfig } from '../../services/environmentConfig';
import { publishingService } from '../../services/publishingService';
import {
  Activity,
  Shield,
  Server,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Database,
  Cloud,
  CreditCard,
  Mail,
  Globe,
  Radio,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
  Search,
  Filter,
  DollarSign,
  Users,
  Building2,
  Lock,
  Download,
  Clock,
  RotateCcw,
  BarChart3,
  MessageSquare,
} from 'lucide-react';
import { conversionFunnelService } from '../../services/conversionFunnelService';
import { supportService, SupportStatus } from '../../services/supportService';
import { runBackendAction } from '../../lib/backend';
import { PlatformHealthPanel } from './PlatformHealthPanel';

interface SaaSProductionControlTabProps {
  companies: Company[];
  employees: Employee[];
}

export const SaaSProductionControlTab: React.FC<SaaSProductionControlTabProps> = ({
  companies,
  employees,
}) => {
  const { allSubscriptions, allInvoices, commercialMetrics } = useSubscription();
  const { globalPolicy, refresh } = useEntitlement();

  const [activeSubView, setActiveSubView] = useState<'health' | 'safety' | 'customers' | 'payments' | 'failures' | 'funnel' | 'support'>('health');
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmSafetyAction, setConfirmSafetyAction] = useState<string | null>(null);
  const [safetySuccess, setSafetySuccess] = useState<string | null>(null);
  const [ticketFilter, setTicketFilter] = useState<SupportStatus | 'ALL'>('ALL');
  const [supportTickets, setSupportTickets] = useState(supportService.getTickets());

  useEffect(() => {
    return supportService.subscribe(() => {
      setSupportTickets(supportService.getTickets(ticketFilter));
    });
  }, [ticketFilter]);

  const envConfig = environmentConfig.getConfig();

  // Safety Controls State (Synced with GlobalPolicy / Local Overrides)
  const [registrationEnabled, setRegistrationEnabled] = useState(globalPolicy.allowSelfRegistration);
  const [individualRegEnabled, setIndividualRegEnabled] = useState(true);
  const [companyRegEnabled, setCompanyRegEnabled] = useState(true);
  const [newCompanyCreationEnabled, setNewCompanyCreationEnabled] = useState(true);
  const [publishingEnabled, setPublishingEnabled] = useState(true);
  const [maintenanceMode, setMaintenanceMode] = useState(globalPolicy.maintenanceMode);
  const [defaultIndPlan, setDefaultIndPlan] = useState(globalPolicy.defaultIndividualPlanId);
  const [defaultCompPlan, setDefaultCompPlan] = useState(globalPolicy.defaultCompanyPlanId);
  const [defaultTrialDays, setDefaultTrialDays] = useState(globalPolicy.defaultTrialDays);

  // Directive 27: failed payments come from the server invoice ledger only
  // (no simulated rows); with payments disabled this list is normally empty.
  const failedPayments = allInvoices
    .filter((inv) => inv.paymentStatus === 'FAILED')
    .map((inv) => ({
      id: inv.invoiceId,
      customer: inv.customerName,
      amount: inv.amount,
      failureReason: 'Payment failed (server ledger)',
      retryState: 'Manual follow-up',
      gracePeriodEnds: inv.issuedAt,
    }));

  const handleApplySafetyPolicy = async () => {
    const saved = await runBackendAction(() => entitlementService.updateGlobalPolicy(
      {
        maintenanceMode,
        allowSelfRegistration: registrationEnabled,
        defaultIndividualPlanId: defaultIndPlan,
        defaultCompanyPlanId: defaultCompPlan,
        defaultTrialDays,
      },
      { id: 'app_owner_prod', name: 'App Owner', role: 'app_owner' },
      'Production safety controls changed from the Production Control tab'
    ));
    if (!saved) return;
    refresh();
    setSafetySuccess('Production safety controls updated and recorded in audit ledger.');
    setConfirmSafetyAction(null);
    setTimeout(() => setSafetySuccess(null), 3500);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner with Environment Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-slate-900 text-white shadow-xl">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-teal-500/20 text-teal-400 flex items-center justify-center border border-teal-500/30">
            <Server className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-bold">App Owner Production Control Center</h2>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase border ${
                  envConfig.isProduction
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                }`}
              >
                {envConfig.environment} ENVIRONMENT
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Directive 20 Operational Gateway: Live System Health, Payment Governance, & Safety Controls
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-[11px] text-slate-400 font-mono">
            {envConfig.firebaseProjectId} / {envConfig.firestoreDatabaseId} (fixed at build time)
          </span>
        </div>
      </div>

      {safetySuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-600" />
          {safetySuccess}
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => setActiveSubView('health')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center space-x-1.5 ${
            activeSubView === 'health'
              ? 'bg-slate-900 text-white'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Activity className="w-3.5 h-3.5 text-teal-500" />
          <span>System Health</span>
        </button>

        <button
          onClick={() => setActiveSubView('safety')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center space-x-1.5 ${
            activeSubView === 'safety'
              ? 'bg-slate-900 text-white'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Shield className="w-3.5 h-3.5 text-amber-500" />
          <span>Production Safety Controls</span>
        </button>

        <button
          onClick={() => setActiveSubView('customers')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center space-x-1.5 ${
            activeSubView === 'customers'
              ? 'bg-slate-900 text-white'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Users className="w-3.5 h-3.5 text-blue-500" />
          <span>Customer Ledger ({allSubscriptions.length})</span>
        </button>

        <button
          onClick={() => setActiveSubView('payments')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center space-x-1.5 ${
            activeSubView === 'payments'
              ? 'bg-slate-900 text-white'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
          <span>Payment Ledger ({allInvoices.length})</span>
        </button>

        <button
          onClick={() => setActiveSubView('failures')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center space-x-1.5 ${
            activeSubView === 'failures'
              ? 'bg-slate-900 text-white'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
          <span>Failed Payments (1)</span>
        </button>

        <button
          onClick={() => setActiveSubView('funnel')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center space-x-1.5 ${
            activeSubView === 'funnel'
              ? 'bg-slate-900 text-white'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5 text-indigo-500" />
          <span>Conversion Funnel</span>
        </button>

        <button
          onClick={() => setActiveSubView('support')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center space-x-1.5 ${
            activeSubView === 'support'
              ? 'bg-slate-900 text-white'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5 text-teal-600" />
          <span>Support Desk ({supportTickets.length})</span>
        </button>
      </div>

      {/* VIEW 1: SYSTEM HEALTH (measured by the backend, Directive 27 Phase 10) */}
      {activeSubView === 'health' && <PlatformHealthPanel />}

      {/* VIEW 2: PRODUCTION SAFETY CONTROLS */}
      {activeSubView === 'safety' && (
        <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm space-y-6 animate-in fade-in">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Platform Safety & Governance Controls</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Configure universal kill-switches, self-service boundaries, and default customer tiers.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Maintenance Mode Toggle */}
            <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-900 block">Emergency Maintenance Mode</span>
                <span className="text-[11px] text-slate-500">Lock non-admin mutations across the platform</span>
              </div>
              <button
                type="button"
                onClick={() => setMaintenanceMode(!maintenanceMode)}
                className={`w-12 h-6 rounded-full transition-colors relative ${
                  maintenanceMode ? 'bg-rose-600' : 'bg-slate-300'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transition-transform transform shadow-xs ${
                    maintenanceMode ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Public Publishing Toggle */}
            <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-900 block">Public Publishing</span>
                <span className="text-[11px] text-slate-500">Allow users to publish new cards & company URLs</span>
              </div>
              <button
                type="button"
                onClick={() => setPublishingEnabled(!publishingEnabled)}
                className={`w-12 h-6 rounded-full transition-colors relative ${
                  publishingEnabled ? 'bg-teal-600' : 'bg-slate-300'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transition-transform transform shadow-xs ${
                    publishingEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Self Registration Toggle */}
            <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-900 block">Global Self-Registration</span>
                <span className="text-[11px] text-slate-500">Accept new organic sign-ups from landing pages</span>
              </div>
              <button
                type="button"
                onClick={() => setRegistrationEnabled(!registrationEnabled)}
                className={`w-12 h-6 rounded-full transition-colors relative ${
                  registrationEnabled ? 'bg-teal-600' : 'bg-slate-300'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transition-transform transform shadow-xs ${
                    registrationEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Payment Ingestion Toggle */}
            <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-900 block">Payment & Checkout Gateway</span>
                <span className="text-[11px] text-slate-500">Online payments stay off until a payment-launch directive enables them on the server</span>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200" data-testid="payments-disabled">
                DISABLED (server PAYMENTS_ENABLED=false)
              </span>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
            <button
              onClick={() => setConfirmSafetyAction('APPLY_SAFETY_CONFIG')}
              className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-xs"
            >
              Apply Safety Configuration
            </button>
          </div>

          {/* Safety Confirmation Modal */}
          {confirmSafetyAction && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
              <div className="w-full max-w-md p-6 bg-white rounded-3xl shadow-2xl border border-slate-200 space-y-4">
                <div className="flex items-center space-x-2.5 text-amber-600 font-bold text-sm">
                  <AlertTriangle className="w-5 h-5" />
                  <span>Confirm Safety Policy Mutation</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Modifying platform safety policies will impact all customer accounts across the active environment. An immutable audit record will be logged.
                </p>
                <div className="flex items-center justify-end space-x-2 pt-2">
                  <button
                    onClick={() => setConfirmSafetyAction(null)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleApplySafetyPolicy}
                    className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs"
                  >
                    Confirm & Apply
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW 3: CUSTOMERS TABLE */}
      {activeSubView === 'customers' && (
        <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Commercial Customer Ledger</h3>
              <p className="text-xs text-slate-500">Live directory of registered individuals and enterprise tenants.</p>
            </div>
            <div className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-xl">
              {allSubscriptions.length} Subscriptions
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Assigned Plan</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Payment</th>
                  <th className="py-3 px-4">Renewal Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {allSubscriptions.map((s) => (
                  <tr key={s.subscriptionId} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {s.customerName || s.customerId}
                    </td>
                    <td className="py-3 px-4 capitalize font-mono text-[11px]">{s.customerType}</td>
                    <td className="py-3 px-4 font-bold text-teal-700">{s.planId.replace('_', ' ').toUpperCase()}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {s.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px]">{s.paymentStatus}</td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                      {new Date(s.currentPeriodEnd).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 4: PAYMENTS TABLE */}
      {activeSubView === 'payments' && (
        <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Payment & Invoicing Ledger</h3>
              <p className="text-xs text-slate-500">Complete historical transactions across India and international gateways.</p>
            </div>
            <div className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-xl">
              {allInvoices.length} Invoices
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Provider</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Issued At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {allInvoices.map((inv) => (
                  <tr key={inv.invoiceId} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{inv.invoiceId}</td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{inv.customerName}</td>
                    <td className="py-3 px-4 font-black text-slate-900">
                      ₹{inv.amount} <span className="text-[10px] font-normal text-slate-500">{inv.currency}</span>
                    </td>
                    <td className="py-3 px-4">{inv.provider}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {inv.paymentStatus}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                      {new Date(inv.issuedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 5: FAILED PAYMENTS */}
      {activeSubView === 'failures' && (
        <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm space-y-4 animate-in fade-in">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Failed Payment & Dunning Management</h3>
            <p className="text-xs text-slate-500">Accounts in dunning with active grace periods and scheduled retries.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Transaction ID</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Failure Reason</th>
                  <th className="py-3 px-4">Retry State</th>
                  <th className="py-3 px-4">Grace Expiry</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {failedPayments.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 px-4 text-center text-[11px] text-slate-500">No failed payments recorded by the server.</td>
                  </tr>
                )}
                {failedPayments.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-mono text-slate-900">{f.id}</td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{f.customer}</td>
                    <td className="py-3 px-4 font-bold text-rose-700">₹{f.amount}</td>
                    <td className="py-3 px-4 text-rose-600 text-[11px]">{f.failureReason}</td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-600">{f.retryState}</td>
                    <td className="py-3 px-4 font-mono text-[11px] text-amber-700">
                      {new Date(f.gracePeriodEnds).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 6: CONVERSION FUNNEL (Directive 21 Section 13) */}
      {activeSubView === 'funnel' && (
        <div className="space-y-6 animate-in fade-in">
          {(() => {
            const metrics = conversionFunnelService.getFunnelMetrics();
            return (
              <>
                <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Product Conversion Funnel Analytics</h3>
                      <p className="text-xs text-slate-500">
                        Aggregate onboarding progression from landing view to paid customer activation (Zero PII).
                      </p>
                    </div>
                    <span className="text-[11px] font-mono text-slate-500">
                      Total Tracked Visitors: <strong className="text-slate-900">{metrics.totalVisitors.toLocaleString()}</strong>
                    </span>
                  </div>

                  <div className="space-y-3 pt-2">
                    {metrics.stages.map((stage, idx) => (
                      <div key={stage.stage} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center space-x-2">
                            <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-[10px]">
                              {idx + 1}
                            </span>
                            <span className="font-bold text-slate-900">{stage.label}</span>
                          </div>
                          <div className="flex items-center space-x-4">
                            <span className="font-mono font-bold text-slate-900">{stage.count.toLocaleString()}</span>
                            <span className="font-mono text-[11px] text-teal-700 font-semibold bg-teal-50 px-2 py-0.5 rounded">
                              {stage.conversionRate}% conv
                            </span>
                            {stage.dropoffRate > 0 && (
                              <span className="font-mono text-[11px] text-rose-600">
                                -{stage.dropoffRate}% drop
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Visual Bar */}
                        <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-teal-600 to-indigo-600 rounded-full transition-all duration-300"
                            style={{ width: `${Math.max(4, Math.round((stage.count / metrics.totalVisitors) * 100))}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent Events Stream */}
                <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm space-y-3">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider text-slate-500">
                    Live Anonymous Event Feed (Recent 10)
                  </h4>
                  <div className="space-y-2">
                    {metrics.recentEvents.slice(0, 10).map((ev) => (
                      <div
                        key={ev.id}
                        className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-[10px] bg-slate-200 px-1.5 py-0.5 rounded text-slate-700">
                            {ev.eventType}
                          </span>
                          <span className="text-slate-600 capitalize">{ev.customerType || 'visitor'}</span>
                        </div>
                        <span className="text-[11px] font-mono text-slate-400">
                          {new Date(ev.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* VIEW 7: SUPPORT DESK (Directive 21 Section 14) */}
      {activeSubView === 'support' && (
        <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm space-y-4 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Customer Support Ticket Desk</h3>
              <p className="text-xs text-slate-500">Manage inbound inquiries, bug reports, and enterprise requests.</p>
            </div>

            {/* Filter Buttons */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {(['ALL', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setTicketFilter(st)}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                    ticketFilter === st
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {st.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {supportTickets.map((t) => (
              <div
                key={t.id}
                className="p-4 rounded-2xl border border-slate-200/90 bg-slate-50/50 space-y-2 hover:bg-slate-50 transition"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-800">
                      {t.ticketNumber}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        t.status === 'OPEN'
                          ? 'bg-amber-100 text-amber-800'
                          : t.status === 'IN_PROGRESS'
                          ? 'bg-blue-100 text-blue-800'
                          : t.status === 'RESOLVED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {t.status.replace('_', ' ')}
                    </span>
                    <span className="text-xs font-bold text-slate-900">{t.subject}</span>
                  </div>

                  {/* Quick Status Action Controls */}
                  <div className="flex items-center space-x-1.5">
                    {t.status !== 'IN_PROGRESS' && t.status !== 'RESOLVED' && (
                      <button
                        onClick={() => supportService.updateTicketStatus(t.id, 'IN_PROGRESS')}
                        className="px-2 py-1 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
                      >
                        In Progress
                      </button>
                    )}
                    {t.status !== 'RESOLVED' && (
                      <button
                        onClick={() => supportService.updateTicketStatus(t.id, 'RESOLVED')}
                        className="px-2 py-1 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                      >
                        Resolve
                      </button>
                    )}
                    {t.status !== 'CLOSED' && (
                      <button
                        onClick={() => supportService.updateTicketStatus(t.id, 'CLOSED')}
                        className="px-2 py-1 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200"
                      >
                        Close
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">{t.message}</p>

                {t.responseNotes && (
                  <div className="p-2 rounded-lg bg-white border border-slate-200 text-[11px] text-slate-500">
                    <strong className="text-slate-700">Internal Notes:</strong> {t.responseNotes}
                  </div>
                )}

                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-200/60">
                  <span>
                    From: <strong className="text-slate-600">{t.name}</strong> ({t.email})
                  </span>
                  <span>{new Date(t.createdAt).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
