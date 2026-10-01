// ============================================================================
// DSBC CUSTOMER REGISTRATION MODAL (Directive 21)
// ============================================================================

import React, { useState } from 'react';
import {
  User,
  Building2,
  Mail,
  Lock,
  ArrowRight,
  X,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { registerAccount } from '../../services/authService';
import { conversionFunnelService } from '../../services/conversionFunnelService';
import { UserProfile } from '../../types';

interface CustomerRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialType?: 'individual' | 'company';
  onRegistrationSuccess: (data: {
    user: UserProfile;
    customerType: 'individual' | 'company';
    initialCompanyData?: { name: string };
  }) => void;
  onSwitchToLogin: () => void;
}

export const CustomerRegistrationModal: React.FC<CustomerRegistrationModalProps> = ({
  isOpen,
  onClose,
  initialType = 'individual',
  onRegistrationSuccess,
  onSwitchToLogin,
}) => {
  const { refreshUserData } = useAuth();
  const [customerType, setCustomerType] = useState<'individual' | 'company'>(initialType);

  // Common inputs
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Company specific
  const [companyName, setCompanyName] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || !password.trim()) {
      setError('Please fill in all required fields.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (customerType === 'company' && !companyName.trim()) {
      setError('Please enter your company brand name.');
      return;
    }

    setLoading(true);
    setError(null);

    conversionFunnelService.trackEvent('REGISTRATION_STARTED', customerType);

    try {
      // Directive 24: identity + requested account type only; no client-chosen
      // role/companyId and no fabricated fallback profile.
      const profile: UserProfile = await registerAccount({
        email: email.trim(),
        password,
        displayName: fullName.trim(),
        accountType: customerType,
        companyName: customerType === 'company' ? companyName.trim() : undefined,
      });
      await refreshUserData();
      conversionFunnelService.trackEvent('REGISTRATION_COMPLETED', customerType);

      onRegistrationSuccess({
        user: profile,
        customerType,
        initialCompanyData: customerType === 'company' ? { name: companyName.trim() } : undefined,
      });
      onClose();
    } catch (err: any) {
      console.error('Registration failed:', err);
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-teal-700 text-white flex items-center justify-center font-bold text-xs shadow-xs">
              DS
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {customerType === 'individual' ? 'Create My Free Card' : 'Create Company Profile'}
              </h3>
              <p className="text-[11px] text-slate-500">
                Zero friction • Free forever baseline • 2-minute setup
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/50 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Customer Type Selector */}
          <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200/70">
            <button
              type="button"
              onClick={() => {
                setCustomerType('individual');
                setError(null);
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center space-x-1.5 transition ${
                customerType === 'individual'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Individual Card</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setCustomerType('company');
                setError(null);
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center space-x-1.5 transition ${
                customerType === 'company'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Company Organization</span>
            </button>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Full Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {customerType === 'individual' ? 'Full Name *' : 'Administrator Full Name *'}
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={customerType === 'individual' ? 'e.g. Vikram Mehta' : 'e.g. Ananya Roy'}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-hidden"
              />
            </div>
          </div>

          {/* Company Name (If company) */}
          {customerType === 'company' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Company Brand Name *
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Apex Global Solutions"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-hidden"
                />
              </div>
            </div>
          )}

          {/* Work / Personal Email */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Email Address *
            </label>
            <div className="relative">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-hidden"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Choose Password (Min. 6 characters) *
            </label>
            <div className="relative">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-hidden"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white rounded-xl font-bold text-xs transition shadow-sm flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              {loading ? (
                <span>Setting Up Your Workspace...</span>
              ) : (
                <>
                  <span>
                    {customerType === 'individual' ? 'Create Free Card & Continue' : 'Create Company Workspace & Continue'}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>

          <div className="pt-2 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-500">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onSwitchToLogin();
                }}
                className="font-semibold text-teal-700 hover:underline"
              >
                Sign In
              </button>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};
