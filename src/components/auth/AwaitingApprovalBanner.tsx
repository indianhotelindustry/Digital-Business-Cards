// ============================================================================
// DSBC AWAITING APPROVAL (Directive 30)
// ============================================================================
// Shown in place of the workspace while a signed-in customer's account is
// pending App Owner approval. It links to no feature; the only actions are
// re-checking the status and signing out. The decision lives in
// src/lib/accountGate.ts; the backend refuses every customer request until the
// account is active regardless of what this screen shows.

import React, { useState } from 'react';
import { Hourglass, LogOut, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { shouldShowAwaitingApproval } from '../../lib/accountGate';

interface AwaitingApprovalBannerProps {
  status: string | null;
  emailVerified: boolean;
}

export const AwaitingApprovalBanner: React.FC<AwaitingApprovalBannerProps> = ({ status, emailVerified }) => {
  const { currentUser, logoutUser, refreshAccountStatus } = useAuth();
  const [checking, setChecking] = useState(false);

  if (!shouldShowAwaitingApproval(status, emailVerified)) return null;

  const email = currentUser?.email ?? 'your email address';

  const check = async () => {
    setChecking(true);
    await refreshAccountStatus();
    setChecking(false);
  };

  return (
    <div role="region" aria-label="Account approval" className="max-w-md mx-auto my-12 p-6 bg-white border border-amber-200 rounded-3xl text-center shadow-sm">
      <Hourglass className="w-12 h-12 text-amber-500 mx-auto mb-3" />
      <h3 className="text-base font-bold text-slate-900">Awaiting approval</h3>
      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
        Your account is awaiting approval by the DSBC team.
        {!emailVerified && ` Please also verify the email address we sent a link to (${email}).`} We will activate it
        as soon as it has been reviewed; until then your workspace stays closed.
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={check}
          disabled={checking}
          className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition flex items-center gap-1.5 disabled:opacity-60"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
          {checking ? 'Checking…' : 'Check again'}
        </button>
        <button
          type="button"
          onClick={() => logoutUser()}
          className="px-4 py-2 rounded-xl border border-slate-300 bg-white text-slate-800 text-xs font-semibold hover:bg-slate-50 transition flex items-center gap-1.5"
        >
          <LogOut className="w-3.5 h-3.5" /> Sign out
        </button>
      </div>
    </div>
  );
};
