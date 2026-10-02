import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useEntitlement } from '../../context/EntitlementContext';
import { useSubscription } from '../../context/SubscriptionContext';
import { FEATURE_CATALOGUE } from '../../services/entitlementService';
import {
  CreditCard,
  Sparkles,
  CheckCircle2,
  Lock,
  ArrowRight,
  Receipt,
  Download,
  Calendar,
  AlertTriangle,
  Clock,
  Layers,
  Shield,
  X,
  FileText,
  UserCheck,
} from 'lucide-react';
import { Invoice } from '../../types/subscription';

export const CustomerPlanView: React.FC = () => {
  const { role, activeCompany, userProfile } = useAuth();
  const { plans, effectiveEntitlements, openUpgradeModal, checkLimit, getUsage } = useEntitlement();
  const {
    currentSubscription,
    customerInvoices,
    upgradeToPlan,
    downgradeToPlan,
    cancelSubscription,
    isLoading,
  } = useSubscription();

  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const isCompanyContext = role === 'company_admin';
  const currentPlan = plans.find((p) => p.id === currentSubscription?.planId);

  // Quota metrics for customer
  const seatUsage = getUsage('company.team_members');
  const storageUsage = getUsage('company.storage');
  const aiUsage = getUsage('individual.ai_assistance');

  const handleCancel = async () => {
    if (confirm('Are you sure you want to schedule cancellation at the end of the current billing period? Your data will remain preserved.')) {
      const ok = await cancelSubscription(true);
      if (!ok) setActionNotice('Cancellation was not accepted by the server.');
      if (ok) {
        setActionSuccess('Subscription will cancel at the end of your billing cycle. Content remains preserved.');
        setTimeout(() => setActionSuccess(null), 4000);
      }
    }
  };

  const handleDirectUpgrade = async (planId: string) => {
    setActionNotice(null);
    const res = await upgradeToPlan(planId);
    if (!res.success) setActionNotice(res.message || 'Your plan was not changed.');
    if (res.success) {
      setActionSuccess('Successfully upgraded plan! Your new features and higher quotas are available now.');
      setIsManageModalOpen(false);
      setTimeout(() => setActionSuccess(null), 4000);
    }
  };

  const relevantPlans = plans.filter((p) =>
    isCompanyContext ? p.targetType === 'company' : p.targetType === 'individual'
  );

  return (
    <div className="space-y-6 animate-in fade-in max-w-6xl mx-auto">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200/80 mb-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Commercial Subscription Account Center</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            My Plan & Subscription
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage your customer tier, inspect live quota usage, and download official tax receipts.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsManageModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition shadow-xs flex items-center space-x-2"
          >
            <CreditCard className="w-4 h-4" />
            <span>Manage Subscription</span>
          </button>
        </div>
      </div>

      {actionNotice && (
        <div className="mb-4 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium">
          {actionNotice}
        </div>
      )}
      {actionSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Top Cards: Plan Summary & Quotas */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* Card 1: Current Plan Details */}
        <div className="md:col-span-2 bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/5 rounded-full blur-2xl pointer-events-none" />

          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                {isCompanyContext ? 'Company Organization Plan' : 'Individual Professional Tier'}
              </span>

              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  currentSubscription?.status === 'ACTIVE'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : currentSubscription?.status === 'TRIAL'
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : currentSubscription?.status === 'GRACE'
                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                {currentSubscription?.status === 'ACTIVE' && (
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                )}
                {currentSubscription?.status === 'TRIAL' && (
                  <Clock className="w-3.5 h-3.5 mr-1 text-amber-600" />
                )}
                {currentSubscription?.status === 'GRACE' && (
                  <AlertTriangle className="w-3.5 h-3.5 mr-1 text-rose-600" />
                )}
                {currentSubscription?.status}
              </span>
            </div>

            <div className="flex items-baseline space-x-3 mb-2">
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {currentPlan?.name || 'Active Plan'}
              </h2>
              <div className="text-slate-600 font-bold text-lg">
                {currentSubscription?.price === 0
                  ? '₹0 / Free'
                  : `₹${currentSubscription?.price} / ${currentSubscription?.billingInterval}`}
              </div>
            </div>

            <p className="text-xs text-slate-500 mb-6 max-w-lg leading-relaxed">
              {currentPlan?.description ||
                'Full access to DSBC smart identities, contact exchanges, and verified public profiles.'}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-medium">
                  Current Period End
                </span>
                <span className="font-semibold text-slate-800 flex items-center mt-0.5">
                  <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400" />
                  {currentSubscription?.currentPeriodEnd
                    ? new Date(currentSubscription.currentPeriodEnd).toLocaleDateString()
                    : 'Active'}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-medium">
                  Payment Status
                </span>
                <span className="font-semibold text-slate-800 flex items-center mt-0.5">
                  <CreditCard className="w-3.5 h-3.5 mr-1 text-slate-400" />
                  {currentSubscription?.paymentStatus}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-medium">
                  Gateway Provider
                </span>
                <span className="font-semibold text-slate-800 uppercase mt-0.5 block">
                  {currentSubscription?.provider}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-slate-500">
              {currentSubscription?.cancelAtPeriodEnd
                ? 'Cancellation scheduled at period end.'
                : 'Auto-renews at next billing date.'}
            </span>

            {currentSubscription?.price === 0 ? (
              <button
                onClick={() => openUpgradeModal()}
                className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs transition shadow-xs flex items-center space-x-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Upgrade to Pro Plan</span>
              </button>
            ) : (
              <button
                onClick={handleCancel}
                className="text-xs text-rose-600 hover:text-rose-700 font-semibold hover:underline"
              >
                Cancel Subscription
              </button>
            )}
          </div>
        </div>

        {/* Card 2: Live Quotas Meter */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-2 text-slate-800 font-bold text-sm mb-4">
              <Layers className="w-4 h-4 text-teal-600" />
              <span>Live Usage & Quotas</span>
            </div>

            <div className="space-y-4">
              {/* Seats Meter (Company only) */}
              {isCompanyContext && (
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-600 font-medium">Team Seats</span>
                    <span className="font-bold text-slate-900">
                      {seatUsage.current} / {seatUsage.limit ?? '∞'} seats
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        seatUsage.limit && seatUsage.current >= seatUsage.limit
                          ? 'bg-rose-500'
                          : 'bg-teal-600'
                      }`}
                      style={{
                        width: `${Math.min(
                          100,
                          seatUsage.limit ? (seatUsage.current / seatUsage.limit) * 100 : 10
                        )}%`,
                      }}
                    />
                  </div>
                  {seatUsage.limit && seatUsage.current >= seatUsage.limit && (
                    <p className="text-[10px] text-rose-500 mt-1 font-medium">
                      Seat limit reached. Upgrade for more team members.
                    </p>
                  )}
                </div>
              )}

              {/* Storage Meter */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-600 font-medium">Media Storage</span>
                  <span className="font-bold text-slate-900">
                    {storageUsage.current} / {storageUsage.limit ?? 500} MB
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-teal-600"
                    style={{
                      width: `${Math.min(
                        100,
                        ((storageUsage.current || 50) / (storageUsage.limit || 500)) * 100
                      )}%`,
                    }}
                  />
                </div>
              </div>

              {/* AI Assistance */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-600 font-medium">AI Interactions</span>
                  <span className="font-bold text-slate-900">
                    {effectiveEntitlements['individual.ai_assistance']?.isGranted
                      ? 'Active & Included'
                      : 'Locked (Pro)'}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      effectiveEntitlements['individual.ai_assistance']?.isGranted
                        ? 'bg-teal-600 w-full'
                        : 'bg-slate-200 w-0'
                    }`}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <span className="text-[11px] text-slate-400 block">
              Strictly enforced via Entitlement Resolver.
            </span>
          </div>
        </div>
      </div>

      {/* Feature Entitlements Breakdown */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="p-5 bg-slate-50/80 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Included & Available Capabilities
            </h3>
            <p className="text-xs text-slate-500">
              Live resolution of features for your account tier.
            </p>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            {Object.values(effectiveEntitlements).filter((e) => e.isGranted).length} Features Granted
          </span>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 divide-y sm:divide-y-0 sm:gap-px sm:bg-slate-200/60 p-px">
          {FEATURE_CATALOGUE.filter(
            (f) => isCompanyContext ? f.scope !== 'individual' : f.scope !== 'company'
          ).map((feat) => {
            const eff = effectiveEntitlements[feat.id];
            const isGranted = eff?.isGranted;

            return (
              <div key={feat.id} className="p-4 bg-white flex items-start justify-between">
                <div className="space-y-1 pr-3">
                  <div className="flex items-center space-x-1.5">
                    {isGranted ? (
                      <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                    ) : (
                      <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                    <span className={`text-xs font-bold ${isGranted ? 'text-slate-900' : 'text-slate-500'}`}>
                      {feat.name}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-tight">
                    {feat.description}
                  </p>
                </div>

                {!isGranted && (
                  <button
                    onClick={() => openUpgradeModal(feat.id)}
                    className="shrink-0 text-[10px] font-bold text-teal-700 hover:text-teal-800 bg-teal-50 px-2 py-1 rounded-md border border-teal-200/80"
                  >
                    Unlock →
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Invoice & Billing History Table */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="p-5 bg-slate-50/80 border-b border-slate-200/80 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Receipt className="w-4 h-4 text-teal-600" />
            <h3 className="text-sm font-bold text-slate-900">
              Tax Invoices & Billing Ledger
            </h3>
          </div>
          <span className="text-[11px] text-slate-400">
            {customerInvoices.length} Invoices on Record
          </span>
        </div>

        {customerInvoices.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No invoice records yet for this account.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-white text-slate-400 font-semibold uppercase text-[10px] border-b border-slate-100">
                <tr>
                  <th className="py-3 px-5">Invoice #</th>
                  <th className="py-3 px-5">Plan Description</th>
                  <th className="py-3 px-5">Amount</th>
                  <th className="py-3 px-5">Issue Date</th>
                  <th className="py-3 px-5">Payment Status</th>
                  <th className="py-3 px-5 text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customerInvoices.map((inv) => (
                  <tr key={inv.invoiceId} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-5 font-mono font-bold text-slate-900">
                      {inv.invoiceId}
                    </td>
                    <td className="py-3 px-5 text-slate-700 font-medium">
                      {inv.planName}
                    </td>
                    <td className="py-3 px-5 font-bold text-slate-900">
                      ₹{inv.amount}
                    </td>
                    <td className="py-3 px-5 text-slate-500 font-mono">
                      {new Date(inv.issuedAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          inv.paymentStatus === 'PAID'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : inv.paymentStatus === 'COMPLIMENTARY'
                            ? 'bg-slate-100 text-slate-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {inv.paymentStatus}
                      </span>
                    </td>
                    <td className="py-3 px-5 text-right">
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
        )}
      </div>

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

      {/* Manage Subscription & Upgrade Modal */}
      {isManageModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 relative animate-in fade-in max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsManageModalOpen(false)}
              className="absolute top-6 right-6 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-slate-900 mb-1">
              Manage Your Subscription Tier
            </h3>
            <p className="text-xs text-slate-500 mb-6">
              Switch plans with zero data loss. Previously created content remains 100% preserved.
            </p>

            <div className="space-y-4">
              {relevantPlans.map((plan) => {
                const isCurrent = currentSubscription?.planId === plan.id;
                return (
                  <div
                    key={plan.id}
                    className={`p-4 rounded-2xl border transition flex items-center justify-between ${
                      isCurrent
                        ? 'border-teal-500 bg-teal-50/30'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-900 text-sm">{plan.name}</span>
                        {isCurrent && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800">
                            Current Plan
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{plan.description}</p>
                      <span className="text-xs font-bold text-slate-700 mt-1 block">
                        ₹{plan.price} / {plan.billingCycle}
                      </span>
                    </div>

                    {!isCurrent && (
                      <button
                        onClick={() => handleDirectUpgrade(plan.id)}
                        disabled={isLoading}
                        className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition shrink-0 ml-4"
                      >
                        Switch to {plan.name}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
