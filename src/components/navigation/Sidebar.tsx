import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useEntitlement } from '../../context/EntitlementContext';
import {
  LayoutDashboard,
  Building2,
  Users2,
  FolderTree,
  CreditCard,
  BookOpen,
  BarChart3,
  Settings,
  Palette,
  UserCheck,
  QrCode,
  Share2,
  ExternalLink,
  Shield,
  Target,
  Sparkles,
  Sliders,
} from 'lucide-react';

interface SidebarProps {
  activeView: string;
  setActiveView: (view: string) => void;
  onNavigateToCard?: (slug: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeView, setActiveView, onNavigateToCard }) => {
  const { role, activeCompany, userProfile } = useAuth();
  const { openUpgradeModal } = useEntitlement();

  const renderNavItems = () => {
    if (role === 'app_owner') {
      return (
        <>
          <div className="px-3 mb-2 text-[10px] font-bold text-teal-600 uppercase tracking-wider">
            SaaS Platform Controls
          </div>
          <button
            onClick={() => setActiveView('app-dashboard')}
            className={`w-full flex items-center px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
              activeView === 'app-dashboard' || activeView === 'app-companies'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Sliders className="w-4 h-4 mr-2.5 text-teal-400" />
            SaaS Control Center
          </button>

          <button
            onClick={() => setActiveView('app-templates')}
            className={`w-full flex items-center px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
              activeView === 'app-templates'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <CreditCard className="w-4 h-4 mr-2.5" />
            Card Templates
          </button>
        </>
      );
    }

    if (role === 'company_admin') {
      return (
        <>
          <div className="px-3 mb-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Company Administration
          </div>
          <button
            onClick={() => setActiveView('company-dashboard')}
            className={`w-full flex items-center px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
              activeView === 'company-dashboard'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <LayoutDashboard className="w-4 h-4 mr-2.5" />
            Overview
          </button>

          <button
            onClick={() => setActiveView('company-employees')}
            className={`w-full flex items-center px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
              activeView === 'company-employees'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Users2 className="w-4 h-4 mr-2.5" />
            Employees & Cards
          </button>

          <button
            onClick={() => setActiveView('company-departments')}
            className={`w-full flex items-center px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
              activeView === 'company-departments'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <FolderTree className="w-4 h-4 mr-2.5" />
            Departments
          </button>

          <button
            onClick={() => setActiveView('company-directory')}
            className={`w-full flex items-center px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
              activeView === 'company-directory'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <BookOpen className="w-4 h-4 mr-2.5" />
            Company Directory
          </button>

          <button
            onClick={() => setActiveView('company-profile')}
            className={`w-full flex items-center px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
              activeView === 'company-profile'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Palette className="w-4 h-4 mr-2.5" />
            Profile & Branding
          </button>

          <button
            onClick={() => setActiveView('company-analytics')}
            className={`w-full flex items-center px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
              activeView === 'company-analytics'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <BarChart3 className="w-4 h-4 mr-2.5" />
            Card Analytics
          </button>

          <button
            onClick={() => setActiveView('my-plan')}
            className={`w-full flex items-center px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
              activeView === 'my-plan'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <CreditCard className="w-4 h-4 mr-2.5 text-teal-600" />
            Plan & Subscription
          </button>

          <div className="pt-2 mt-2 border-t border-slate-200/60">
            <div className="px-3 mb-1 text-[10px] font-bold text-teal-600 uppercase tracking-wider">
              DSBC Connect & Pipeline
            </div>
            <button
              onClick={() => setActiveView('events-leads')}
              className={`w-full flex items-center px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                activeView === 'events-leads'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Target className="w-4 h-4 mr-2.5 text-teal-600" />
              Events, Campaigns & Leads
            </button>
            <button
              onClick={() => setActiveView('connect')}
              className={`w-full flex items-center px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                activeView === 'connect'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Users2 className="w-4 h-4 mr-2.5 text-teal-600" />
              Personal Connections
            </button>
          </div>
        </>
      );
    }

    // Employee Role
    return (
      <>
        <div className="px-3 mb-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          My Workspace
        </div>
        <button
          onClick={() => setActiveView('employee-portal')}
          className={`w-full flex items-center px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
            activeView === 'employee-portal'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <CreditCard className="w-4 h-4 mr-2.5" />
          My Digital Card & QR
        </button>

        <button
          onClick={() => setActiveView('events-leads')}
          className={`w-full flex items-center px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
            activeView === 'events-leads'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Target className="w-4 h-4 mr-2.5 text-teal-600" />
          Events & Leads
        </button>

        <button
          onClick={() => setActiveView('connect')}
          className={`w-full flex items-center px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
            activeView === 'connect'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Users2 className="w-4 h-4 mr-2.5 text-teal-600" />
          DSBC Connect
        </button>

        <button
          onClick={() => setActiveView('company-directory')}
          className={`w-full flex items-center px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
            activeView === 'company-directory'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <BookOpen className="w-4 h-4 mr-2.5" />
          Company Directory
        </button>

        <button
          onClick={() => setActiveView('my-plan')}
          className={`w-full flex items-center px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
            activeView === 'my-plan'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <CreditCard className="w-4 h-4 mr-2.5 text-teal-600" />
          My Plan & Subscription
        </button>
      </>
    );
  };

  return (
    <aside className="w-64 bg-slate-50/70 border-r border-slate-200/80 flex flex-col justify-between p-4 shrink-0 min-h-[calc(100vh-4rem)]">
      <div className="space-y-1">{renderNavItems()}</div>

      {/* Tenancy & Entitlement Footprint */}
      <div className="pt-4 border-t border-slate-200 text-xs space-y-2">
        {role !== 'app_owner' && (
          <button
            onClick={() => openUpgradeModal()}
            className="w-full text-left p-3 rounded-xl bg-gradient-to-br from-teal-500/10 to-teal-600/5 border border-teal-200/80 hover:border-teal-300 transition group shadow-2xs"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-teal-800 flex items-center">
                <Sparkles className="w-3 h-3 mr-1 text-teal-600" />
                {activeCompany?.planId ? activeCompany.planId.replace('_', ' ').toUpperCase() : 'FREE TIER'}
              </span>
              <span className="text-[10px] font-bold text-teal-700 group-hover:underline">
                Upgrade →
              </span>
            </div>
            <p className="text-[10px] text-slate-500 leading-tight">
              View SaaS plans, increase seat limits, and unlock AI features.
            </p>
          </button>
        )}

        <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-2xs">
          <div className="flex items-center space-x-1.5 text-slate-700 font-semibold mb-1">
            <Shield className="w-3.5 h-3.5 text-teal-600" />
            <span className="text-[11px]">Tenant Isolation</span>
          </div>
          <p className="text-[10px] text-slate-500 leading-tight">
            Enforced via Firestore Security Rules & scoped company queries.
          </p>
        </div>
      </div>
    </aside>
  );
};
