// ============================================================================
// DSBC PRODUCTION PUBLIC MARKETING & PRODUCT LANDING PAGE (Directive 21)
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  QrCode,
  Share2,
  ExternalLink,
  Shield,
  CreditCard,
  Building2,
  User,
  Users2,
  CheckCircle2,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Globe,
  Layers,
  Palette,
  BarChart3,
  Phone,
  Mail,
  Briefcase,
  HelpCircle,
  MessageSquare,
  Lock,
  Download,
  Check,
  Send,
  Sliders,
  Menu,
  X,
  Smartphone,
  Eye,
  Copy,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useEntitlement } from '../../context/EntitlementContext';
import { ThemeToggle } from '../common/ThemeToggle';
import { supportService, SupportCategory } from '../../services/supportService';
import { conversionFunnelService } from '../../services/conversionFunnelService';

interface PublicMarketingPageProps {
  onStartIndividual: () => void;
  onStartCompany: () => void;
  onNavigateToPricing: () => void;
  onOpenLogin: () => void;
  onGoToDashboard?: () => void;
}

export const PublicMarketingPage: React.FC<PublicMarketingPageProps> = ({
  onStartIndividual,
  onStartCompany,
  onNavigateToPricing,
  onOpenLogin,
  onGoToDashboard,
}) => {
  const { userProfile, role } = useAuth();
  const { plans } = useEntitlement();

  const [activeSection, setActiveSection] = useState<'home' | 'features' | 'individual' | 'company' | 'pricing' | 'how-it-works' | 'faq' | 'contact'>('home');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Interactive Card Mockup Toggle
  const [mockupTab, setMockupTab] = useState<'individual' | 'company'>('individual');
  const [copiedLink, setCopiedLink] = useState(false);

  // Support Form State
  const [supportName, setSupportName] = useState(userProfile?.displayName || '');
  const [supportEmail, setSupportEmail] = useState(userProfile?.email || '');
  const [supportCategory, setSupportCategory] = useState<SupportCategory>('HELP');
  const [supportSubject, setSupportSubject] = useState('');
  const [supportMessage, setSupportMessage] = useState('');
  const [supportSubmitted, setSupportSubmitted] = useState(false);

  // FAQ Accordion State
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);

  useEffect(() => {
    conversionFunnelService.trackEvent('LANDING_VIEWED', 'visitor');
  }, []);

  const handleSupportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supportName.trim() || !supportEmail.trim() || !supportSubject.trim() || !supportMessage.trim()) {
      return;
    }

    supportService.createTicket({
      name: supportName,
      email: supportEmail,
      category: supportCategory,
      subject: supportSubject,
      message: supportMessage,
      customerType: userProfile ? (role === 'company_admin' ? 'company' : 'individual') : 'visitor',
    });

    setSupportSubmitted(true);
    setTimeout(() => {
      setSupportSubject('');
      setSupportMessage('');
      setSupportSubmitted(false);
    }, 4000);
  };

  const handleMockupCopy = () => {
    const slug = mockupTab === 'individual' ? 'rahul-sharma' : 'acme-innovations';
    const type = mockupTab === 'individual' ? 'card' : 'company';
    navigator.clipboard.writeText(`${window.location.origin}/#/${type}/${slug}`);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const scrollTo = (id: string) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const faqItems = [
    {
      q: 'How does sharing a DSBC digital card work?',
      a: 'Recipients do not need an app or account. You can share your personal QR code for instant camera scanning, tap via NFC-enabled tags, export a standard vCard 3.0 file directly to contact books, or share your vanity public URL (/card/your-name).',
    },
    {
      q: 'What is the difference between an Individual Card and a Company Mini-Website?',
      a: 'Individual Cards are built for creators, solo consultants, and professionals desiring an executive digital card and portfolio. Company Mini-Websites provide organizations with a branded multi-page portal, product/service showcases, and a centralized team directory issuing branded employee cards.',
    },
    {
      q: 'Can my company administer all employee cards from one dashboard?',
      a: 'Yes. Company administrators can provision, edit, brand-govern, and revoke cards across all team members, set department affiliations, and view aggregated organizational relationship analytics.',
    },
    {
      q: 'What happens to my data if I downgrade from Pro to Free?',
      a: 'Zero Data Loss Guarantee. Your portfolio items, testimonials, and services are NEVER deleted upon downgrade. They are safely preserved under quota locks and reactivate immediately if you upgrade.',
    },
    {
      q: 'Can I use custom public vanity URLs?',
      a: 'Yes. Every published entity receives collision-protected, reserved URLs such as /card/your-name or /company/your-brand, with built-in protection against route collisions and brand takeovers.',
    },
  ];

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-teal-500/20">
      {/* Top Notification Bar if User is Authenticated */}
      {userProfile && (
        <div className="bg-slate-900 text-slate-200 px-4 py-2 text-xs flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>
              Signed in as <strong className="text-white">{userProfile.displayName}</strong> ({role?.replace('_', ' ')})
            </span>
          </div>
          {onGoToDashboard && (
            <button
              onClick={onGoToDashboard}
              className="px-3 py-1 bg-teal-600 hover:bg-teal-500 text-white font-semibold rounded-lg text-[11px] transition shadow-2xs"
            >
              Go to Workspace Dashboard →
            </button>
          )}
        </div>
      )}

      {/* Global Public Navigation Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-100 transition">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => scrollTo('home')}>
            <div className="w-10 h-10 rounded-2xl bg-teal-800 text-white flex items-center justify-center font-black text-sm shadow-xs tracking-tight">
              DS
            </div>
            <div>
              <span className="text-base font-extrabold tracking-tight text-slate-900 block leading-tight">
                DSBC
              </span>
              <span className="text-[10px] font-semibold text-teal-700 tracking-wider uppercase block">
                Digital Business Card & Mini-Website
              </span>
            </div>
          </div>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center space-x-7 text-xs font-semibold text-slate-600">
            <button onClick={() => scrollTo('features')} className="hover:text-teal-700 transition">
              Features
            </button>
            <button onClick={() => scrollTo('individual')} className="hover:text-teal-700 transition">
              Individual
            </button>
            <button onClick={() => scrollTo('company')} className="hover:text-teal-700 transition">
              Company
            </button>
            <button onClick={() => scrollTo('how-it-works')} className="hover:text-teal-700 transition">
              How It Works
            </button>
            <button onClick={() => scrollTo('pricing')} className="hover:text-teal-700 transition">
              Pricing
            </button>
            <button onClick={() => scrollTo('faq')} className="hover:text-teal-700 transition">
              FAQ
            </button>
            <button onClick={() => scrollTo('contact')} className="hover:text-teal-700 transition">
              Support
            </button>
          </nav>

          {/* Right Action CTAs */}
          <div className="hidden sm:flex items-center space-x-3">
            <ThemeToggle variant="icon" />

            {userProfile ? (
              <button
                onClick={onGoToDashboard}
                className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-xs flex items-center space-x-1.5"
              >
                <span>My Dashboard</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <>
                <button
                  onClick={onOpenLogin}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:text-slate-900 transition"
                >
                  Sign In
                </button>
                <button
                  onClick={onStartIndividual}
                  className="px-4 py-2.5 rounded-xl bg-teal-800 hover:bg-teal-900 text-white text-xs font-bold transition shadow-xs flex items-center space-x-1.5"
                >
                  <span>Get Started</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="flex items-center space-x-2 md:hidden">
            <ThemeToggle variant="icon" />
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-slate-600 rounded-xl hover:bg-slate-100"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-slate-200 bg-white px-4 pt-3 pb-6 space-y-3 shadow-lg">
            <div className="grid grid-cols-2 gap-2 text-xs font-semibold text-slate-700">
              <button
                onClick={() => scrollTo('features')}
                className="p-2.5 rounded-lg text-left hover:bg-slate-50"
              >
                Features
              </button>
              <button
                onClick={() => scrollTo('individual')}
                className="p-2.5 rounded-lg text-left hover:bg-slate-50"
              >
                Individual
              </button>
              <button
                onClick={() => scrollTo('company')}
                className="p-2.5 rounded-lg text-left hover:bg-slate-50"
              >
                Company
              </button>
              <button
                onClick={() => scrollTo('how-it-works')}
                className="p-2.5 rounded-lg text-left hover:bg-slate-50"
              >
                How It Works
              </button>
              <button
                onClick={() => scrollTo('pricing')}
                className="p-2.5 rounded-lg text-left hover:bg-slate-50"
              >
                Pricing
              </button>
              <button
                onClick={() => scrollTo('faq')}
                className="p-2.5 rounded-lg text-left hover:bg-slate-50"
              >
                FAQ
              </button>
              <button
                onClick={() => scrollTo('contact')}
                className="p-2.5 rounded-lg text-left hover:bg-slate-50"
              >
                Contact
              </button>
            </div>

            <div className="pt-3 border-t border-slate-100 flex flex-col space-y-2">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onStartIndividual();
                }}
                className="w-full py-2.5 rounded-xl bg-teal-800 text-white font-bold text-xs shadow-xs text-center"
              >
                Create My Free Card
              </button>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onStartCompany();
                }}
                className="w-full py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs shadow-xs text-center"
              >
                Create Company Profile
              </button>
            </div>
          </div>
        )}
      </header>

      {/* 1. HERO SECTION (Directive 21 Section 2) */}
      <section id="home" className="relative pt-12 pb-20 md:pt-20 md:pb-28 overflow-hidden bg-gradient-to-b from-slate-50/70 via-white to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            {/* Left Messaging */}
            <div className="lg:col-span-7 space-y-6 text-left">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-teal-50 border border-teal-200/80 text-teal-800 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                <span>Next-Gen Enterprise Digital Identity</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-950 tracking-tight leading-[1.08]">
                Your Digital Identity.{' '}
                <span className="text-teal-800 underline decoration-teal-300/60 decoration-wavy decoration-2">
                  Your Business Card.
                </span>{' '}
                Your Mini Website.
              </h1>

              <p className="text-base sm:text-lg text-slate-600 max-w-2xl leading-relaxed">
                Empower your professional presence with dynamic digital business cards, interactive portfolio showcases, and corporate mini-websites. Share instantly with QR codes, NFC, and vanity links—zero app install required for recipients.
              </p>

              {/* Primary CTAs (Directive 21 Section 2) */}
              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <button
                  onClick={onStartIndividual}
                  className="px-6 py-3.5 rounded-2xl bg-teal-800 hover:bg-teal-900 active:bg-teal-950 text-white text-sm font-bold shadow-md hover:shadow-lg transition flex items-center justify-center space-x-2"
                >
                  <User className="w-4 h-4" />
                  <span>Create My Free Card</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </button>

                <button
                  onClick={onStartCompany}
                  className="px-6 py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white text-sm font-bold shadow-sm transition flex items-center justify-center space-x-2"
                >
                  <Building2 className="w-4 h-4" />
                  <span>Create Company Profile</span>
                </button>

                <button
                  onClick={onNavigateToPricing}
                  className="px-5 py-3.5 rounded-2xl border border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold transition flex items-center justify-center space-x-1"
                >
                  <span>View Pricing</span>
                </button>
              </div>

              {/* Trust Indicators */}
              <div className="pt-6 flex flex-wrap items-center gap-6 text-xs text-slate-500 font-medium">
                <span className="flex items-center">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 mr-1.5" /> Free forever baseline
                </span>
                <span className="flex items-center">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 mr-1.5" /> Ready in 2 minutes
                </span>
                <span className="flex items-center">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 mr-1.5" /> Enterprise tenant isolation
                </span>
              </div>
            </div>

            {/* Right: Live Interactive Card Mockup */}
            <div className="lg:col-span-5 flex justify-center">
              <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl border border-slate-200/90 overflow-hidden relative">
                {/* Mockup Header Switcher */}
                <div className="bg-slate-100 p-2 border-b border-slate-200 flex rounded-t-3xl text-xs font-bold text-slate-600">
                  <button
                    onClick={() => setMockupTab('individual')}
                    className={`flex-1 py-1.5 rounded-xl transition ${
                      mockupTab === 'individual'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'hover:text-slate-900'
                    }`}
                  >
                    Individual Card
                  </button>
                  <button
                    onClick={() => setMockupTab('company')}
                    className={`flex-1 py-1.5 rounded-xl transition ${
                      mockupTab === 'company'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'hover:text-slate-900'
                    }`}
                  >
                    Company Website
                  </button>
                </div>

                {/* Mockup Live Content */}
                {mockupTab === 'individual' ? (
                  <div className="p-6 space-y-4 text-left">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-14 h-14 rounded-2xl bg-teal-800 text-white flex items-center justify-center font-bold text-xl shadow-xs">
                          RS
                        </div>
                        <div>
                          <div className="flex items-center space-x-1.5">
                            <h3 className="text-sm font-bold text-slate-900">Rahul Sharma</h3>
                            <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
                          </div>
                          <p className="text-xs text-slate-500">VP of Technology</p>
                          <p className="text-[11px] text-teal-700 font-medium">Acme Innovations</p>
                        </div>
                      </div>

                      <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                        <QrCode className="w-6 h-6 text-slate-700" />
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed">
                      Leading digital architecture and SaaS solutions for enterprise clients worldwide.
                    </p>

                    {/* Contact Pills */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 flex items-center space-x-2 text-slate-700">
                        <Mail className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                        <span className="truncate">rahul@acme.example</span>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 flex items-center space-x-2 text-slate-700">
                        <Phone className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                        <span className="truncate">+91 98765 43210</span>
                      </div>
                    </div>

                    {/* Action Bar */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                      <button
                        onClick={handleMockupCopy}
                        className="flex items-center space-x-1 text-slate-600 hover:text-slate-900 font-semibold"
                      >
                        {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedLink ? 'Copied' : 'Share URL'}</span>
                      </button>

                      <a
                        href="/#/card/rahul-sharma"
                        className="flex items-center space-x-1 text-teal-700 hover:text-teal-800 font-bold"
                      >
                        <span>View Live Card</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 space-y-4 text-left">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-14 h-14 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-bold text-xl shadow-xs">
                          AI
                        </div>
                        <div>
                          <div className="flex items-center space-x-1.5">
                            <h3 className="text-sm font-bold text-slate-900">Acme Innovations</h3>
                            <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
                          </div>
                          <p className="text-xs text-slate-500">Enterprise Cloud & Digital Solutions</p>
                          <span className="text-[10px] font-mono text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded">
                            Verified Organization
                          </span>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed">
                      Empowering digital transformations with end-to-end cloud engineering and SaaS platforms.
                    </p>

                    {/* Team Preview Loop */}
                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                        <span>Corporate Team Directory</span>
                        <span className="text-teal-700">3 Verified Members</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-7 h-7 rounded-full bg-teal-800 text-white flex items-center justify-center text-[10px] font-bold">
                          RS
                        </div>
                        <div className="w-7 h-7 rounded-full bg-indigo-700 text-white flex items-center justify-center text-[10px] font-bold">
                          PP
                        </div>
                        <div className="w-7 h-7 rounded-full bg-slate-700 text-white flex items-center justify-center text-[10px] font-bold">
                          MV
                        </div>
                        <span className="text-[10px] text-slate-500">+ Clickable cards</span>
                      </div>
                    </div>

                    {/* Action Bar */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                      <a
                        href="/#/company/acme-innovations"
                        className="flex items-center space-x-1 text-teal-700 hover:text-teal-800 font-bold"
                      >
                        <span>View Company Website</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. CORE FEATURES GRID */}
      <section id="features" className="py-20 bg-white border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-3 mb-16">
            <span className="text-xs font-bold uppercase tracking-wider text-teal-700">
              Modern Relationship Infrastructure
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Everything Needed to Connect & Convert
            </h2>
            <p className="text-sm text-slate-500">
              Engineered for seamless contact exchange, high-impact presentation, and enterprise-grade tenant privacy.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200/80 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
                <QrCode className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">QR Code & NFC Sharing</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Instant contactless sharing. Camera scanning opens your verified profile directly in mobile Safari or Chrome without installing third-party apps.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200/80 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
                <Briefcase className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Full Interactive Profiles</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Go far beyond static paper cards. Showcase rich services, visual portfolio galleries, customer testimonials, and direct appointment links.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200/80 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
                <Globe className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Corporate Mini-Websites</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Give your organization a dedicated digital portal (/company/brand) featuring company story, product catalogs, and verified team members.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200/80 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
                <Users2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Contact Exchange & Leads</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Two-way contact exchange lets visitors leave their contact details in seconds, syncing automatically into your unified relationship pipeline.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200/80 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
                <BarChart3 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Real-Time Analytics</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Track view counts, link clicks, contact downloads, and attribution metrics so you always know who is engaging with your card.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200/80 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
                <Shield className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Multi-Tenant Zero-Trust</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Certified with 141+ live Firestore security tests. Foreign tenants cannot read your private invoices, team records, or relationship logs.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. INDIVIDUAL PRODUCT LANDING (Directive 21 Section 3) */}
      <section id="individual" className="py-20 bg-slate-50/70 border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-6 space-y-6 text-left">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-teal-100/70 text-teal-900 text-xs font-bold">
                <User className="w-3.5 h-3.5 text-teal-700" />
                <span>For Independent Professionals & Creators</span>
              </div>

              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                Turn Every Interaction into an Opportunity
              </h2>

              <p className="text-sm text-slate-600 leading-relaxed">
                Whether at a conference, networking dinner, or client consultation, your DSBC card ensures you always leave a lasting, professional impression.
              </p>

              <div className="space-y-3 text-xs text-slate-700">
                <div className="flex items-center space-x-2.5">
                  <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                  <span><strong>Digital Business Card:</strong> Clean, responsive card with one-touch phone, email, and socials.</span>
                </div>
                <div className="flex items-center space-x-2.5">
                  <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                  <span><strong>Full Professional Profile:</strong> Bio, education, career history, and interactive portfolio gallery.</span>
                </div>
                <div className="flex items-center space-x-2.5">
                  <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                  <span><strong>vCard 3.0 Export:</strong> Recipients tap once to save your complete contact card directly to iOS or Android.</span>
                </div>
                <div className="flex items-center space-x-2.5">
                  <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                  <span><strong>Custom Public Vanity URL:</strong> Claim your personal handle like <code className="bg-slate-200 px-1 py-0.5 rounded font-mono">/card/your-name</code>.</span>
                </div>
                <div className="flex items-center space-x-2.5">
                  <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                  <span><strong>Themes & Appearance:</strong> Classic Executive, Modern Vibrant, and Minimal Typographic presets.</span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={onStartIndividual}
                  className="px-6 py-3.5 rounded-2xl bg-teal-800 hover:bg-teal-900 text-white text-xs font-bold shadow-xs transition flex items-center space-x-2"
                >
                  <span>Create Free Card</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </button>
              </div>
            </div>

            <div className="lg:col-span-6 flex justify-center">
              <div className="p-8 bg-white rounded-3xl border border-slate-200/90 shadow-lg max-w-md w-full space-y-6 text-left">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Card Features Matrix</h4>
                    <p className="text-[11px] text-slate-500">Individual Free vs Individual Pro</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
                    Live Engine
                  </span>
                </div>

                <div className="space-y-3 text-xs divide-y divide-slate-100">
                  <div className="pt-2 flex justify-between items-center">
                    <span className="text-slate-700">Digital Business Card</span>
                    <span className="font-semibold text-emerald-700">Included (Free)</span>
                  </div>
                  <div className="pt-2 flex justify-between items-center">
                    <span className="text-slate-700">QR Code & vCard Export</span>
                    <span className="font-semibold text-emerald-700">Included (Free)</span>
                  </div>
                  <div className="pt-2 flex justify-between items-center">
                    <span className="text-slate-700">Custom Public URL</span>
                    <span className="font-semibold text-teal-800">Pro (₹100/yr)</span>
                  </div>
                  <div className="pt-2 flex justify-between items-center">
                    <span className="text-slate-700">Full Profile & Portfolio</span>
                    <span className="font-semibold text-teal-800">Pro (Unlimited)</span>
                  </div>
                  <div className="pt-2 flex justify-between items-center">
                    <span className="text-slate-700">Click & Engagement Analytics</span>
                    <span className="font-semibold text-teal-800">Pro</span>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-teal-50/60 border border-teal-100 text-xs text-teal-900 leading-relaxed">
                  Start with Free forever. Upgrade at any time to unlock custom URLs and rich portfolio galleries.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. COMPANY PRODUCT LANDING & ECOSYSTEM (Directive 21 Section 4 & 11) */}
      <section id="company" className="py-20 bg-white border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-6 order-2 lg:order-1 flex justify-center">
              {/* Relationship Loop Diagram (Directive 21 Section 4 & 11) */}
              <div className="p-6 bg-slate-900 text-white rounded-3xl shadow-xl max-w-md w-full space-y-4 text-left">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <span className="text-xs font-bold text-teal-400 uppercase tracking-wider">
                    Ecosystem Identity Loop
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">Bidirectional Routing</span>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Building2 className="w-4 h-4 text-teal-400" />
                      <span className="font-bold">1. Company Mini-Website</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">/company/acme</span>
                  </div>

                  <div className="flex justify-center text-teal-400 text-xs font-mono">↓ Directory Browse</div>

                  <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Users2 className="w-4 h-4 text-indigo-400" />
                      <span className="font-bold">2. Verified Team Directory</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">Team List</span>
                  </div>

                  <div className="flex justify-center text-teal-400 text-xs font-mono">↓ Click Member</div>

                  <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <User className="w-4 h-4 text-emerald-400" />
                      <span className="font-bold">3. Employee Digital Card</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">/card/rahul</span>
                  </div>

                  <div className="flex justify-center text-teal-400 text-xs font-mono">↑ One-Tap Back to Company Profile</div>
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed pt-2 border-t border-slate-800">
                  Every employee card directly reinforces your parent corporate brand while preserving individual professional identity.
                </p>
              </div>
            </div>

            <div className="lg:col-span-6 order-1 lg:order-2 space-y-6 text-left">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-slate-100 text-slate-900 text-xs font-bold">
                <Building2 className="w-3.5 h-3.5 text-teal-700" />
                <span>For Teams, SMEs & Enterprise Organizations</span>
              </div>

              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                Unified Brand Theming & Scalable Team Management
              </h2>

              <p className="text-sm text-slate-600 leading-relaxed">
                Give your entire sales, consulting, or leadership team branded digital cards with centralized control, automatic directory publishing, and unified inbound lead capture.
              </p>

              <div className="space-y-3 text-xs text-slate-700">
                <div className="flex items-center space-x-2.5">
                  <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                  <span><strong>Centralized Employee Card Issuance:</strong> Provision verified digital cards in seconds.</span>
                </div>
                <div className="flex items-center space-x-2.5">
                  <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                  <span><strong>Company Mini-Website:</strong> Brand-controlled public website with company history, products, and contact info.</span>
                </div>
                <div className="flex items-center space-x-2.5">
                  <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                  <span><strong>Inbound Lead Pipeline:</strong> Centralize relationships and leads captured across all team cards.</span>
                </div>
                <div className="flex items-center space-x-2.5">
                  <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                  <span><strong>Brand Identity Governance:</strong> Lock company logos, hex color palettes, and compliance disclaimers.</span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={onStartCompany}
                  className="px-6 py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition flex items-center space-x-2"
                >
                  <span>Create Free Company Profile</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. HOW IT WORKS */}
      <section id="how-it-works" className="py-20 bg-slate-50/70 border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto space-y-3 mb-16">
            <span className="text-xs font-bold uppercase tracking-wider text-teal-700">
              Zero Friction Setup
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Ready in 3 Simple Steps
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
            <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-3">
              <div className="w-10 h-10 rounded-2xl bg-teal-800 text-white flex items-center justify-center font-bold text-sm">
                1
              </div>
              <h3 className="text-base font-bold text-slate-900">Choose Your Workspace</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Select Individual for personal branding or Company to manage an organization with multiple employee cards.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-3">
              <div className="w-10 h-10 rounded-2xl bg-teal-800 text-white flex items-center justify-center font-bold text-sm">
                2
              </div>
              <h3 className="text-base font-bold text-slate-900">Configure in 2 Minutes</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Use our guided First-Run Onboarding Wizard with real-time profile completion scoring and live preview.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-3">
              <div className="w-10 h-10 rounded-2xl bg-teal-800 text-white flex items-center justify-center font-bold text-sm">
                3
              </div>
              <h3 className="text-base font-bold text-slate-900">Publish & Share Anywhere</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Receive your reserved public URL (/card/slug) and downloadable QR code. Share instantly anywhere in the world.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. CONFIGURATION-DRIVEN PRICING (Directive 21 Section 5) */}
      <section id="pricing" className="py-20 bg-white border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-3 mb-16">
            <span className="text-xs font-bold uppercase tracking-wider text-teal-700">
              Authoritative Commercial Tiers
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Transparent, Value-Focused Pricing
            </h2>
            <p className="text-sm text-slate-500">
              100% configuration-driven from the SaaS Entitlement Engine. No hidden fees. Non-destructive downgrade protection.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 text-left">
            {plans.map((plan) => {
              const isPro = plan.id.includes('pro');
              const isComp = plan.targetType === 'company';
              const isEnterprise = plan.id === 'custom_enterprise';

              return (
                <div
                  key={plan.id}
                  className={`p-6 rounded-3xl border flex flex-col justify-between transition ${
                    isPro
                      ? 'border-teal-700 bg-teal-50/20 shadow-md ring-1 ring-teal-500/20'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        {plan.targetType}
                      </span>
                      {isPro && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800">
                          POPULAR
                        </span>
                      )}
                    </div>

                    <div>
                      <h3 className="text-lg font-bold text-slate-900">{plan.name}</h3>
                      <div className="mt-2 flex items-baseline">
                        <span className="text-3xl font-black text-slate-900">
                          {plan.price === 0 ? '₹0' : `₹${plan.price}`}
                        </span>
                        <span className="text-xs text-slate-500 ml-1">
                          {plan.price === 0 ? '/ forever' : `/${plan.billingCycle || 'yr'}`}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-500 leading-relaxed">
                      {plan.description}
                    </p>

                    <div className="pt-3 border-t border-slate-100 space-y-2 text-xs">
                      {Object.entries(plan.features)
                        .filter(([_, rule]) => rule.status !== 'DISABLED')
                        .slice(0, 5)
                        .map(([featId, rule]) => (
                          <div key={featId} className="flex items-center space-x-2 text-slate-700">
                            <Check className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                            <span className="truncate">
                              {featId.replace(/^(individual|company)\./, '').replace(/_/g, ' ')}
                              {rule.limit ? ` (Max: ${rule.limit})` : ''}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>

                  <div className="pt-6">
                    <button
                      onClick={() => (isComp ? onStartCompany() : onStartIndividual())}
                      className={`w-full py-2.5 rounded-xl font-bold text-xs transition shadow-2xs ${
                        isPro
                          ? 'bg-teal-800 hover:bg-teal-900 text-white'
                          : 'bg-slate-900 hover:bg-slate-800 text-white'
                      }`}
                    >
                      {plan.price === 0 ? 'Start Free' : 'Choose Plan'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-10 text-center">
            <button
              onClick={onNavigateToPricing}
              className="inline-flex items-center space-x-1.5 text-xs font-bold text-teal-700 hover:text-teal-800 hover:underline"
            >
              <span>View Complete Feature Comparison & Quota Matrix</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* 7. FAQ ACCORDION SECTION */}
      <section id="faq" className="py-20 bg-slate-50/70 border-t border-slate-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-3 mb-12">
            <span className="text-xs font-bold uppercase tracking-wider text-teal-700">
              Frequently Asked Questions
            </span>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">
              Got Questions? We Have Answers.
            </h2>
          </div>

          <div className="space-y-3">
            {faqItems.map((item, index) => {
              const isOpen = expandedFaq === index;
              return (
                <div
                  key={index}
                  className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden transition"
                >
                  <button
                    onClick={() => setExpandedFaq(isOpen ? null : index)}
                    className="w-full p-4 sm:p-5 flex items-center justify-between text-left font-bold text-slate-900 text-xs sm:text-sm hover:bg-slate-50/60"
                  >
                    <span>{item.q}</span>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 text-xs text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 8. SUPPORT & CONTACT (Directive 21 Section 14) */}
      <section id="contact" className="py-20 bg-white border-t border-slate-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-3 mb-10">
            <span className="text-xs font-bold uppercase tracking-wider text-teal-700">
              Customer Support Foundation
            </span>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">
              Need Help or Have a Question?
            </h2>
            <p className="text-sm text-slate-500">
              Our operations team responds quickly to support tickets, enterprise inquiries, and bug reports.
            </p>
          </div>

          <form onSubmit={handleSupportSubmit} className="p-8 rounded-3xl bg-slate-50 border border-slate-200 space-y-4 text-left">
            {supportSubmitted && (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Ticket submitted successfully! Our support engineering team will reach out promptly.</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Your Name *</label>
                <input
                  type="text"
                  required
                  value={supportName}
                  onChange={(e) => setSupportName(e.target.value)}
                  placeholder="e.g. Priya Sharma"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={supportEmail}
                  onChange={(e) => setSupportEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-hidden"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Inquiry Category *</label>
                <select
                  value={supportCategory}
                  onChange={(e) => setSupportCategory(e.target.value as SupportCategory)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-hidden"
                >
                  <option value="HELP">General Help</option>
                  <option value="FAQ">Product FAQ</option>
                  <option value="CONTACT_SUPPORT">Contact Support</option>
                  <option value="REPORT_PROBLEM">Report a Problem</option>
                  <option value="ENTERPRISE_INQUIRY">Enterprise Custom Inquiry</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Subject *</label>
                <input
                  type="text"
                  required
                  value={supportSubject}
                  onChange={(e) => setSupportSubject(e.target.value)}
                  placeholder="Brief summary of your question"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Message Details *</label>
              <textarea
                rows={4}
                required
                value={supportMessage}
                onChange={(e) => setSupportMessage(e.target.value)}
                placeholder="Describe your inquiry or the assistance you need..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-hidden"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-teal-800 hover:bg-teal-900 text-white font-bold text-xs transition shadow-xs flex items-center justify-center space-x-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Submit Support Request</span>
            </button>
          </form>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-slate-900 text-slate-400 text-xs border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold text-[10px]">
              DS
            </div>
            <span className="font-semibold text-white">Digital Business Card & Mini-Website SaaS</span>
          </div>

          <div className="flex items-center space-x-4">
            <button onClick={() => scrollTo('features')} className="hover:text-white transition">Features</button>
            <button onClick={() => scrollTo('pricing')} className="hover:text-white transition">Pricing</button>
            <button onClick={() => scrollTo('faq')} className="hover:text-white transition">FAQ</button>
            <button onClick={() => scrollTo('contact')} className="hover:text-white transition">Support</button>
          </div>

          <p className="text-[11px] text-slate-500">
            © 2026 DSBC Platform. Enterprise Certified Production Release.
          </p>
        </div>
      </footer>
    </div>
  );
};
