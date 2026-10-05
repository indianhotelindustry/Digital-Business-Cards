// ============================================================================
// DSBC sign-in screen (Directive 34 Phase 1)
// ============================================================================
// One full-screen entry for every way into DSBC: four Google entry points, the
// two DISTINCT registration workflows ("Create Free Card" -> registerIndividual,
// "Register as Company" -> registerCompany) and the legacy email login link.
//
// The chosen intent is only a UI hint. Where a signed-in identity goes is
// decided by the backend (resolveSession) from server records; this screen
// renders that destination and never invents an account, persona or card.
import React, { useEffect, useRef, useState } from 'react';
import { Building2, Users, X, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { auth } from '../../lib/firebase';
import { signInErrorCopy } from './signInErrorCopy';
import { describeGoogleError, signInWithGoogle } from '../../services/googleAuthService';
import { sessionService } from '../../services/sessionService';
import { conversionFunnelService } from '../../services/conversionFunnelService';
import { MAX_NAME_LENGTH } from '../../../shared/domain/registrationModel';
import type { Destination, SessionIntent } from '../../../shared/domain/sessionRouting';

export interface SignInScreenProps {
  /** Entry point chosen before the screen opened (marketing button or a Google redirect). UI hint only. */
  initialIntent?: SessionIntent | null;
  /** The identity is already signed in (no DSBC account yet, or back from a Google redirect): resolve its destination on open. */
  postSignIn?: boolean;
  onClose(): void;
  onEnterWorkspace(): void;
  onOpenLegacyLogin(): void;
}

type Phase =
  | { kind: 'choose' }
  | { kind: 'resolving' }
  | { kind: 'entering' }
  | { kind: 'register_company' }
  | { kind: 'register_individual' }
  | { kind: 'already_registered'; existing: 'company' | 'individual' | 'employee' }
  | { kind: 'not_company_admin' }
  | { kind: 'no_account' }
  | { kind: 'account_inactive'; status: string };

const EXISTING_LABEL: Record<'company' | 'individual' | 'employee', string> = {
  company: 'company workspace',
  individual: 'free card account',
  employee: 'company membership',
};

function inactiveCopy(status: string): string {
  switch (status) {
    case 'suspended':
      return 'This account is suspended. Contact DSBC support.';
    case 'cancelled':
      return 'This account has been cancelled.';
    case 'expired':
      return 'This account has expired.';
    default:
      return 'Your account is not active yet.';
  }
}

const GoogleMark: React.FC = () => (
  <svg aria-hidden="true" viewBox="0 0 48 48" className="w-5 h-5 shrink-0">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
);

const GoogleButton: React.FC<{ intent: SessionIntent; disabled: boolean; describedBy: string; onClick(intent: SessionIntent): void }> = ({
  intent,
  disabled,
  describedBy,
  onClick,
}) => (
  <button
    type="button"
    data-testid={`google-${intent}`}
    aria-describedby={describedBy}
    disabled={disabled}
    onClick={() => onClick(intent)}
    className="w-full min-h-[48px] px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-800 text-sm font-semibold flex items-center justify-center gap-3 shadow-xs transition disabled:opacity-50 disabled:cursor-not-allowed"
  >
    <GoogleMark />
    <span>Continue with Google</span>
  </button>
);

const primaryBtn =
  'w-full min-h-[44px] px-4 rounded-xl bg-teal-800 hover:bg-teal-900 active:bg-teal-950 text-white text-sm font-bold transition disabled:opacity-50 disabled:cursor-not-allowed';
const secondaryBtn =
  'w-full min-h-[44px] px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed';
const inputCls =
  'w-full min-h-[44px] px-3 rounded-xl border border-slate-300 bg-white text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-600';

export const SignInScreen: React.FC<SignInScreenProps> = ({ initialIntent = null, postSignIn = false, onClose, onEnterWorkspace, onOpenLegacyLogin }) => {
  const { currentUser, refreshUserData, refreshAccountStatus, logoutUser, redirectError, clearRedirectError } = useAuth();
  const [phase, setPhase] = useState<Phase>(postSignIn ? { kind: 'resolving' } : { kind: 'choose' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [companyName, setCompanyName] = useState('');

  // Only the latest resolve may change the screen; once the person acts,
  // the automatic post-sign-in resolve no longer runs.
  const seq = useRef(0);
  const interacted = useRef(false);
  const autoResolved = useRef<SessionIntent | 'none' | null>(null);

  const prefillName = (fromBackend: string | null) => {
    setDisplayName((current) => current || fromBackend || auth.currentUser?.displayName || '');
  };

  const enterWorkspace = async () => {
    setPhase({ kind: 'entering' });
    await refreshUserData();
    await refreshAccountStatus();
    onEnterWorkspace();
  };

  const applyDestination = async (destination: Destination, nameHint: string | null) => {
    switch (destination.kind) {
      case 'app_owner_workspace':
      case 'company_workspace':
      case 'employee_workspace':
      case 'individual_workspace':
        await enterWorkspace();
        return;
      case 'register_company':
      case 'register_individual':
        prefillName(nameHint);
        setPhase({ kind: destination.kind });
        return;
      case 'already_registered':
        setPhase({ kind: 'already_registered', existing: destination.existing });
        return;
      case 'account_inactive':
        setPhase({ kind: 'account_inactive', status: destination.status });
        return;
      case 'not_company_admin':
      case 'no_account':
        setPhase({ kind: destination.kind });
        return;
    }
  };

  /** Ask the backend where this signed-in identity goes for the chosen entry point. */
  const resolveFor = async (intent: SessionIntent, fallback: Phase) => {
    const mine = ++seq.current;
    setError(null);
    setPhase({ kind: 'resolving' });
    try {
      const info = await sessionService.resolve(intent);
      if (mine !== seq.current) return;
      await applyDestination(info.destination, info.displayName);
    } catch (err) {
      if (mine !== seq.current) return;
      console.error('Session resolve failed:', err);
      setError(signInErrorCopy(err));
      setPhase(fallback);
    }
  };

  // A failed Google redirect sign-in is shown here (described copy only), once.
  useEffect(() => {
    if (!redirectError) return;
    setError(redirectError);
    clearRedirectError();
  }, [redirectError]);

  // A signed-in identity without a DSBC account (page reload, Google redirect)
  // lands here: resolve its destination. A redirect's intent can arrive after
  // the first render, so a later intent re-resolves while nothing was chosen.
  useEffect(() => {
    if (!postSignIn || interacted.current) return;
    if (autoResolved.current === null || (autoResolved.current === 'none' && initialIntent)) {
      autoResolved.current = initialIntent ?? 'none';
      void resolveFor(initialIntent ?? 'individual_login', { kind: 'no_account' });
    }
  }, [postSignIn, initialIntent]);

  const handleGoogle = async (intent: SessionIntent) => {
    interacted.current = true;
    setError(null);
    setBusy(true);
    try {
      const result = await signInWithGoogle(intent);
      if (result === 'redirecting') return; // the page navigates to Google; keep buttons disabled
      setBusy(false);
      await resolveFor(intent, { kind: 'choose' });
    } catch (err) {
      setBusy(false);
      const described = describeGoogleError(err);
      if (!described.cancelled) {
        console.error('Google sign-in failed:', described.code);
        setError(described.message);
      }
      setPhase({ kind: 'choose' });
    }
  };

  /** Switch entry point for the identity that is already signed in (no second Google prompt). */
  const handleSignedInIntent = (intent: SessionIntent, from: Phase) => {
    interacted.current = true;
    void resolveFor(intent, from);
  };

  const handleUseDifferentAccount = async () => {
    interacted.current = true;
    seq.current++;
    setBusy(true);
    setError(null);
    await logoutUser();
    setDisplayName('');
    setCompanyName('');
    setBusy(false);
    setPhase({ kind: 'choose' });
  };

  const handleRegisterCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    interacted.current = true;
    const name = displayName.trim();
    const company = companyName.trim();
    if (!company) return setError('Please enter your company name.');
    if (!name) return setError('Please enter your name.');
    setError(null);
    setBusy(true);
    try {
      const outcome = await sessionService.registerCompany({ displayName: name, companyName: company, planId: 'company_free' });
      if (outcome.created) conversionFunnelService.trackEvent('REGISTRATION_COMPLETED', 'company');
      setBusy(false);
      await applyDestination(outcome.destination, name);
    } catch (err) {
      console.error('Company registration failed:', err);
      setError(signInErrorCopy(err));
      setBusy(false);
    }
  };

  const handleRegisterIndividual = async (e: React.FormEvent) => {
    e.preventDefault();
    interacted.current = true;
    const name = displayName.trim();
    if (!name) return setError('Please enter your name.');
    setError(null);
    setBusy(true);
    try {
      const outcome = await sessionService.registerIndividual({ displayName: name });
      if (outcome.created) conversionFunnelService.trackEvent('REGISTRATION_COMPLETED', 'individual');
      setBusy(false);
      await applyDestination(outcome.destination, name);
    } catch (err) {
      console.error('Individual registration failed:', err);
      setError(signInErrorCopy(err));
      setBusy(false);
    }
  };

  const signedInEmail = currentUser?.email || null;
  const highlight = (intent: SessionIntent) => (initialIntent === intent ? 'ring-2 ring-teal-600 border-teal-600' : 'border-slate-200');

  const differentAccountButton = (
    <button type="button" onClick={handleUseDifferentAccount} disabled={busy} className={secondaryBtn}>
      Use a different Google account
    </button>
  );

  // Directive 34: an existing DSBC user whose Google address differs from their
  // account email lands here with no profile. Without this escape hatch the only
  // offers are "Create Free Card" / "Register as Company", either of which would
  // create a SECOND active account for the same person instead of taking them to
  // the one they already have. Same label as the choose phase, which
  // googleAuthService's account-exists copy tells users to look for.
  //
  // The copy deliberately does NOT promise that Google can then be linked:
  // reaching this screen via Google already created a Firebase user holding that
  // credential, so linking it to the real account fails with
  // auth/credential-already-in-use until an admin removes the orphan
  // (D34-AUTH-030). This route prevents a duplicate DSBC account; it does not
  // restore linking.
  const existingAccountButton = (
    <>
      <p className="text-sm text-slate-600">Already have a DSBC account? Sign in with your email to reach it.</p>
      <button type="button" onClick={onOpenLegacyLogin} className="text-xs text-slate-500 underline self-center min-h-[44px] px-2">
        Existing account? Sign in with email
      </button>
    </>
  );

  const renderPhase = () => {
    switch (phase.kind) {
      case 'choose':
        return (
          <>
            <h1 className="text-xl font-bold text-slate-900">Sign in to DSBC</h1>
            <p className="text-sm text-slate-600">Secure Google authentication &amp; multi-tenant workspace</p>

            <section className={`bg-white border rounded-2xl p-4 flex flex-col gap-3 ${highlight('company_login')}`}>
              <div className="flex items-start gap-3">
                <Building2 className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <h2 id="entry-company_login" className="text-sm font-bold text-slate-900">Login as Company</h2>
                  <p className="text-xs text-slate-600">For Company Owners &amp; Admins</p>
                </div>
              </div>
              <GoogleButton intent="company_login" disabled={busy} describedBy="entry-company_login" onClick={handleGoogle} />
            </section>

            <section className={`bg-white border rounded-2xl p-4 flex flex-col gap-3 ${highlight('individual_login')}`}>
              <div className="flex items-start gap-3">
                <Users className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <h2 id="entry-individual_login" className="text-sm font-bold text-slate-900">Join a Company / Login to Account</h2>
                  <p className="text-xs text-slate-600">For Employees &amp; Individuals</p>
                </div>
              </div>
              <GoogleButton intent="individual_login" disabled={busy} describedBy="entry-individual_login" onClick={handleGoogle} />
            </section>

            <div className="border-t border-slate-200 pt-4 flex flex-col gap-3">
              <p className="text-sm font-semibold text-slate-900">New to DSBC?</p>
              <section className={`bg-white border rounded-2xl p-4 flex flex-col gap-3 ${highlight('register_company')}`}>
                <h2 id="entry-register_company" className="text-sm font-bold text-slate-900">Register as Company</h2>
                <GoogleButton intent="register_company" disabled={busy} describedBy="entry-register_company" onClick={handleGoogle} />
              </section>
              <section className={`bg-white border rounded-2xl p-4 flex flex-col gap-3 ${highlight('create_free_card')}`}>
                <h2 id="entry-create_free_card" className="text-sm font-bold text-slate-900">Create Free Card</h2>
                <GoogleButton intent="create_free_card" disabled={busy} describedBy="entry-create_free_card" onClick={handleGoogle} />
              </section>
            </div>

            <button type="button" onClick={onOpenLegacyLogin} className="text-xs text-slate-500 underline self-center min-h-[44px] px-2">
              Existing account? Sign in with email
            </button>
          </>
        );

      case 'resolving':
      case 'entering':
        return (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 py-12" role="status" aria-live="polite">
            <Loader2 className="w-8 h-8 text-teal-700 animate-spin" aria-hidden="true" />
            <p className="text-sm text-slate-600">{phase.kind === 'entering' ? 'Opening your workspace…' : 'Checking your DSBC account…'}</p>
          </div>
        );

      case 'register_company':
        return (
          <form onSubmit={handleRegisterCompany} className="flex flex-col gap-4" noValidate>
            <h1 className="text-xl font-bold text-slate-900">Register your company</h1>
            <div className="flex flex-col gap-1">
              <label htmlFor="reg-company-name" className="text-sm font-semibold text-slate-800">Company name</label>
              <input
                id="reg-company-name"
                className={inputCls}
                required
                maxLength={MAX_NAME_LENGTH}
                autoComplete="organization"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="reg-company-owner" className="text-sm font-semibold text-slate-800">Your name</label>
              <input
                id="reg-company-owner"
                className={inputCls}
                required
                maxLength={MAX_NAME_LENGTH}
                autoComplete="name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-semibold text-slate-800 mb-1">Plan</legend>
              <label className="min-h-[44px] flex items-center gap-3 px-3 rounded-xl border border-teal-600 bg-teal-50 text-sm text-slate-900">
                <input type="radio" name="plan" value="company_free" checked readOnly className="w-5 h-5 accent-teal-700" />
                <span>Free — start now</span>
              </label>
              <label className="min-h-[44px] flex items-center gap-3 px-3 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-400">
                <input type="radio" name="plan" value="paid" disabled className="w-5 h-5" />
                <span>Paid plans — available soon</span>
              </label>
            </fieldset>
            <button type="submit" disabled={busy} className={primaryBtn}>
              {busy ? 'Creating…' : 'Create company workspace'}
            </button>
            {differentAccountButton}
          </form>
        );

      case 'register_individual':
        return (
          <form onSubmit={handleRegisterIndividual} className="flex flex-col gap-4" noValidate>
            <h1 className="text-xl font-bold text-slate-900">Create your free card account</h1>
            <div className="flex flex-col gap-1">
              <label htmlFor="reg-individual-name" className="text-sm font-semibold text-slate-800">Your name</label>
              <input
                id="reg-individual-name"
                className={inputCls}
                required
                maxLength={MAX_NAME_LENGTH}
                autoComplete="name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            <button type="submit" disabled={busy} className={primaryBtn}>
              {busy ? 'Creating…' : 'Create my free card account'}
            </button>
            {differentAccountButton}
          </form>
        );

      case 'already_registered':
        return (
          <>
            <p className="text-base text-slate-900">This Google account already has a DSBC {EXISTING_LABEL[phase.existing]}.</p>
            <button type="button" onClick={() => void enterWorkspace()} disabled={busy} className={primaryBtn}>
              Go to my workspace
            </button>
          </>
        );

      case 'not_company_admin':
        return (
          <>
            <p className="text-base text-slate-900">This Google account is not authorized as a Company Owner or Admin.</p>
            <button type="button" onClick={() => handleSignedInIntent('register_company', phase)} disabled={busy} className={primaryBtn}>
              Register as Company
            </button>
            {existingAccountButton}
            {differentAccountButton}
          </>
        );

      case 'no_account':
        return (
          <>
            <p className="text-base text-slate-900">No DSBC account uses this Google account yet.</p>
            <button type="button" onClick={() => handleSignedInIntent('create_free_card', phase)} disabled={busy} className={primaryBtn}>
              Create Free Card
            </button>
            <button type="button" onClick={() => handleSignedInIntent('register_company', phase)} disabled={busy} className={secondaryBtn}>
              Register as Company
            </button>
            <p className="text-sm text-slate-600">Joining your company? Ask your company admin to invite this Google account.</p>
            {existingAccountButton}
            {differentAccountButton}
          </>
        );

      case 'account_inactive':
        return (
          <>
            <p className="text-base text-slate-900">{inactiveCopy(phase.status)}</p>
            {differentAccountButton}
          </>
        );
    }
  };

  return (
    <div
      className="min-h-[100dvh] bg-slate-50 flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] font-sans text-slate-900"
      data-testid="sign-in-screen"
    >
      <header className="px-4 py-3 flex items-center justify-between">
        <span className="font-bold text-slate-900">DSBC</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close sign in"
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100"
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>
      </header>
      <main className="flex-1 w-full max-w-md mx-auto px-4 pb-6 flex flex-col gap-4" data-state={phase.kind}>
        {error && (
          <div role="alert" className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-rose-700 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}
        {phase.kind !== 'choose' && signedInEmail && (
          <p className="text-xs text-slate-500 break-all">Signed in as {signedInEmail}</p>
        )}
        {renderPhase()}
      </main>
    </div>
  );
};
