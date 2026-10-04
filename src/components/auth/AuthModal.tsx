import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { loginWithEmail } from '../../services/authService';
import { DEMO_FEATURES_ENABLED } from '../../lib/runtimeFlags';
import { Lock, Mail, Key, AlertCircle, X, ArrowRight } from 'lucide-react';

// Directive 34 Phase 1: the legacy email/password path is LOGIN ONLY, for
// accounts created before Google sign-in. New accounts are created by the
// backend (registerIndividual / registerCompany) from the Google sign-in screen.
interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called after a successful sign-in, before the modal closes. */
  onSignedIn?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSignedIn }) => {
  const { switchDemoPersona } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) setError(null);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const user = await loginWithEmail(email.trim(), password);
      if (!user) {
        setError('User document not found for these credentials.');
      } else {
        // Directive 26: signing in goes straight to the workspace.
        onSignedIn?.();
        onClose();
      }
    } catch (err: any) {
      console.error('Authentication failure:', err);
      let msg = 'Sign-in did not complete. Please try again.';
      if (err?.code === 'auth/invalid-credential' || err?.code === 'auth/wrong-password' || err?.code === 'auth/user-not-found') {
        msg = 'Invalid email or password.';
      } else if (err?.code === 'auth/too-many-requests') {
        msg = 'Too many attempts. Please wait a minute and try again.';
      } else if (err?.code === 'auth/network-request-failed') {
        msg = 'No connection. Check your internet and try again.';
      } else if (err?.code === 'auth/user-disabled') {
        msg = 'This account has been disabled. Please contact DSBC support.';
      }
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white border border-slate-200 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden max-h-[100dvh] overflow-y-auto">
        {/* Modal Header */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Sign in with your existing email account</h2>
              <p className="text-[11px] text-slate-500">For accounts created with an email and password</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6">
          {error && (
            <div role="alert" className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-2 text-rose-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label htmlFor="legacy-login-email" className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Work Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                <input
                  id="legacy-login-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full min-h-[44px] pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
                />
              </div>
            </div>

            <div>
              <label htmlFor="legacy-login-password" className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Password
              </label>
              <div className="relative">
                <Key className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                <input
                  id="legacy-login-password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full min-h-[44px] pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full min-h-[44px] mt-2 py-2.5 px-4 bg-teal-800 hover:bg-teal-900 active:bg-teal-950 text-white rounded-xl font-bold text-xs transition shadow-sm disabled:opacity-50 flex items-center justify-center space-x-1.5"
            >
              <span>{submitting ? 'Signing in...' : 'Sign In with Credentials'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>

          {/* Quick Demo Switcher Divider (DEVELOPMENT only) */}
          {DEMO_FEATURES_ENABLED && (
          <div className="mt-5 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                Demo Workspace Personas
              </span>
              <span className="text-[10px] text-amber-700 font-mono px-1.5 py-0.5 rounded bg-amber-50">
                Non-Authoritative
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  switchDemoPersona('companyAdminAcme');
                  onClose();
                }}
                className="p-2 text-left bg-slate-50 hover:bg-teal-50/60 border border-slate-200 hover:border-teal-200 rounded-xl transition text-[11px]"
              >
                <span className="font-bold text-slate-800 block">Acme Admin</span>
                <span className="text-[10px] text-slate-500">Company A Tenant</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  switchDemoPersona('companyAdminNexus');
                  onClose();
                }}
                className="p-2 text-left bg-slate-50 hover:bg-blue-50/60 border border-slate-200 hover:border-blue-200 rounded-xl transition text-[11px]"
              >
                <span className="font-bold text-slate-800 block">Nexus Admin</span>
                <span className="text-[10px] text-slate-500">Company B Tenant</span>
              </button>
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
  );
};
