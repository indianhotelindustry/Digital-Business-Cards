import React, { useEffect, useState } from 'react';
import { Company, Employee } from '../../types';
import { getAllCompanies, createCompany, setCompanyStatus } from '../../services/companyService';
import { getAllEmployees } from '../../services/employeeService';
import { useEntitlement } from '../../context/EntitlementContext';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  Layers,
  ListTree,
  TableProperties,
  Users2,
  UserCheck,
  Building2,
  HardDrive,
  CreditCard,
  Clock,
  Settings,
  History,
  Plus,
  RefreshCw,
  ExternalLink,
  Shield,
  Sparkles,
  Server,
} from 'lucide-react';

// Sub Tabs
import { SaaSOverviewTab } from '../saas/SaaSOverviewTab';
import { SaaSPlansTab } from '../saas/SaaSPlansTab';
import { SaaSFeatureCatalogueTab } from '../saas/SaaSFeatureCatalogueTab';
import { SaaSFeatureMatrixTab } from '../saas/SaaSFeatureMatrixTab';
import { SaaSCustomersTab } from '../saas/SaaSCustomersTab';
import { SaaSCompanyEntitlementsTab } from '../saas/SaaSCompanyEntitlementsTab';
import { SaaSIndividualEntitlementsTab } from '../saas/SaaSIndividualEntitlementsTab';
import { SaaSUsageLimitsTab } from '../saas/SaaSUsageLimitsTab';
import { SaaSBillingTab } from '../saas/SaaSBillingTab';
import { SaaSTrialsTab } from '../saas/SaaSTrialsTab';
import { SaaSPlatformSettingsTab } from '../saas/SaaSPlatformSettingsTab';
import { SaaSAuditTrailTab } from '../saas/SaaSAuditTrailTab';
import { SaaSProductionControlTab } from '../saas/SaaSProductionControlTab';
import { SaaSProductionReadinessCenter } from '../saas/SaaSProductionReadinessCenter';
import { SaaSPilotControlTab } from '../saas/SaaSPilotControlTab';
import { SaaSConversionFunnelTab } from '../saas/SaaSConversionFunnelTab';
import { SaaSSupportTab } from '../saas/SaaSSupportTab';
import { TrendingUp, MessageSquare, Rocket } from 'lucide-react';

interface AppOwnerDashboardProps {
  onNavigateToCard?: (slug: string) => void;
}

export const AppOwnerDashboard: React.FC<AppOwnerDashboardProps> = ({ onNavigateToCard }) => {
  const { userProfile } = useAuth();
  const { plans, overrides, globalPolicy, auditLogs, refresh } = useEntitlement();

  const [activeTab, setActiveTab] = useState<string>('overview');
  const [productionSubMode, setProductionSubMode] = useState<'gate' | 'controls'>('gate');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  // Drill-down target state for inspecting specific customer
  const [inspectCompanyId, setInspectCompanyId] = useState<string | null>(null);
  const [inspectEmployeeId, setInspectEmployeeId] = useState<string | null>(null);

  // Onboard Company Modal state
  const [isOnboardModalOpen, setIsOnboardModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newLegalName, setNewLegalName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newWebsite, setNewWebsite] = useState('');
  const [newPrimaryColor, setNewPrimaryColor] = useState('#0f766e');
  const [newPlanId, setNewPlanId] = useState('company_free');
  const [submitting, setSubmitting] = useState(false);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [compList, empList] = await Promise.all([
        getAllCompanies(),
        getAllEmployees('all'),
      ]);
      setCompanies(compList);
      setEmployees(empList);
    } catch (err) {
      console.error('Failed to load companies & employees:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const handleInspectCustomer = (type: 'company' | 'individual', id: string) => {
    if (type === 'company') {
      setInspectCompanyId(id);
      setActiveTab('company-entitlements');
    } else {
      setInspectEmployeeId(id);
      setActiveTab('individual-entitlements');
    }
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setSubmitting(true);
    try {
      const created = await createCompany({
        name: newName.trim(),
        legalName: newLegalName.trim() || newName.trim(),
        email: newEmail.trim(),
        phone: newPhone.trim(),
        website: newWebsite.trim(),
        address: '100 Innovation Way, Suite 100',
        description: 'Multi-tenant client enterprise onboarded via SaaS platform.',
        branding: {
          primaryColor: newPrimaryColor,
          secondaryColor: '#1e293b',
          cardThemePreference: 'classic',
          showCompanyAddress: true,
        },
        status: 'active',
        planId: newPlanId,
      });

      setCompanies((prev) => [created, ...prev]);
      setIsOnboardModalOpen(false);
      setNewName('');
      setNewLegalName('');
      setNewEmail('');
      setNewPhone('');
      setNewWebsite('');
      refresh();
    } catch (err) {
      console.error('Failed to create company:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const actorInfo = {
    id: userProfile?.id || 'user_app_owner_demo',
    name: userProfile?.displayName || 'App Owner (Platform Admin)',
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'plans', label: 'Plans', icon: Layers },
    { id: 'catalogue', label: 'Feature Catalogue', icon: ListTree },
    { id: 'matrix', label: 'Feature Matrix', icon: TableProperties },
    { id: 'customers', label: 'Customers', icon: Users2 },
    { id: 'individual-entitlements', label: 'Individual Entitlements', icon: UserCheck },
    { id: 'company-entitlements', label: 'Company Entitlements', icon: Building2 },
    { id: 'usage', label: 'Usage & Limits', icon: HardDrive },
    { id: 'billing', label: 'Billing & Pricing', icon: CreditCard },
    { id: 'trials', label: 'Trials & Passes', icon: Clock },
    { id: 'settings', label: 'Platform Settings', icon: Settings },
    { id: 'funnel', label: 'Conversion Funnel', icon: TrendingUp },
    { id: 'support', label: 'Support Inquiries', icon: MessageSquare },
    { id: 'pilot', label: 'First Customer Pilot', icon: Rocket },
    { id: 'production', label: 'Production Launch Gate', icon: Server },
    { id: 'audit', label: 'Entitlement Audit', icon: History },
  ];

  return (
    <div className="space-y-6">
      {/* SaaS Control Center Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-1.5 rounded-lg bg-teal-50 text-teal-700 border border-teal-200">
              <Shield className="w-4 h-4" />
            </span>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              SaaS Control Center
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-900 text-white">
              MASTER CONTROL
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Authoritative multi-tier entitlement hierarchy, plan designer, feature matrix, and customer exceptions.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              loadAllData();
              refresh();
            }}
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition"
            title="Refresh All Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setIsOnboardModalOpen(true)}
            className="inline-flex items-center px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition"
          >
            <Plus className="w-4 h-4 mr-1.5" /> Onboard Company
          </button>
        </div>
      </div>

      {/* Control Center Navigation Tabs */}
      <div className="bg-white rounded-2xl p-1.5 border border-slate-200 shadow-xs overflow-x-auto">
        <div className="flex items-center space-x-1 min-w-max">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center px-3 py-2 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 mr-1.5 ${isActive ? 'text-teal-400' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Contents */}
      {activeTab === 'overview' && (
        <SaaSOverviewTab
          companies={companies}
          plans={plans}
          overrides={overrides}
          auditLogs={auditLogs}
          onSelectTab={setActiveTab}
        />
      )}

      {activeTab === 'plans' && (
        <SaaSPlansTab
          plans={plans}
          onRefresh={() => {
            loadAllData();
            refresh();
          }}
          actorInfo={actorInfo}
        />
      )}

      {activeTab === 'catalogue' && <SaaSFeatureCatalogueTab />}

      {activeTab === 'matrix' && (
        <SaaSFeatureMatrixTab
          plans={plans}
          onRefresh={refresh}
          actorInfo={actorInfo}
        />
      )}

      {activeTab === 'customers' && (
        <SaaSCustomersTab
          companies={companies}
          employees={employees}
          plans={plans}
          overrides={overrides}
          onInspectCustomer={handleInspectCustomer}
          onNavigateToCard={onNavigateToCard}
        />
      )}

      {activeTab === 'company-entitlements' && (
        <SaaSCompanyEntitlementsTab
          companies={companies}
          plans={plans}
          overrides={overrides}
          selectedCompanyId={inspectCompanyId}
          onRefresh={refresh}
          actorInfo={actorInfo}
        />
      )}

      {activeTab === 'individual-entitlements' && (
        <SaaSIndividualEntitlementsTab
          employees={employees}
          companies={companies}
          plans={plans}
          overrides={overrides}
          selectedEmployeeId={inspectEmployeeId}
          onRefresh={refresh}
          actorInfo={actorInfo}
        />
      )}

      {activeTab === 'usage' && (
        <SaaSUsageLimitsTab
          companies={companies}
          employees={employees}
          plans={plans}
        />
      )}

      {activeTab === 'billing' && (
        <SaaSBillingTab
          companies={companies}
          plans={plans}
        />
      )}

      {activeTab === 'trials' && (
        <SaaSTrialsTab
          overrides={overrides}
          onRefresh={refresh}
          actorInfo={actorInfo}
        />
      )}

      {activeTab === 'settings' && (
        <SaaSPlatformSettingsTab
          globalPolicy={globalPolicy}
          plans={plans}
          onRefresh={refresh}
          actorInfo={actorInfo}
        />
      )}

      {activeTab === 'funnel' && <SaaSConversionFunnelTab />}

      {activeTab === 'support' && <SaaSSupportTab />}

      {activeTab === 'pilot' && (
        <SaaSPilotControlTab
          companies={companies}
          employees={employees}
          onNavigateToCard={onNavigateToCard}
        />
      )}

      {activeTab === 'production' && (
        <div className="space-y-4">
          <div className="flex items-center space-x-2 bg-slate-100 p-1 rounded-2xl w-fit">
            <button
              type="button"
              onClick={() => setProductionSubMode('gate')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
                productionSubMode === 'gate'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Shield className="w-3.5 h-3.5 text-teal-600" />
              <span>Launch Gate & Readiness Center (Directive 22)</span>
            </button>
            <button
              type="button"
              onClick={() => setProductionSubMode('controls')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
                productionSubMode === 'controls'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Server className="w-3.5 h-3.5 text-slate-700" />
              <span>Safety & Emergency Controls (Directive 20)</span>
            </button>
          </div>

          {productionSubMode === 'gate' ? (
            <SaaSProductionReadinessCenter
              companies={companies}
              employees={employees}
            />
          ) : (
            <SaaSProductionControlTab
              companies={companies}
              employees={employees}
            />
          )}
        </div>
      )}

      {activeTab === 'audit' && <SaaSAuditTrailTab auditLogs={auditLogs} />}

      {/* Onboard Company Modal */}
      {isOnboardModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 relative">
            <h2 className="text-lg font-bold text-slate-900 mb-1">Onboard New Corporate Tenant</h2>
            <p className="text-xs text-slate-500 mb-6">
              Create an isolated multi-tenant company environment with assigned subscription tier.
            </p>

            <form onSubmit={handleCreateCompany} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Company Name *
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Apex Global Tech"
                  required
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Work Email *
                  </label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="admin@apextech.com"
                    required
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Subscription Plan
                  </label>
                  <select
                    value={newPlanId}
                    onChange={(e) => setNewPlanId(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 font-medium"
                  >
                    {plans
                      .filter((p) => p.targetType === 'company')
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.price === 0 ? 'Free' : `₹${p.price}`})
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Primary Brand Color
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="color"
                      value={newPrimaryColor}
                      onChange={(e) => setNewPrimaryColor(e.target.value)}
                      className="w-8 h-8 rounded-lg border border-slate-200 cursor-pointer p-0"
                    />
                    <span className="text-xs font-mono text-slate-600 uppercase">
                      {newPrimaryColor}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsOnboardModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-xs transition"
                >
                  {submitting ? 'Provisioning...' : 'Provision Tenant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
