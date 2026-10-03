// ============================================================================
// DSBC EMAIL VERIFICATION BANNER (Directive 29)
// ============================================================================
// Shown to every signed-in Firebase account whose email is not verified yet.
// The workspace keeps working; what an unverified address can never get is
// platform administration (App Owner), which additionally needs a claim set
// on the server. Checking or resending here never grants anything.

import React, { useEffect, useState } from 'react';
import { MailCheck, MailWarning, RefreshCw, Send, LogIn, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { RESEND_COOLDOWN_MS } from '../../services/emailVerification';

type Notice = { tone: 'info' | 'error' | 'success'; text: string };

export const EmailVerificationBanner: React.FC = () => {
  const { currentUser, emailVerified, refreshEmailVerification, resendVerificationEmail, logoutUser } = useAuth();
  const [busy, setBusy] = useState<'check' | 'resend' | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [justVerified, setJustVerified] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  // A different account starts with a clean banner.
  const uid = currentUser?.uid ?? null;
  useEffect(() => {
    setNotice(null);
    setSessionExpired(false);
    setJustVerified(false);
    setCooldownUntil(0);
  }, [uid]);

  useEffect(() => {
    if (cooldownUntil <= now) return;
    const t = setTimeout(() => setNow(Date.now()), 1000);
    return () => clearTimeout(t);
  }, [cooldownUntil, now]);

  if (!currentUser) return null;
  if (emailVerified && !justVerified) return null;

  const email = currentUser.email ?? 'your email address';
  const cooldownSeconds = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));

  const check = async () => {
    setBusy('check');
    const r = await refreshEmailVerification();
    setBusy(null);
    if ('error' in r) {
      setSessionExpired(r.error.kind === 'SESSION_EXPIRED');
      setNotice({ tone: 'error', text: r.error.message });
    } else if (r.emailVerified) {
      setJustVerified(true);
      setNotice({ tone: 'success', text: 'Email verified. Thank you.' });
    } else {
      setNotice({ tone: 'info', text: `Not verified yet. Open the link in the email we sent to ${email} (check your spam folder), then try again.` });
    }
  };

  const resend = async () => {
    setBusy('resend');
    const r = await resendVerificationEmail();
    setBusy(null);
    if ('error' in r) {
      setSessionExpired(r.error.kind === 'SESSION_EXPIRED');
      setNotice({ tone: 'error', text: r.error.message });
      if (r.error.kind === 'TOO_MANY_REQUESTS') setCooldownUntil(Date.now() + RESEND_COOLDOWN_MS);
    } else if (r.alreadyVerified) {
      setJustVerified(true);
      setNotice({ tone: 'success', text: 'This email address is already verified.' });
    } else {
      setCooldownUntil(Date.now() + RESEND_COOLDOWN_MS);
      setNow(Date.now());
      setNotice({ tone: 'info', text: `A new verification link was sent to ${email}.` });
    }
  };

  if (justVerified) {
    return (
      <div role="region" aria-label="Email verification" className="bg-emerald-50 border-b border-emerald-200 px-4 py-2.5 text-emerald-900 text-xs flex items-center gap-2">
        <MailCheck className="w-4 h-4 shrink-0" />
        <span role="status" className="flex-1 font-semibold">{notice?.text ?? 'Email verified.'}</span>
        <button type="button" onClick={() => setJustVerified(false)} aria-label="Dismiss" className="p-1 rounded hover:bg-emerald-100">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  const toneClass = notice?.tone === 'error' ? 'text-rose-700' : 'text-amber-900';

  return (
    <div role="region" aria-label="Email verification" className="bg-amber-50 border-b border-amber-200 px-4 py-3 text-amber-950 text-xs">
      <div className="max-w-7xl flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <MailWarning className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="font-bold">Verify your email address</p>
            <p className="break-words">
              We sent a verification link to <span className="font-semibold">{email}</span>. Open it, then choose
              “I've verified my email”. Your workspace works as usual; an unverified address can never be granted
              platform administration (App Owner) rights.
            </p>
            {notice && (
              <p role="status" className={`mt-1 font-semibold ${toneClass}`}>
                {notice.text}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          {sessionExpired ? (
            <button
              type="button"
              onClick={() => logoutUser()}
              className="px-3 py-1.5 rounded-lg bg-amber-900 text-white font-bold flex items-center gap-1.5 hover:bg-amber-950"
            >
              <LogIn className="w-3.5 h-3.5" /> Sign in again
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={check}
                disabled={busy !== null}
                className="px-3 py-1.5 rounded-lg bg-amber-900 text-white font-bold flex items-center gap-1.5 hover:bg-amber-950 disabled:opacity-60"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${busy === 'check' ? 'animate-spin' : ''}`} />
                {busy === 'check' ? 'Checking…' : "I've verified my email"}
              </button>
              <button
                type="button"
                onClick={resend}
                disabled={busy !== null || cooldownSeconds > 0}
                className="px-3 py-1.5 rounded-lg border border-amber-400 bg-white text-amber-900 font-bold flex items-center gap-1.5 hover:bg-amber-100 disabled:opacity-60"
              >
                <Send className="w-3.5 h-3.5" />
                {busy === 'resend' ? 'Sending…' : cooldownSeconds > 0 ? `Resend in ${cooldownSeconds}s` : 'Resend email'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
