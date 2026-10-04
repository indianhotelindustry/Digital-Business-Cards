// ============================================================================
// DSBC LINK GOOGLE BANNER (Directive 34 migration)
// ============================================================================
// Shown to a signed-in account that has no Google sign-in yet. Linking is
// user-mediated and keeps the SAME Firebase UID; a Google identity already used
// by a different DSBC sign-in is reported, never merged.

import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { describeGoogleError, hasGoogleProvider, linkGoogleToCurrentUser } from '../../services/googleAuthService';

export const LinkGoogleBanner: React.FC = () => {
  const { currentUser } = useAuth();
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);
  if (!currentUser || hasGoogleProvider(currentUser) || state === 'done') return null;
  const link = async () => {
    setState('busy');
    setError(null);
    try {
      await linkGoogleToCurrentUser();
      setState('done');
    } catch (err) {
      const e = describeGoogleError(err);
      setState('idle');
      if (!e.cancelled) setError(e.message);
    }
  };
  return (
    <div role="region" aria-label="Link Google" data-testid="link-google-banner" className="mx-4 mt-3 p-3 rounded-xl border border-teal-200 bg-teal-50 text-sm flex flex-wrap items-center gap-3">
      <span className="flex-1 min-w-[200px]">DSBC is moving to Google sign-in. Link the Google account you will use, so you keep this same account and data.</span>
      <button onClick={link} disabled={state === 'busy'} className="min-h-[44px] px-4 rounded-xl bg-slate-900 text-white font-semibold">Link Google</button>
      {error && <span role="alert" className="w-full text-rose-700">{error}</span>}
    </div>
  );
};
