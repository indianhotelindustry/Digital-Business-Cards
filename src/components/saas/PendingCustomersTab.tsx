import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, MailCheck, MailWarning, RefreshCw, UserCheck } from 'lucide-react';
import { adminListPendingCustomers, approveCustomer, type PendingCustomer } from '../../services/accountService';
import { describeBackendError, runBackendAction } from '../../lib/backend';
import { approvalTargetFor, canSubmitApproval } from '../../lib/pendingApproval';

/**
 * App Owner queue of self-registered customers awaiting activation.
 * Rows are the backend's real registration data; approval needs a reason and
 * is enforced again by the approveCustomer callable.
 */
export const PendingCustomersTab: React.FC = () => {
  const [pending, setPending] = useState<PendingCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busyUid, setBusyUid] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await adminListPendingCustomers();
      setPending(res.pending);
    } catch (err) {
      console.error('Failed to load pending customers:', err);
      setLoadError(describeBackendError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleApprove = async (row: PendingCustomer) => {
    const reason = reasons[row.uid] ?? '';
    if (!canSubmitApproval(reason)) return;
    setBusyUid(row.uid);
    const ok = await runBackendAction(() => approveCustomer({ ...approvalTargetFor(row), reason: reason.trim() }));
    setBusyUid(null);
    if (ok) {
      setReasons((prev) => {
        const next = { ...prev };
        delete next[row.uid];
        return next;
      });
      await load();
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Pending Customers</h2>
          <p className="text-xs text-slate-500">
            Self-registered accounts awaiting App Owner approval. Approval only activates the account and requires the
            customer email to be verified.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold transition"
          title="Refresh pending customers"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex items-center space-x-2">
          <UserCheck className="w-4 h-4 text-teal-600" />
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Awaiting Approval ({pending.length})
          </h3>
        </div>

        {loadError ? (
          <div className="p-8 text-center text-xs text-rose-700">{loadError}</div>
        ) : loading && pending.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading pending customers...</div>
        ) : pending.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">No customers are awaiting approval.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-white text-slate-400 font-semibold uppercase text-[10px] border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Account Type</th>
                  <th className="py-3 px-4">Company</th>
                  <th className="py-3 px-4">Registered</th>
                  <th className="py-3 px-4">Email Verified</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Approve</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pending.map((row) => {
                  const reason = reasons[row.uid] ?? '';
                  const busy = busyUid === row.uid;
                  return (
                    <tr key={row.uid} className="hover:bg-slate-50/70 transition align-top">
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900 block">{row.displayName || '(no name)'}</span>
                        <span className="text-slate-600 block">{row.email}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{row.uid}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-700 capitalize">{row.accountType}</td>
                      <td className="py-3 px-4 text-slate-700">{row.companyName || '-'}</td>
                      <td className="py-3 px-4 text-slate-600">
                        {row.createdAt ? new Date(row.createdAt).toLocaleString() : '-'}
                      </td>
                      <td className="py-3 px-4">
                        {row.emailVerified ? (
                          <span className="inline-flex items-center text-[11px] font-bold text-emerald-700">
                            <MailCheck className="w-3.5 h-3.5 mr-1" /> Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-[11px] font-bold text-amber-700">
                            <MailWarning className="w-3.5 h-3.5 mr-1" /> Not verified
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          {row.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          <input
                            type="text"
                            value={reason}
                            onChange={(e) => setReasons((prev) => ({ ...prev, [row.uid]: e.target.value }))}
                            placeholder="Reason (required)"
                            aria-label={`Approval reason for ${row.displayName || row.email}`}
                            className="w-44 px-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500"
                          />
                          <button
                            type="button"
                            onClick={() => handleApprove(row)}
                            disabled={!canSubmitApproval(reason) || busy}
                            className="inline-flex items-center px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                            {busy ? 'Approving...' : 'Approve'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
