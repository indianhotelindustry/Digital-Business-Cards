import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  User,
  Building2,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  X,
  Camera,
  Globe,
  Mail,
  Phone,
  Layers,
  Palette,
  Eye,
  Shield,
  CreditCard,
  Check,
  AlertCircle,
  Copy,
  Share2,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useEntitlement } from '../../context/EntitlementContext';
import { useSubscription } from '../../context/SubscriptionContext';
import { slugService } from '../../services/slugService';
import { publishingService } from '../../services/publishingService';
import { notificationService } from '../../services/notificationService';
import { conversionFunnelService } from '../../services/conversionFunnelService';
import { getCardByEmployeeId } from '../../services/cardService';
import { updateCompany } from '../../services/companyService';
import { describeBackendError } from '../../lib/backend';

interface OnboardingWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialType?: 'individual' | 'company';
  onPublishComplete?: (slug: string, type: 'card' | 'company') => void;
}

export const OnboardingWizardModal: React.FC<OnboardingWizardModalProps> = ({
  isOpen,
  onClose,
  initialType = 'individual',
  onPublishComplete,
}) => {
  const { role, userProfile, activeCompany, refreshUserData } = useAuth();
  const { plans } = useEntitlement();
  const { upgradeToPlan } = useSubscription();

  const [customerType, setCustomerType] = useState<'individual' | 'company'>(
    role === 'company_admin' ? 'company' : initialType
  );
  const [currentStep, setCurrentStep] = useState(1);

  // Individual Form Fields
  const [indName, setIndName] = useState(userProfile?.displayName || '');
  const [indTitle, setIndTitle] = useState('Senior Solutions Consultant');
  const [indCompany, setIndCompany] = useState('Acme Innovations Ltd');
  const [indEmail, setIndEmail] = useState(userProfile?.email || '');
  const [indPhone, setIndPhone] = useState('+91 98765 43210');
  const [indBio, setIndBio] = useState('Digital strategy & technology advisor specializing in enterprise systems.');
  const [indSlug, setIndSlug] = useState('');
  const [indTheme, setIndTheme] = useState<'classic' | 'modern' | 'minimal'>('classic');
  const [indPlan, setIndPlan] = useState<'individual_free' | 'individual_pro'>('individual_free');

  // Company Form Fields
  const [compName, setCompName] = useState(activeCompany?.name || 'Acro Innovations');
  const [compLegal, setCompLegal] = useState(activeCompany?.legalName || 'Acro Innovations Private Limited');
  const [compTagline, setCompTagline] = useState('Leading Cloud & Digital Architecture Systems');
  const [compIndustry, setCompIndustry] = useState('Enterprise Technology');
  const [compEmail, setCompEmail] = useState(activeCompany?.email || 'contact@acro-innovations.example');
  const [compPhone, setCompPhone] = useState(activeCompany?.phone || '+91 22 4987 6543');
  const [compSlug, setCompSlug] = useState('');
  const [compPlan, setCompPlan] = useState<'company_free' | 'company_pro'>('company_free');

  // Slug validation state
  const [slugError, setSlugError] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState(false);
  const [publishedSlug, setPublishedSlug] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [planNotice, setPlanNotice] = useState<string | null>(null);

  // Directive 26: start from the customer's real company record, not sample text.
  useEffect(() => {
    if (!isOpen || !activeCompany) return;
    setCompName(activeCompany.name || '');
    setCompLegal(activeCompany.legalName || activeCompany.name || '');
    setCompTagline(activeCompany.tagline || '');
    setCompIndustry(activeCompany.industry || '');
    setCompEmail(activeCompany.email || userProfile?.email || '');
    setCompPhone(activeCompany.phone || '');
  }, [isOpen, activeCompany?.id]);

  useEffect(() => {
    if (isOpen) {
      conversionFunnelService.trackEvent('ONBOARDING_STARTED', customerType);
    }
  }, [isOpen, customerType]);

  // Auto-generate initial slug from name
  useEffect(() => {
    if (customerType === 'individual' && indName && !indSlug) {
      setIndSlug(slugService.sanitize(indName));
    } else if (customerType === 'company' && compName && !compSlug) {
      setCompSlug(slugService.sanitize(compName));
    }
  }, [indName, compName, customerType, indSlug, compSlug]);

  if (!isOpen) return null;

  // Calculate live completion metrics
  const activeSlug = customerType === 'individual' ? indSlug : compSlug;
  const indCompletion = publishingService.calculateIndividualCardCompletion({
    displayName: indName,
    jobTitle: indTitle,
    email: indEmail,
    phone: indPhone,
    bio: indBio,
    publicSlug: indSlug,
  });

  const compFields = [compName, compLegal, compTagline, compIndustry, compEmail, compPhone, compSlug];
  const compCompleted = compFields.filter((f) => !!f.trim()).length;
  const compScore = Math.round((compCompleted / compFields.length) * 100);

  const currentScore = customerType === 'individual' ? indCompletion.score : compScore;

  const handleSlugChange = (val: string) => {
    const sanitized = slugService.sanitize(val);
    if (customerType === 'individual') {
      setIndSlug(sanitized);
    } else {
      setCompSlug(sanitized);
    }

    const res = slugService.validateSlug(sanitized);
    if (!res.isValid) {
      setSlugError(res.errorMessage || 'Invalid URL slug');
    } else {
      setSlugError(null);
    }
  };

  const handleNext = () => {
    // Validate current step before proceeding
    if (currentStep === 4) {
      // Slug step validation
      const res = slugService.validateSlug(activeSlug);
      if (!res.isValid) {
        setSlugError(res.errorMessage || 'Invalid URL slug');
        return;
      }
    }
    if (currentStep === 5) {
      conversionFunnelService.trackEvent('PROFILE_COMPLETED', customerType);
    }
    setCurrentStep((prev) => Math.min(prev + 1, 6));
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handlePreview = () => {
    conversionFunnelService.trackEvent('PREVIEW_VIEWED', customerType);
    const targetSlug = slugService.sanitize(activeSlug);
    window.open(`/#/${customerType === 'individual' ? 'card' : 'company'}/${targetSlug}?preview=true`, '_blank');
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/#/${customerType === 'individual' ? 'card' : 'company'}/${publishedSlug || activeSlug}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleShare = () => {
    const url = `${window.location.origin}/#/${customerType === 'individual' ? 'card' : 'company'}/${publishedSlug || activeSlug}`;
    if (navigator.share) {
      navigator.share({
        title: customerType === 'individual' ? indName : compName,
        text: `Check out my official digital business card:`,
        url,
      }).catch(() => {});
    } else {
      handleCopyLink();
    }
  };

  const handleFinalPublish = async () => {
    setIsPublishing(true);
    setSlugError(null);

    try {
      const slug = slugService.sanitize(activeSlug);
      const val = slugService.validateSlug(slug);
      if (!val.isValid) {
        setSlugError(val.errorMessage || 'Invalid URL slug');
        setIsPublishing(false);
        return;
      }

      // Pro selected: request a checkout. The plan changes only after the
      // backend verifies a payment; otherwise publishing continues on Free.
      const selectedPlanId = customerType === 'individual' ? indPlan : compPlan;
      setPlanNotice(null);
      if (selectedPlanId.includes('pro')) {
        const upgrade = await upgradeToPlan(selectedPlanId);
        if (!upgrade.success) setPlanNotice(upgrade.message || 'Your plan was not changed.');
      }

      // Publish the customer's real entity through the backend (ownership,
      // entitlement, seat lock and slug availability are checked server-side).
      let entityId: string | null = null;
      if (customerType === 'company') {
        entityId = activeCompany?.id ?? null;
        if (entityId) {
          // Save what the customer entered in the wizard before publishing it.
          await updateCompany(entityId, {
            name: compName.trim(),
            legalName: compLegal.trim() || compName.trim(),
            tagline: compTagline.trim(),
            industry: compIndustry.trim(),
            email: compEmail.trim(),
            phone: compPhone.trim(),
          });
          await refreshUserData();
        }
      } else if (userProfile?.employeeId) {
        entityId = (await getCardByEmployeeId(userProfile.employeeId))?.id ?? null;
      }
      if (!entityId) {
        setSlugError(customerType === 'company' ? 'No company workspace found for this account.' : 'Create your digital card first, then publish it.');
        return;
      }
      try {
        await publishingService.publishEntity(entityId, slug, customerType === 'individual' ? 'card' : 'company');
      } catch (err) {
        setSlugError(describeBackendError(err));
        return;
      }

      // Dispatch welcome & publish notification
      await notificationService.dispatchNotification(
        'PROFILE_PUBLISHED',
        customerType === 'individual' ? indEmail : compEmail,
        customerType === 'individual' ? indName : compName,
        {
          ctaLink: `/#/${customerType === 'individual' ? 'card' : 'company'}/${slug}`,
          ctaText: 'View Published Profile',
        }
      );

      conversionFunnelService.trackEvent('PUBLISHED', customerType);
      setPublishedSlug(slug);
      setPublishSuccess(true);
    } catch (err: any) {
      console.error('Publish error:', err);
      setSlugError(err.message || 'Failed to complete publishing.');
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header with completion meter */}
        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-teal-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                DS
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {customerType === 'individual' ? 'Individual Digital Identity Setup' : 'Corporate Organization Setup'}
                </h3>
                <p className="text-[11px] text-slate-500">
                  Step {currentStep} of 6 • Zero-Friction Customer Onboarding
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

          {/* Profile Completion Bar (Directive 20 requirement #5) */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-[11px] font-semibold mb-1.5">
              <span className="text-slate-700 flex items-center">
                <Sparkles className="w-3.5 h-3.5 mr-1 text-teal-600" /> Profile Completion
              </span>
              <span className="font-mono text-teal-700">{currentScore}%</span>
            </div>
            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 transition-all duration-300 rounded-full"
                style={{ width: `${currentScore}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Wizard Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-slate-900">
          {/* STEP 1: TYPE & CORE IDENTITY */}
          {currentStep === 1 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200/70">
                <button
                  type="button"
                  onClick={() => setCustomerType('individual')}
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
                  onClick={() => setCustomerType('company')}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center space-x-1.5 transition ${
                    customerType === 'company'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Company Mini-Website</span>
                </button>
              </div>

              {customerType === 'individual' ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Full Legal / Professional Name *
                    </label>
                    <input
                      type="text"
                      value={indName}
                      onChange={(e) => setIndName(e.target.value)}
                      placeholder="e.g. Rahul Sharma"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Professional Title / Designation *
                    </label>
                    <input
                      type="text"
                      value={indTitle}
                      onChange={(e) => setIndTitle(e.target.value)}
                      placeholder="e.g. Chief Technology Officer"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Organization / Company Affiliation
                    </label>
                    <input
                      type="text"
                      value={indCompany}
                      onChange={(e) => setIndCompany(e.target.value)}
                      placeholder="e.g. Acme Innovations"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-hidden"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Company Brand Name *
                    </label>
                    <input
                      type="text"
                      value={compName}
                      onChange={(e) => setCompName(e.target.value)}
                      placeholder="e.g. Acro Innovations"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Registered Legal Entity Name *
                    </label>
                    <input
                      type="text"
                      value={compLegal}
                      onChange={(e) => setCompLegal(e.target.value)}
                      placeholder="e.g. Acro Innovations Pvt Ltd"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Industry Sector
                    </label>
                    <input
                      type="text"
                      value={compIndustry}
                      onChange={(e) => setCompIndustry(e.target.value)}
                      placeholder="e.g. Enterprise Software & AI"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-hidden"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: CONTACT & MEDIA */}
          {currentStep === 2 && (
            <div className="space-y-3.5 animate-in fade-in">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider text-slate-500">
                Official Contact & Dispatch Coordinates
              </h4>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Primary Email Address *
                </label>
                <input
                  type="email"
                  value={customerType === 'individual' ? indEmail : compEmail}
                  onChange={(e) =>
                    customerType === 'individual' ? setIndEmail(e.target.value) : setCompEmail(e.target.value)
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-hidden"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Telephone / Mobile Contact *
                </label>
                <input
                  type="tel"
                  value={customerType === 'individual' ? indPhone : compPhone}
                  onChange={(e) =>
                    customerType === 'individual' ? setIndPhone(e.target.value) : setCompPhone(e.target.value)
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-hidden"
                />
              </div>
              {customerType === 'individual' ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Professional Bio Summary
                  </label>
                  <textarea
                    rows={3}
                    value={indBio}
                    onChange={(e) => setIndBio(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-hidden"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Corporate Tagline / Value Proposition
                  </label>
                  <input
                    type="text"
                    value={compTagline}
                    onChange={(e) => setCompTagline(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-hidden"
                  />
                </div>
              )}
            </div>
          )}

          {/* STEP 3: TEMPLATE & THEME */}
          {currentStep === 3 && (
            <div className="space-y-4 animate-in fade-in">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider text-slate-500">
                Visual Experience & Template
              </h4>
              <div className="grid grid-cols-3 gap-3">
                {(['classic', 'modern', 'minimal'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setIndTheme(t)}
                    className={`p-4 rounded-2xl border text-center transition flex flex-col items-center justify-center space-y-2 ${
                      indTheme === t
                        ? 'border-teal-600 bg-teal-50/60 ring-2 ring-teal-500/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <Palette className={`w-5 h-5 ${indTheme === t ? 'text-teal-700' : 'text-slate-400'}`} />
                    <span className="text-xs font-bold capitalize text-slate-800">{t}</span>
                    <span className="text-[10px] text-slate-500">
                      {t === 'classic' ? 'Executive & formal' : t === 'modern' ? 'High-contrast vibrant' : 'Clean & typographic'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 4: PUBLIC SLUG & COLLISION CHECK */}
          {currentStep === 4 && (
            <div className="space-y-4 animate-in fade-in">
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider text-slate-500 mb-1">
                  Public Vanity URL Slug
                </h4>
                <p className="text-xs text-slate-500">
                  Select your reserved URL identifier. Tested against reserved routes, collisions, and brand takeover rules.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Public URL Slug *
                </label>
                <div className="flex items-center rounded-xl border border-slate-200 overflow-hidden focus-within:ring-2 focus-within:ring-teal-500/20 focus-within:border-teal-500">
                  <span className="px-3 py-2.5 bg-slate-50 text-slate-500 font-mono text-xs border-r border-slate-200 select-none">
                    dsbc.app/#{customerType === 'individual' ? 'card' : 'company'}/
                  </span>
                  <input
                    type="text"
                    value={activeSlug}
                    onChange={(e) => handleSlugChange(e.target.value)}
                    placeholder="your-identifier"
                    className="flex-1 px-3 py-2.5 text-xs font-mono font-medium outline-hidden"
                  />
                </div>

                {slugError ? (
                  <p className="mt-2 text-xs text-rose-600 flex items-center font-medium">
                    <AlertCircle className="w-3.5 h-3.5 mr-1" />
                    {slugError}
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-emerald-600 flex items-center font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                    URL identifier is valid and available for reservation.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* STEP 5: TIER SELECTION */}
          {currentStep === 5 && (
            <div className="space-y-4 animate-in fade-in">
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider text-slate-500 mb-1">
                  Select Commercial Plan
                </h4>
                <p className="text-xs text-slate-500">
                  Choose your customer subscription. Free plan includes core card. Pro plan unlocks custom URLs, unlimited items, and AI.
                </p>
              </div>

              {customerType === 'individual' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div
                    onClick={() => setIndPlan('individual_free')}
                    className={`p-4 rounded-2xl border cursor-pointer transition ${
                      indPlan === 'individual_free'
                        ? 'border-teal-600 bg-teal-50/50 ring-2 ring-teal-500/20'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">Individual Free</span>
                      <span className="text-xs font-black text-slate-900">₹0</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Essential digital business card with standard theme & vCard.
                    </p>
                  </div>

                  <div
                    onClick={() => setIndPlan('individual_pro')}
                    className={`p-4 rounded-2xl border cursor-pointer transition relative overflow-hidden ${
                      indPlan === 'individual_pro'
                        ? 'border-teal-600 bg-teal-50/50 ring-2 ring-teal-500/20'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">Individual Pro</span>
                      <span className="text-xs font-black text-teal-700">₹100 / year</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Custom URL slugs, unlimited items, AI card scanner, & analytics.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div
                    onClick={() => setCompPlan('company_free')}
                    className={`p-4 rounded-2xl border cursor-pointer transition ${
                      compPlan === 'company_free'
                        ? 'border-teal-600 bg-teal-50/50 ring-2 ring-teal-500/20'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">Company Free</span>
                      <span className="text-xs font-black text-slate-900">₹0</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Up to 3 team members, corporate mini-website, & directory.
                    </p>
                  </div>

                  <div
                    onClick={() => setCompPlan('company_pro')}
                    className={`p-4 rounded-2xl border cursor-pointer transition relative overflow-hidden ${
                      compPlan === 'company_pro'
                        ? 'border-teal-600 bg-teal-50/50 ring-2 ring-teal-500/20'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">Company Pro</span>
                      <span className="text-xs font-black text-teal-700">₹500 / year</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      25 employee seats, 5GB assets, custom domain, white-label, & AI.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 6: REVIEW & PUBLISH OR MAGIC MOMENT */}
          {currentStep === 6 && (
            <div className="space-y-4 animate-in fade-in">
              {publishSuccess ? (
                /* Customer Magic Moment (Directive 21 Section 8) */
                <div className="text-center py-4 space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200 shadow-xs">
                    <Sparkles className="w-7 h-7 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                      {customerType === 'individual'
                        ? 'Your Digital Identity is Published & Ready!'
                        : 'Your Company Mini-Website is Live!'}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                      Congratulations! Your digital presence has been provisioned and is now publicly accessible worldwide.
                    </p>
                    {planNotice && (
                      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mt-2 max-w-md mx-auto">
                        {planNotice}
                      </p>
                    )}
                  </div>

                  {/* Prominent Public URL Box */}
                  <div className="p-4 rounded-2xl bg-slate-900 text-white max-w-md mx-auto text-left space-y-2 shadow-sm">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-teal-400 block">
                      Your Official Public URL
                    </span>
                    <div className="font-mono text-sm font-bold text-slate-100 break-all select-all flex items-center justify-between">
                      <span>/{customerType === 'individual' ? 'card' : 'company'}/{publishedSlug || activeSlug}</span>
                    </div>
                  </div>

                  {/* Magic Moment Action CTAs */}
                  <div className="flex flex-wrap items-center justify-center gap-2.5 max-w-md mx-auto pt-2">
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold shadow-2xs transition flex items-center space-x-1.5"
                    >
                      {copiedLink ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700 font-bold">Link Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-500" />
                          <span>Copy Link</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleShare}
                      className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold shadow-2xs transition flex items-center space-x-1.5"
                    >
                      <Share2 className="w-3.5 h-3.5 text-slate-500" />
                      <span>Share</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        window.location.hash = `${customerType === 'individual' ? 'card' : 'company'}/${publishedSlug || activeSlug}`;
                      }}
                      className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs transition flex items-center space-x-1.5"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>{customerType === 'individual' ? 'View Public Page' : 'View Website'}</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Pre-publish Review with Preview */
                <>
                  <div className="p-4 rounded-2xl bg-teal-50/70 border border-teal-200/80 flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center space-x-2 text-teal-900 font-bold text-xs">
                        <CheckCircle2 className="w-4 h-4 text-teal-600" />
                        <span>
                          {customerType === 'individual'
                            ? 'Your Digital Identity is Ready'
                            : 'Your Company Website is Ready'}
                        </span>
                      </div>
                      <p className="text-xs text-teal-800 mt-1 leading-relaxed">
                        Review your identity details below. You can generate a live interactive preview or immediately publish to reserve your public URL.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handlePreview}
                      className="shrink-0 px-3.5 py-1.5 rounded-xl bg-white border border-teal-300 text-teal-800 hover:bg-teal-50 text-xs font-bold transition flex items-center space-x-1 shadow-2xs"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>{customerType === 'individual' ? 'Preview My Card' : 'Preview Website'}</span>
                    </button>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Identity:</span>
                      <span className="font-semibold text-slate-800">
                        {customerType === 'individual' ? indName : compName}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Target Public URL:</span>
                      <span className="font-mono font-bold text-teal-700">
                        /{customerType === 'individual' ? 'card' : 'company'}/{activeSlug}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Selected Tier:</span>
                      <span className="font-semibold text-slate-800 uppercase">
                        {(customerType === 'individual' ? indPlan : compPlan).replace('_', ' ')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Selected Visual Theme:</span>
                      <span className="font-semibold text-slate-800 capitalize">
                        {indTheme}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          {publishSuccess ? (
            <div className="w-full flex justify-end">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onPublishComplete) {
                    onPublishComplete(publishedSlug || activeSlug, customerType === 'individual' ? 'card' : 'company');
                  }
                }}
                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition"
              >
                Go to My Workspace Dashboard →
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={handleBack}
                disabled={currentStep === 1 || isPublishing}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-30 transition flex items-center space-x-1"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back
              </button>

              {currentStep < 6 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition flex items-center space-x-1.5 shadow-xs"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </button>
              ) : (
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={handlePreview}
                    disabled={isPublishing}
                    className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition flex items-center space-x-1.5"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>{customerType === 'individual' ? 'Preview Card' : 'Preview Website'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleFinalPublish}
                    disabled={isPublishing || !!slugError}
                    className="px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white text-xs font-bold transition flex items-center space-x-1.5 shadow-sm disabled:opacity-50"
                  >
                    {isPublishing ? (
                      <span>Publishing Live...</span>
                    ) : (
                      <span className="flex items-center">
                        <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                        {customerType === 'individual' ? 'Publish My Card' : 'Publish Website'}
                      </span>
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
