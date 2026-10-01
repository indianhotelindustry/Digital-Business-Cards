import React, { useState } from 'react';
import { Company } from '../../types';
import { Plan } from '../../types/entitlement';
import {
  Subscription,
  Invoice,
  CustomerType,
} from '../../types/subscription';
import { subscriptionService } from '../../services/subscriptionService';
import { useSubscription } from '../../context/SubscriptionContext';
import {
  CreditCard,
  Download,
  Receipt,
  CheckCircle,
  TrendingUp,
  FileText,
  Clock,
  AlertTriangle,
  Sparkles,
  Users,
  Building2,
  DollarSign,
  Plus,
  RefreshCw,
  Search,
  X,
  Shield,
} from 'lucide-react';

interface SaaSBillingTabProps {
  companies: Company[];
  plans: Plan[];
}

export const SaaSBillingTab: React.FC<SaaSBillingTabProps> = ({ companies, plans }) => {
  const {
    commercialMetrics,
    allSubscriptions,
    allInvoices,
    grantComplimentary,
    refreshSubscriptions,
  } = useSubscription();

  const [activeSubTab, setActiveSubTab] = useState<'metrics' | 'subscriptions' | 'invoices'>('metrics');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // Complimentary modal state
  const [isComplimentaryModalOpen, setIsComplimentaryModalOpen] = useState(false);
  const [compTargetType, setCompTargetType] = useState<CustomerType>('company');
  const [compTargetId, setCompTargetId] = useState('');
  const [compPlanId, setCompPlanId] = useState('company_pro');
  const [compDurationDays, setCompDurationDays] = useState(365);
  const [compReason, setCompReason] = useState('Strategic Partner Grant');
  const [compSuccess, setCompSuccess] = useState<string | null>(null);

  const filteredSubscriptions = allSubscriptions.filter(
    (s) =>
      s.subscriptionId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.customerName && s.customerName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      s.customerId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.planId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredInvoices = allInvoices.filter(
    (inv) =>
      inv.invoiceId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.planName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleGrantComplimentarySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!compTargetId.trim()) return;

    const ok = await grantComplimentary(
      compTargetType,
      compTargetId.trim(),
      compPlanId,
      compDurationDays,
      compReason
    );

    if (ok) {
      setCompSuccess(`Granted ${compDurationDays} days of ${compPlanId} complimentary access.`);
      setTimeout(() => {
        setCompSuccess(null);
        setIsComplimentaryModalOpen(false);
        setCompTargetId('');
      }, 1800);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Tab Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            Commercial SaaS Control & Revenue Ledger
          </h2>
          <p className="text-xs text-slate-500">
            Real-time MRR/ARR analytics, live customer subscriptions, and immutable billing ledger.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsComplimentaryModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold transition shadow-xs flex items-center space-x-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Grant Complimentary Tier</span>
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveSubTab('metrics')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
            activeSubTab === 'metrics'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Commercial Overview & MRR
        </button>
        <button
          onClick={() => setActiveSubTab('subscriptions')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
            activeSubTab === 'subscriptions'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Active Subscriptions ({allSubscriptions.length})
        </button>
        <button
          onClick={() => setActiveSubTab('invoices')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
            activeSubTab === 'invoices'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Invoices & Tax Ledger ({allInvoices.length})
        </button>
      </div>

      {/* TAB 1: METRICS & KPI DASHBOARD */}
      {activeSubTab === 'metrics' && (
        <div className="space-y-6">
          {/* Revenue KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Annual Recurring Revenue (ARR)
              </span>
              <div className="text-2xl font-black text-slate-900">
                ₹{commercialMetrics.arr.toLocaleString()}
              </div>
              <span className="text-[10px] text-teal-600 font-semibold flex items-center mt-1">
                <TrendingUp className="w-3 h-3 mr-1" />
                Annualized run-rate
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Monthly Recurring Revenue (MRR)
              </span>
              <div className="text-2xl font-black text-slate-900">
                ₹{commercialMetrics.mrr.toLocaleString()}
              </div>
              <span className="text-[10px] text-slate-400 block mt-1">Monthly normalized</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Total Invoiced Revenue
              </span>
              <div className="text-2xl font-black text-emerald-700">
                ₹{commercialMetrics.totalRevenue.toLocaleString()}
              </div>
              <span className="text-[10px] text-emerald-600 font-semibold block mt-1">
                Verified paid ledger
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Paid / Free Customers
              </span>
              <div className="text-2xl font-black text-slate-900">
                {commercialMetrics.paidCustomers} / {commercialMetrics.freeCustomers}
              </div>
              <span className="text-[10px] text-slate-400 block mt-1">
                {Math.round((commercialMetrics.paidCustomers / (commercialMetrics.totalCustomers || 1)) * 100)}% conversion rate
              </span>
            </div>
          </div>

          {/* Subscriptions Status Breakdown */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-400">Active Paid</span>
              <div className="text-lg font-bold text-slate-900 mt-0.5">
                {commercialMetrics.activeSubscriptions}
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-400">Active Trials</span>
              <div className="text-lg font-bold text-amber-600 mt-0.5">
                {commercialMetrics.trialsCount}
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-400">Expiring Trials</span>
              <div className="text-lg font-bold text-amber-700 mt-0.5">
                {commercialMetrics.expiringTrials}
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-400">In Grace Period</span>
              <div className="text-lg font-bold text-rose-600 mt-0.5">
                {commercialMetrics.graceCount}
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-400">Cancelled / Expired</span>
              <div className="text-lg font-bold text-slate-500 mt-0.5">
                {commercialMetrics.cancelledCount}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ACTIVE SUBSCRIPTIONS */}
      {activeSubTab === 'subscriptions' && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search subscriptions by customer or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-hidden focus:border-teal-500"
              />
            </div>
            <span className="text-[11px] text-slate-400 font-mono">
              {filteredSubscriptions.length} Subscriptions Listed
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-white text-slate-400 font-semibold uppercase text-[10px] border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">Subscription ID</th>
                  <th className="py-3 px-4">Customer Entity</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Current Plan</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Price</th>
                  <th className="py-3 px-4">Current Period End</th>
                  <th className="py-3 px-4">Payment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSubscriptions.map((sub) => (
                  <tr key={sub.subscriptionId} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      {sub.subscriptionId}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800">
                      {sub.customerName || sub.customerId}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                        {sub.customerType.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900">{sub.planId}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          sub.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : sub.status === 'TRIAL'
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : sub.status === 'GRACE'
                            ? 'bg-rose-50 text-rose-800 border border-rose-200'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {sub.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      ₹{sub.price} / {sub.billingInterval}
                    </td>
                    <td className="py-3 px-4 text-slate-500 font-mono">
                      {new Date(sub.currentPeriodEnd).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[10px] font-mono text-slate-600">
                        {sub.paymentStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: INVOICES & TAX LEDGER */}
      {activeSubTab === 'invoices' && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search invoices by customer or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-hidden focus:border-teal-500"
              />
            </div>
            <span className="text-[11px] text-slate-400">
              Tax-compliant ledger ({filteredInvoices.length} invoices)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-white text-slate-400 font-semibold uppercase text-[10px] border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">Invoice ID</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Plan Description</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Billing Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInvoices.map((inv) => (
                  <tr key={inv.invoiceId} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{inv.invoiceId}</td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{inv.customerName}</td>
                    <td className="py-3 px-4 text-slate-600">{inv.planName}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">₹{inv.amount}</td>
                    <td className="py-3 px-4 text-slate-500 font-mono">
                      {new Date(inv.issuedAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          inv.paymentStatus === 'PAID'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {inv.paymentStatus}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setSelectedInvoice(inv)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-teal-700 transition"
                        title="View Official Receipt"
                      >
                        <FileText className="w-4 h-4 inline" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Grant Complimentary Modal */}
      {isComplimentaryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 relative animate-in fade-in">
            <button
              onClick={() => setIsComplimentaryModalOpen(false)}
              className="absolute top-6 right-6 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-slate-900 mb-1">
              Grant VIP Complimentary Subscription
            </h3>
            <p className="text-xs text-slate-500 mb-6">
              Platform Admin bypass: Provision complimentary pro or enterprise access with automatic expiration fallback.
            </p>

            {compSuccess ? (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
                {compSuccess}
              </div>
            ) : (
              <form onSubmit={handleGrantComplimentarySubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Target Customer Type</label>
                  <select
                    value={compTargetType}
                    onChange={(e) => setCompTargetType(e.target.value as CustomerType)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  >
                    <option value="company">Company Organization</option>
                    <option value="individual">Individual Professional</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Customer Identifier (ID)</label>
                  <input
                    type="text"
                    required
                    placeholder={compTargetType === 'company' ? 'company_acme' : 'emp_acme_rahul'}
                    value={compTargetId}
                    onChange={(e) => setCompTargetId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Plan to Provision</label>
                  <select
                    value={compPlanId}
                    onChange={(e) => setCompPlanId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  >
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.targetType}) — ₹{p.price}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Grant Duration (Days)</label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={compDurationDays}
                    onChange={(e) => setCompDurationDays(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Reason for Audit Log</label>
                  <input
                    type="text"
                    value={compReason}
                    onChange={(e) => setCompReason(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  />
                </div>

                <div className="pt-4 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setIsComplimentaryModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-teal-600 text-white font-bold hover:bg-teal-500"
                  >
                    Confirm Grant
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Invoice Receipt Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 relative animate-in fade-in">
            <button
              onClick={() => setSelectedInvoice(null)}
              className="absolute top-6 right-6 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 mb-6 pb-6 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-teal-600 text-white font-bold flex items-center justify-center">
                DS
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">DSBC SaaS Platform</h3>
                <p className="text-xs text-slate-400">Official GST Tax Invoice / Receipt</p>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Invoice Number:</span>
                <span className="font-mono font-bold text-slate-900">{selectedInvoice.invoiceId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Customer:</span>
                <span className="font-bold text-slate-900">{selectedInvoice.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Date of Issue:</span>
                <span className="text-slate-800 font-mono">{new Date(selectedInvoice.issuedAt).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Payment Reference:</span>
                <span className="font-mono text-slate-700">{selectedInvoice.paymentReference || 'N/A'}</span>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                  Line Items
                </span>
                {selectedInvoice.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between py-1">
                    <span className="text-slate-800">{item.description}</span>
                    <span className="font-bold text-slate-900">₹{item.amount}</span>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-between text-sm font-bold text-slate-900">
                <span>Total Amount Paid:</span>
                <span className="text-teal-700">₹{selectedInvoice.amount}</span>
              </div>
            </div>

            <div className="mt-8 flex justify-end space-x-3">
              <button
                onClick={() => setSelectedInvoice(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200"
              >
                Close
              </button>
              <button
                onClick={() => {
                  window.print();
                }}
                className="px-4 py-2 rounded-xl bg-teal-600 text-white text-xs font-bold hover:bg-teal-500 flex items-center space-x-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Print / Download</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
