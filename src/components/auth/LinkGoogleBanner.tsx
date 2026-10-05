// ============================================================================
// DSBC LINK GOOGLE BANNER (Directive 34 migration; Directive 45 explicit states)
// ============================================================================
// Shown to a signed-in account that has no Google sign-in yet. Linking is
// user-mediated and keeps the SAME Firebase UID; a Google identity already used
// by a different DSBC sign-in is reported, never merged.
//
// D45: this banner used to unmount on success and stay silent on cancellation,
// so a real customer reported a link as done while Firebase still had `password`
// only. Every outcome now renders an explicit, named state. Success is shown ONLY
// after linkGoogleToCurrentUser() resolves — never because a popup opened, a
// redirect started, or the control disappeared. All copy lives in linkGoogleState.

import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { hasGoogleProvider, linkGoogleToCurrentUser } from '../../services/googleAuthService';
import { linkFailureFromCode, linkGoogleView, type LinkGoogleStateValue } from './linkGoogleState';

const TONE: Record<string, string> = {
  prompt: 'border-teal-200 bg-teal-50',
  success: 'border-emerald-300 bg-emerald-50',
  error: 'border-rose-300 bg-rose-50',
};

export const LinkGoogleBanner: React.FC = () => {
  const { currentUser } = useAuth();
  const [state, setState] = useState<LinkGoogleStateValue>({ kind: 'ready' });

  if (!currentUser) return null;
  // Untouched and already linked: show nothing at all. That is not misleading —
  // no "Link Google" action is offered — and it avoids a permanent banner for
  // every Google user. An already-linked result reached DURING this session is
  // still reported explicitly below (state.kind === 'already_linked').
  if (state.kind === 'ready' && hasGoogleProvider(currentUser)) return null;

  const view = linkGoogleView(state);

  const link = async () => {
    setState({ kind: 'linking' });
    try {
      const { outcome, email } = await linkGoogleToCurrentUser();
      setState({ kind: outcome, email });
    } catch (err) {
      const code = (err as { code?: string })?.code || 'unknown';
      const reason = linkFailureFromCode(code);
      // provider-already-linked is the desired end state, not a failure.
      setState(reason === 'already_linked' ? { kind: 'already_linked', email: null } : { kind: 'failed', reason });
    }
  };

  return (
    <div
      role="region"
      aria-label="Link Google"
      data-testid="link-google-banner"
      data-state={state.kind}
      className={`mx-4 mt-3 p-3 rounded-xl border text-sm flex flex-wrap items-center gap-3 ${TONE[view.tone]}`}
    >
      <span className="flex-1 min-w-[200px]">
        <span data-testid="link-google-message" role={view.tone === 'error' ? 'alert' : undefined} aria-live="polite">
          {view.message}
        </span>
        {view.detail && <span className="block mt-1 text-slate-600">{view.detail}</span>}
      </span>
      {view.actionLabel && (
        <button
          onClick={link}
          disabled={view.busy}
          className="min-h-[44px] px-4 rounded-xl bg-slate-900 text-white font-semibold disabled:opacity-60"
        >
          {view.busy ? 'Linking…' : view.actionLabel}
        </button>
      )}
    </div>
  );
};
