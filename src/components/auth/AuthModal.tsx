import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { loginWithEmail, registerAccount } from '../../services/authService';
import { DEMO_USERS } from '../../services/seedService';
import { conversionFunnelService } from '../../services/conversionFunnelService';
import { DEMO_FEATURES_ENABLED } from '../../lib/runtimeFlags';
import { Lock, Mail, Key, User, Building2, AlertCircle, Sparkles, X, Check, ArrowRight } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register';
  initialType?: 'individual' | 'company';
  onSuccess?: (type: 'individual' | 'company') => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'login',
  initialType = 'individual',
  onSuccess,
}) => {
  const { switchDemoPersona, refreshUserData } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [customerType, setCustomerType] = useState<'individual' | 'company'>(initialType);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setCustomerType(initialType);
      setError(null);
      if (initialMode === 'register') {
        conversionFunnelService.trackEvent('REGISTRATION_STARTED', initialType);
      }
    }
  }, [isOpen, initialMode, initialType]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (mode === 'login') {
        const user = await loginWithEmail(email.trim(), password);
        if (!user) {
          setError('User document not found for these credentials.');
        } else {
          // Directive 26: signing in goes straight to the workspace; the setup
          // wizard is for newly registered accounts only.
          onClose();
        }
      } else {
        if (!displayName.trim()) {
          setError(
            customerType === 'individual'
              ? 'Please provide your full name.'
              : 'Please provide company or admin name.'
          );
          setSubmitting(false);
          return;
        }

        // Directive 24: identity + requested account type only. Role, tenant and
        // plan are assigned by registrationModel and enforced by firestore.rules.
        // No local fallback profile: if registration fails, the user is told so.
        await registerAccount({
          email: email.trim(),
          password,
          displayName: displayName.trim(),
          accountType: customerType,
          companyName: customerType === 'company' ? displayName.trim() : undefined,
        });
        await refreshUserData();

        conversionFunnelService.trackEvent('REGISTRATION_COMPLETED', customerType);
        onClose();
        onSuccess?.(customerType);
      }
    } catch (err: any) {
      console.error('Authentication failure:', err);
      let msg = err.message || 'Authentication failed';
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        msg = 'Invalid email or password.';
      } else if (err.code === 'auth/email-already-in-use') {
        msg = 'An account with this email already exists.';
      } else if (err.code === 'auth/weak-password') {
        msg = 'Password should be at least 6 characters.';
      }
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white border border-slate-200 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
              {customerType === 'individual' && mode === 'register' ? (
                <User className="w-5 h-5" />
              ) : customerType === 'company' && mode === 'register' ? (
                <Building2 className="w-5 h-5" />
              ) : (
                <Lock className="w-5 h-5" />
              )}
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                {mode === 'login'
                  ? 'Sign In to Workspace'
                  : customerType === 'individual'
                  ? 'Create My Free Digital Card'
                  : 'Create Company Profile & Mini-Website'}
              </h2>
              <p className="text-[11px] text-slate-500">
                {mode === 'login'
                  ? 'Firebase Authentication & Multi-Tenant Authorization'
                  : customerType === 'individual'
                  ? 'Zero credit card required • Instant public vanity URL'
                  : 'Team directory • Branded employee cards • Mini-website'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-2 text-rose-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Registration Mode Choice (Directive 21 Section 6) */}
          {mode === 'register' && (
            <div className="mb-4 p-1 bg-slate-100 rounded-xl grid grid-cols-2 gap-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setCustomerType('individual')}
                className={`py-1.5 px-3 rounded-lg flex items-center justify-center space-x-1.5 transition ${
                  customerType === 'individual'
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <User className="w-3.5 h-3.5 text-teal-600" />
                <span>Individual Card</span>
              </button>
              <button
                type="button"
                onClick={() => setCustomerType('company')}
                className={`py-1.5 px-3 rounded-lg flex items-center justify-center space-x-1.5 transition ${
                  customerType === 'company'
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Building2 className="w-3.5 h-3.5 text-teal-600" />
                <span>Company Profile</span>
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === 'register' && (
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  {customerType === 'individual' ? 'Full Name' : 'Company or Admin Name'}
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder={
                      customerType === 'individual' ? 'e.g. Jordan Smith' : 'e.g. Acme Innovations'
                    }
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                {customerType === 'individual' && mode === 'register' ? 'Personal / Work Email' : 'Work Email'}
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Password
              </label>
              <div className="relative">
                <Key className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-2 py-2.5 px-4 bg-teal-800 hover:bg-teal-900 active:bg-teal-950 text-white rounded-xl font-bold text-xs transition shadow-sm disabled:opacity-50 flex items-center justify-center space-x-1.5"
            >
              <span>
                {submitting
                  ? 'Setting Up Account...'
                  : mode === 'login'
                  ? 'Sign In with Credentials'
                  : customerType === 'individual'
                  ? 'Create My Free Card & Start Onboarding'
                  : 'Create Company Profile & Start Onboarding'}
              </span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>

          {/* Toggle Login/Register */}
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => {
                setError(null);
                setMode(mode === 'login' ? 'register' : 'login');
              }}
              className="text-xs text-teal-700 hover:text-teal-800 font-medium"
            >
              {mode === 'login'
                ? "Don't have an account? Create Free Card or Company Profile"
                : 'Already have credentials? Sign In'}
            </button>
          </div>

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
