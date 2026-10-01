import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { EntitlementProvider } from './context/EntitlementContext';
import { SubscriptionProvider } from './context/SubscriptionContext';
import { UpgradeModal } from './components/entitlements/UpgradeModal';
import { Header } from './components/navigation/Header';
import { Sidebar } from './components/navigation/Sidebar';
import { AppOwnerDashboard } from './components/views/AppOwnerDashboard';
import { CompanyDashboard } from './components/views/CompanyDashboard';
import { EmployeeManagementView } from './components/views/EmployeeManagementView';
import { DepartmentManagementView } from './components/views/DepartmentManagementView';
import { CompanyProfileView } from './components/views/CompanyProfileView';
import { CompanyDirectoryView } from './components/views/CompanyDirectoryView';
import { CompanyAnalyticsView } from './components/views/CompanyAnalyticsView';
import { EmployeePortalView } from './components/views/EmployeePortalView';
import { TemplateCatalogView } from './components/views/TemplateCatalogView';
import { ConnectView } from './components/connect/ConnectView';
import { EventsCampaignsLeadsView } from './components/views/EventsCampaignsLeadsView';
import { CustomerPlanView } from './components/subscription/CustomerPlanView';
import { PublicPricingPage } from './components/public/PublicPricingPage';
import { PublicCardPage } from './components/public/PublicCardPage';
import { PublicProfilePage } from './components/public/PublicProfilePage';
import { PublicCompanyPage } from './components/public/PublicCompanyPage';
import { PublicMarketingPage } from './components/public/PublicMarketingPage';
import { SecurityTestRunnerModal } from './components/security/SecurityTestRunnerModal';
import { AuthModal } from './components/auth/AuthModal';
import { OnboardingWizardModal } from './components/onboarding/OnboardingWizardModal';
import { DEMO_FEATURES_ENABLED } from './lib/runtimeFlags';
import { Shield, Sparkles, Building2, ExternalLink, Lock } from 'lucide-react';

function AppContent() {
  const { role, activeCompany, userProfile, loading: isLoading, switchDemoPersona } = useAuth();

  // Route / View state
  const [activeView, setActiveView] = useState<string>('dashboard');
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');
  const [authModalType, setAuthModalType] = useState<'individual' | 'company'>('individual');
  const [isOnboardingModalOpen, setIsOnboardingModalOpen] = useState(false);
  const [onboardingType, setOnboardingType] = useState<'individual' | 'company'>('individual');
  const [publicCardSlug, setPublicCardSlug] = useState<string | null>(null);
  const [publicProfileSlug, setPublicProfileSlug] = useState<string | null>(null);
  const [publicCompanySlug, setPublicCompanySlug] = useState<string | null>(null);
  const [isPricingPage, setIsPricingPage] = useState(false);
  const [isMarketingPage, setIsMarketingPage] = useState(false);
  const [isAdminPreview, setIsAdminPreview] = useState(false);

  // Sync route with hash
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace(/^#\/?/, '');
      if (hash === 'pricing') {
        setIsPricingPage(true);
        setIsMarketingPage(false);
        setPublicCardSlug(null);
        setPublicProfileSlug(null);
        setPublicCompanySlug(null);
        setIsAdminPreview(false);
      } else if (
        hash === 'marketing' ||
        hash === 'home' ||
        hash === 'features' ||
        hash === 'individual' ||
        hash === 'company' ||
        hash === 'how-it-works' ||
        hash === 'faq' ||
        hash === 'contact'
      ) {
        setIsMarketingPage(true);
        setIsPricingPage(false);
        setPublicCardSlug(null);
        setPublicProfileSlug(null);
        setPublicCompanySlug(null);
        setIsAdminPreview(false);
      } else if (hash.startsWith('card/')) {
        setIsMarketingPage(false);
        setIsPricingPage(false);
        const full = hash.replace('card/', '').trim();
        const [slug, query] = full.split('?');
        const isPreview = query?.includes('preview=true') || false;
        setPublicCardSlug(slug);
        setPublicProfileSlug(null);
        setPublicCompanySlug(null);
        setIsAdminPreview(isPreview);
      } else if (hash.startsWith('profile/')) {
        setIsMarketingPage(false);
        setIsPricingPage(false);
        const full = hash.replace('profile/', '').trim();
        const [slug, query] = full.split('?');
        const isPreview = query?.includes('preview=true') || false;
        setPublicProfileSlug(slug);
        setPublicCardSlug(null);
        setPublicCompanySlug(null);
        setIsAdminPreview(isPreview);
      } else if (hash.startsWith('company/')) {
        setIsMarketingPage(false);
        setIsPricingPage(false);
        const full = hash.replace('company/', '').trim();
        const [slug, query] = full.split('?');
        const isPreview = query?.includes('preview=true') || false;
        setPublicCompanySlug(slug);
        setPublicCardSlug(null);
        setPublicProfileSlug(null);
        setIsAdminPreview(isPreview);
      } else if (hash === 'app' || hash === 'dashboard') {
        setIsMarketingPage(false);
        setIsPricingPage(false);
        setPublicCardSlug(null);
        setPublicProfileSlug(null);
        setPublicCompanySlug(null);
        setIsAdminPreview(false);
      } else {
        // Root or empty hash
        setIsPricingPage(false);
        setPublicCardSlug(null);
        setPublicProfileSlug(null);
        setPublicCompanySlug(null);
        setIsAdminPreview(false);
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Set default view on role change
  useEffect(() => {
    if (role === 'app_owner') {
      setActiveView('app-dashboard');
    } else if (role === 'company_admin') {
      setActiveView('company-dashboard');
    } else if (role === 'employee') {
      setActiveView('employee-portal');
    }
  }, [role]);

  const handleNavigateToCard = (slug: string, preview = false) => {
    window.location.hash = `card/${slug}${preview ? '?preview=true' : ''}`;
  };

  const handleBackFromCard = () => {
    window.location.hash = '';
    setIsPricingPage(false);
    setPublicCardSlug(null);
    setPublicProfileSlug(null);
    setPublicCompanySlug(null);
    setIsAdminPreview(false);
  };

  const handleStartIndividualRegistration = () => {
    setAuthModalMode('register');
    setAuthModalType('individual');
    setIsAuthModalOpen(true);
  };

  const handleStartCompanyRegistration = () => {
    setAuthModalMode('register');
    setAuthModalType('company');
    setIsAuthModalOpen(true);
  };

  const handleOpenLogin = () => {
    setAuthModalMode('login');
    setIsAuthModalOpen(true);
  };

  const handleAuthSuccess = (type: 'individual' | 'company') => {
    setOnboardingType(type);
    setIsOnboardingModalOpen(true);
  };

  // If viewing public pricing matrix standalone
  if (isPricingPage) {
    return (
      <PublicPricingPage
        onBackToApp={handleBackFromCard}
        onSelectPlan={(planId) => {
          window.location.hash = '';
          setIsPricingPage(false);
          setActiveView('my-plan');
        }}
      />
    );
  }

  // If viewing a public company profile mini-website standalone
  if (publicCompanySlug) {
    return (
      <PublicCompanyPage
        companySlug={publicCompanySlug}
        onBackToApp={handleBackFromCard}
        onBackToCard={(cardSlug) => {
          if (cardSlug) {
            window.location.hash = `card/${cardSlug}${isAdminPreview ? '?preview=true' : ''}`;
          } else {
            handleBackFromCard();
          }
        }}
        isAdminPreview={isAdminPreview}
      />
    );
  }

  // If viewing a public individual full profile standalone
  if (publicProfileSlug) {
    return (
      <PublicProfilePage
        slug={publicProfileSlug}
        onBackToCard={() => {
          window.location.hash = `card/${publicProfileSlug}${isAdminPreview ? '?preview=true' : ''}`;
        }}
        onBackToApp={handleBackFromCard}
        isAdminPreview={isAdminPreview}
      />
    );
  }

  // If viewing a public card standalone
  if (publicCardSlug) {
    return (
      <PublicCardPage
        slug={publicCardSlug}
        onBackToApp={handleBackFromCard}
        isAdminPreview={isAdminPreview}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 border-3 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Initializing Digital Business Card Platform...
        </p>
      </div>
    );
  }

  // If on Public Marketing Website OR visitor unauthenticated state
  if (isMarketingPage || (!userProfile && !publicCardSlug && !publicProfileSlug && !publicCompanySlug)) {
    return (
      <div className="relative">
        <PublicMarketingPage
          onStartIndividual={handleStartIndividualRegistration}
          onStartCompany={handleStartCompanyRegistration}
          onNavigateToPricing={() => {
            window.location.hash = 'pricing';
          }}
          onOpenLogin={handleOpenLogin}
          onGoToDashboard={() => {
            setIsMarketingPage(false);
            window.location.hash = 'app';
          }}
        />

        {/* First-Run Customer Onboarding Wizard */}
        <OnboardingWizardModal
          isOpen={isOnboardingModalOpen}
          onClose={() => setIsOnboardingModalOpen(false)}
          initialType={onboardingType}
          onPublishComplete={(slug, type) => {
            setIsOnboardingModalOpen(false);
            window.location.hash = `${type}/${slug}`;
          }}
        />

        {/* Authentication & Registration Modal */}
        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          initialMode={authModalMode}
          initialType={authModalType}
          onSuccess={handleAuthSuccess}
        />

        {/* Legacy Security Test Runner Modal (DEVELOPMENT only — Directive 24) */}
        {DEMO_FEATURES_ENABLED && (
          <SecurityTestRunnerModal
            isOpen={isSecurityModalOpen}
            onClose={() => setIsSecurityModalOpen(false)}
          />
        )}
      </div>
    );
  }

  const renderActiveView = () => {
    // Guard Platform Owner Views
    if (activeView.startsWith('app-') && role !== 'app_owner') {
      return (
        <div className="max-w-md mx-auto my-12 p-6 bg-white border border-rose-200 rounded-3xl text-center shadow-sm">
          <Shield className="w-12 h-12 text-rose-500 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900">Access Restricted</h3>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Platform Owner credentials are required to view global SaaS hierarchy settings.
          </p>
          <button
            onClick={() => setActiveView(role === 'employee' ? 'employee-portal' : 'company-dashboard')}
            className="mt-4 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition"
          >
            Return to Authorized Workspace
          </button>
        </div>
      );
    }

    // Guard Company Admin Views from Employee role
    if (
      (activeView === 'company-employees' ||
        activeView === 'company-departments' ||
        activeView === 'company-profile' ||
        activeView === 'company-analytics') &&
      role === 'employee'
    ) {
      return (
        <div className="max-w-md mx-auto my-12 p-6 bg-white border border-amber-200 rounded-3xl text-center shadow-sm">
          <Shield className="w-12 h-12 text-amber-500 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900">Company Admin Area</h3>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Administrative privileges are required to configure organization settings.
          </p>
          <button
            onClick={() => setActiveView('employee-portal')}
            className="mt-4 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition"
          >
            Go to My Digital Card
          </button>
        </div>
      );
    }

    switch (activeView) {
      // Platform Owner Views
      case 'app-dashboard':
      case 'app-companies':
        return <AppOwnerDashboard onNavigateToCard={handleNavigateToCard} />;
      case 'app-templates':
        return <TemplateCatalogView />;

      // Company Admin Views
      case 'company-dashboard':
        return (
          <CompanyDashboard
            setActiveView={setActiveView}
            onNavigateToCard={handleNavigateToCard}
          />
        );
      case 'company-employees':
        return <EmployeeManagementView onNavigateToCard={handleNavigateToCard} />;
      case 'company-departments':
        return <DepartmentManagementView />;
      case 'company-profile':
        return <CompanyProfileView />;
      case 'company-directory':
        return <CompanyDirectoryView onNavigateToCard={handleNavigateToCard} />;
      case 'company-analytics':
        return <CompanyAnalyticsView />;

      // Employee Views
      case 'employee-portal':
        return <EmployeePortalView onNavigateToCard={handleNavigateToCard} />;

      // DSBC Connect View
      case 'connect':
        return <ConnectView />;

      // DSBC V2.1 Events, Campaigns & Leads View
      case 'events-leads':
        return <EventsCampaignsLeadsView onNavigateToCard={handleNavigateToCard} />;

      // Customer Account Center: My Plan & Subscription
      case 'my-plan':
        return <CustomerPlanView />;

      default:
        if (role === 'app_owner') return <AppOwnerDashboard onNavigateToCard={handleNavigateToCard} />;
        if (role === 'employee') return <EmployeePortalView onNavigateToCard={handleNavigateToCard} />;
        return (
          <CompanyDashboard
            setActiveView={setActiveView}
            onNavigateToCard={handleNavigateToCard}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-900">
      {/* Top Application Header */}
      <Header
        onOpenSecurityModal={() => setIsSecurityModalOpen(true)}
        onOpenAuthModal={() => {
          setAuthModalMode('login');
          setIsAuthModalOpen(true);
        }}
        onOpenOnboardingModal={() => {
          setOnboardingType(role === 'company_admin' ? 'company' : 'individual');
          setIsOnboardingModalOpen(true);
        }}
        onOpenMarketing={() => {
          window.location.hash = 'marketing';
          setIsMarketingPage(true);
        }}
        onNavigateToCard={handleNavigateToCard}
        activeView={activeView}
        setActiveView={setActiveView}
      />

      {/* Main Structural Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Scoped Sidebar */}
        <Sidebar
          activeView={activeView}
          setActiveView={setActiveView}
          onNavigateToCard={handleNavigateToCard}
        />

        {/* Content Canvas */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-7xl">
          {renderActiveView()}
        </main>
      </div>

      {/* First-Run Customer Onboarding Wizard */}
      <OnboardingWizardModal
        isOpen={isOnboardingModalOpen}
        onClose={() => setIsOnboardingModalOpen(false)}
        initialType={onboardingType}
        onPublishComplete={(slug, type) => {
          setIsOnboardingModalOpen(false);
          window.location.hash = `${type}/${slug}`;
        }}
      />

      {/* Legacy Security Test Runner Modal (DEVELOPMENT only — Directive 24) */}
      {DEMO_FEATURES_ENABLED && (
        <SecurityTestRunnerModal
          isOpen={isSecurityModalOpen}
          onClose={() => setIsSecurityModalOpen(false)}
        />
      )}

      {/* Real Firebase Authentication Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialMode={authModalMode}
        initialType={authModalType}
        onSuccess={handleAuthSuccess}
      />

      {/* SaaS Flexible Pricing & Upgrade Modal */}
      <UpgradeModal />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider defaultMode="system">
      <AuthProvider>
        <EntitlementProvider>
          <SubscriptionProvider>
            <AppContent />
          </SubscriptionProvider>
        </EntitlementProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
