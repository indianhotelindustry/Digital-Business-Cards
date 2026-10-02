import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Shield,
  Building2,
  User,
  ChevronDown,
  LogOut,
  Sparkles,
  ExternalLink,
  Lock,
  CreditCard,
  Globe,
} from 'lucide-react';
import { DEMO_USERS } from '../../services/seedService';
import { ThemeToggle } from '../common/ThemeToggle';
import { DEMO_FEATURES_ENABLED } from '../../lib/runtimeFlags';
import { navigate } from '../../lib/routes';

interface HeaderProps {
  onOpenSecurityModal: () => void;
  onOpenAuthModal?: () => void;
  onOpenOnboardingModal?: () => void;
  onOpenMarketing?: () => void;
  onNavigateToCard?: (slug: string) => void;
  activeView: string;
  setActiveView: (view: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenSecurityModal,
  onOpenAuthModal,
  onOpenOnboardingModal,
  onOpenMarketing,
  onNavigateToCard,
  activeView,
  setActiveView,
}) => {
  const {
    userProfile,
    activeCompany,
    role,
    isDemoMode,
    authMethod,
    switchDemoPersona,
    logoutUser,
  } = useAuth();
  const [isPersonaMenuOpen, setIsPersonaMenuOpen] = useState(false);

  const getRoleBadge = () => {
    switch (role) {
      case 'app_owner':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            Platform Owner
          </span>
        );
      case 'company_admin':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-50 text-teal-700 border border-teal-200">
            Company Admin
          </span>
        );
      case 'employee':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            Employee Member
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200/80 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Left: Tenant or Platform Status */}
      <div className="flex items-center space-x-3">
        {role === 'app_owner' ? (
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-xs">
              PO
            </div>
            <div>
              <span className="text-xs font-bold text-slate-900 block leading-tight">
                Platform Administration
              </span>
              <span className="text-[10px] text-slate-500 font-mono">Global SaaS Hierarchy</span>
            </div>
          </div>
        ) : activeCompany ? (
          <div className="flex items-center space-x-2.5">
            {activeCompany.logoUrl ? (
              <img
                src={activeCompany.logoUrl}
                alt={activeCompany.name}
                className="w-8 h-8 rounded-lg object-contain bg-slate-50 p-1 border border-slate-200"
              />
            ) : (
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                style={{ backgroundColor: activeCompany.branding.primaryColor || '#0f766e' }}
              >
                {activeCompany.name.charAt(0)}
              </div>
            )}
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="text-xs font-bold text-slate-900 leading-tight">
                  {activeCompany.name}
                </span>
                {activeCompany.status === 'suspended' && (
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800">
                    Suspended
                  </span>
                )}
              </div>
              <span className="text-[10px] text-slate-400 font-mono">
                Tenant: {activeCompany.id}
              </span>
            </div>
          </div>
        ) : (
          <div className="text-xs font-semibold text-slate-700">Digital Business Card SaaS</div>
        )}
      </div>

      {/* Right Controls: Security Suite, Persona Switcher, User Menu */}
      <div className="flex items-center space-x-2.5">
        {/* Onboarding Wizard Launcher */}
        {onOpenOnboardingModal && (
          <button
            onClick={onOpenOnboardingModal}
            className="hidden lg:inline-flex items-center px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition"
            title="Launch First-Time Onboarding Wizard"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1.5 text-teal-600" />
            Setup Identity
          </button>
        )}

        {/* Public Website Link */}
        {onOpenMarketing && (
          <button
            onClick={onOpenMarketing}
            className="hidden md:inline-flex items-center px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition"
            title="View Public Marketing Website"
          >
            <Globe className="w-3.5 h-3.5 mr-1.5 text-teal-600" />
            Public Website
          </button>
        )}

        {/* Pricing Link */}
        <button
          onClick={() => {
            navigate('pricing');
          }}
          className="hidden md:inline-flex items-center px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition"
          title="View Public SaaS Pricing Matrix"
        >
          <CreditCard className="w-3.5 h-3.5 mr-1.5 text-teal-600" />
          Pricing
        </button>

        {/* Legacy in-browser Security Audit (DEVELOPMENT only — Directive 24) */}
        {DEMO_FEATURES_ENABLED && (
        <button
          onClick={onOpenSecurityModal}
          className="hidden sm:inline-flex items-center px-3 py-1.5 rounded-xl border border-teal-200 bg-teal-50/70 hover:bg-teal-100 text-teal-800 text-xs font-semibold shadow-xs transition"
          title="Verify Live Tenancy Isolation Tests"
        >
          <Shield className="w-3.5 h-3.5 mr-1.5 text-teal-600" />
          Security Audit (Live Tests)
        </button>
        )}

        {/* Theme Mode Switcher */}
        <ThemeToggle variant="icon" />

        {/* Demo Mode / Auth State Badge */}
        {isDemoMode ? (
          <button
            onClick={onOpenAuthModal}
            className="hidden lg:inline-flex items-center px-2 py-1 rounded-md text-[10px] font-mono font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition"
            title="Click to authenticate with real Firebase user"
          >
            DEMO PERSONA • SIGN IN
          </button>
        ) : (
          <span className="hidden lg:inline-flex items-center px-2 py-1 rounded-md text-[10px] font-mono font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            FIREBASE AUTHENTICATED
          </span>
        )}

        {/* Persona Switcher Dropdown (DEVELOPMENT only — Directive 24) */}
        {DEMO_FEATURES_ENABLED && (
        <div className="relative">
          <button
            onClick={() => setIsPersonaMenuOpen(!isPersonaMenuOpen)}
            className="flex items-center space-x-2 px-3 py-1.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-white text-slate-700 text-xs font-medium transition"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden md:inline">Switch Role</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {isPersonaMenuOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 text-xs animate-in fade-in zoom-in-95">
              <div className="px-3 py-2 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-slate-900">Switch Test Persona</p>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold">
                    Simulated Context
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1 leading-snug">
                  Persona switching changes client view context only. All backend mutations remain strictly governed by Firestore Security Rules.
                </p>
              </div>

              <div className="py-1">
                <button
                  onClick={() => {
                    switchDemoPersona('appOwner');
                    setActiveView('app-dashboard');
                    setIsPersonaMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between"
                >
                  <div>
                    <p className="font-semibold text-slate-800">App Owner</p>
                    <p className="text-[10px] text-slate-500">Platform-wide visibility</p>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 font-semibold">
                    Owner
                  </span>
                </button>

                <button
                  onClick={() => {
                    switchDemoPersona('companyAdminAcme');
                    setActiveView('company-dashboard');
                    setIsPersonaMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between"
                >
                  <div>
                    <p className="font-semibold text-slate-800">Acme Innovations Admin</p>
                    <p className="text-[10px] text-slate-500">Company A Tenant</p>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 font-semibold">
                    Admin A
                  </span>
                </button>

                <button
                  onClick={() => {
                    switchDemoPersona('companyAdminNexus');
                    setActiveView('company-dashboard');
                    setIsPersonaMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between"
                >
                  <div>
                    <p className="font-semibold text-slate-800">Nexus Global Admin</p>
                    <p className="text-[10px] text-slate-500">Company B Tenant (Isolated)</p>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold">
                    Admin B
                  </span>
                </button>

                <button
                  onClick={() => {
                    switchDemoPersona('employeeRahul');
                    setActiveView('employee-portal');
                    setIsPersonaMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between"
                >
                  <div>
                    <p className="font-semibold text-slate-800">Rahul Sharma</p>
                    <p className="text-[10px] text-slate-500">Acme Sales VP (Employee)</p>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold">
                    Employee
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
        )}

        {/* User Profile Pill */}
        <div className="flex items-center space-x-2 pl-2 border-l border-slate-200">
          <div className="text-right hidden sm:block">
            <span className="text-xs font-bold text-slate-900 block leading-tight">
              {userProfile?.displayName || 'Authorized User'}
            </span>
            <div className="flex items-center justify-end space-x-1 mt-0.5">
              {getRoleBadge()}
            </div>
          </div>

          <button
            onClick={logoutUser}
            className="p-2 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-slate-100 transition"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
