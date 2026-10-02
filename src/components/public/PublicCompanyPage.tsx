import React, { useEffect, useState, useRef } from 'react';
import { Company, Employee, Department, Card } from '../../types';
import { ResolvedCompanyWebsite, CompanyServiceItem } from '../../types/companyProfile';
import { resolveCompanyWebsiteProfile } from '../../services/companyProfileResolver';
import { publicResolver } from '../../services/publicResolver';
import { callBackend } from '../../lib/backend';
import { sanitizeUrl, sanitizePhoneHref, sanitizeMailtoHref, sanitizeWhatsAppHref } from '../../lib/securityUtils';
import { ThemeToggle } from '../common/ThemeToggle';
import {
  Building2,
  ShieldCheck,
  MapPin,
  Users,
  Calendar,
  Globe,
  Phone,
  Mail,
  MessageSquare,
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  CheckCircle2,
  Sparkles,
  Layers,
  Award,
  Download,
  Share2,
  Menu,
  X,
  Linkedin,
  Twitter,
  Github,
  Youtube,
  Send,
  Search,
  Briefcase,
  Star,
  Quote,
  Clock,
  Check,
  Compass,
  Anchor,
  FileCheck,
  Shield,
  Lightbulb,
} from 'lucide-react';

interface PublicCompanyPageProps {
  companySlug: string;
  onBackToApp?: () => void;
  onBackToCard?: (cardSlug?: string) => void;
  isAdminPreview?: boolean;
}

export const PublicCompanyPage: React.FC<PublicCompanyPageProps> = ({
  companySlug,
  onBackToApp,
  onBackToCard,
  isAdminPreview = false,
}) => {
  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState<Company | null>(null);
  const [resolvedWebsite, setResolvedWebsite] = useState<ResolvedCompanyWebsite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [publishingIssue, setPublishingIssue] = useState<'DRAFT' | 'UNPUBLISHED' | 'SUSPENDED' | null>(null);

  // Active section scroll spy state
  const [activeTab, setActiveTab] = useState<string>('home');
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  // Lead Enquiry Form State
  const [enquiryName, setEnquiryName] = useState('');
  const [enquiryEmail, setEnquiryEmail] = useState('');
  const [enquiryPhone, setEnquiryPhone] = useState('');
  const [enquiryCompany, setEnquiryCompany] = useState('');
  const [enquiryService, setEnquiryService] = useState('');
  const [enquiryMessage, setEnquiryMessage] = useState('');
  const [isSubmittingEnquiry, setIsSubmittingEnquiry] = useState(false);
  const [enquirySubmitted, setEnquirySubmitted] = useState(false);

  const contactSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadCompanyData() {
      setLoading(true);
      setError(null);
      setPublishingIssue(null);
      // Directive 26: the backend resolves the website (published, visible
      // content of one tenant; team = employees with a published card).
      // There is no demo-data fallback for a customer URL.
      const r = await publicResolver.company(companySlug, isAdminPreview);
      if (!isMounted) return;
      if (r.outcome === 'OK') {
        setCompany(r.company!);
        setResolvedWebsite(resolveCompanyWebsiteProfile(r.company!, r.employees ?? [], r.departments ?? [], r.cards ?? []));
      } else if (r.outcome === 'NOT_PUBLISHED') {
        setPublishingIssue('DRAFT');
      } else if (r.outcome === 'UNAVAILABLE') {
        setPublishingIssue('SUSPENDED');
      } else if (r.outcome === 'ERROR') {
        setError('This website could not be loaded right now. Please try again.');
      } else {
        setError('Company not found');
      }
      setLoading(false);
    }

    if (companySlug) {
      loadCompanyData();
    }
    return () => {
      isMounted = false;
    };
  }, [companySlug, isAdminPreview]);

  const scrollToSection = (sectionId: string) => {
    setActiveTab(sectionId);
    setIsMenuOpen(false);
    const element = document.getElementById(`section-${sectionId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleEnquireService = (serviceTitle: string) => {
    setEnquiryService(serviceTitle);
    scrollToSection('contact');
  };

  const handleCopyShareLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    });
  };

  const handleDownloadCompanyVCard = () => {
    if (!resolvedWebsite) return;
    const vCardLines = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `ORG:${resolvedWebsite.name}`,
      `FN:${resolvedWebsite.name}`,
      `NOTE:${resolvedWebsite.tagline}`,
      `TEL;TYPE=WORK,VOICE:${resolvedWebsite.phone}`,
      `EMAIL;TYPE=PREF,INTERNET:${resolvedWebsite.email}`,
      `ADR;TYPE=WORK:;;${resolvedWebsite.address};;;;`,
      `URL:${resolvedWebsite.website}`,
      'END:VCARD',
    ];
    const blob = new Blob([vCardLines.join('\r\n')], { type: 'text/vcard;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${resolvedWebsite.companySlug}-corporate-contact.vcf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSubmitEnquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company || !resolvedWebsite) return;
    setIsSubmittingEnquiry(true);

    try {
      // Directive 26: the backend writes the lead into this company's CRM; the
      // visitor never chooses the tenant (it follows from the public slug).
      await callBackend('submitPublicLead', {
        companySlug,
        name: enquiryName.trim(),
        email: enquiryEmail.trim(),
        ...(enquiryPhone.trim() ? { phone: enquiryPhone.trim() } : {}),
        ...(enquiryCompany.trim() ? { organization: enquiryCompany.trim() } : {}),
        ...(enquiryService.trim() ? { interest: enquiryService.trim() } : {}),
        message: enquiryMessage.trim() || 'Enquiry from the company website.',
      });

      setEnquirySubmitted(true);
      setEnquiryName('');
      setEnquiryEmail('');
      setEnquiryPhone('');
      setEnquiryCompany('');
      setEnquiryService('');
      setEnquiryMessage('');
    } catch (err) {
      console.error('Error submitting enquiry lead:', err);
      alert('Unable to submit enquiry at this time. Please try calling or emailing directly.');
    } finally {
      setIsSubmittingEnquiry(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 border-3 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Loading Company Mini-Website...
        </p>
      </div>
    );
  }

  if (publishingIssue === 'SUSPENDED') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-slate-100">
        <div className="max-w-md w-full p-8 bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto mb-4 border border-amber-500/20">
            <Shield className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold text-white">Organization Suspended</h1>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed">
            Public access to this company mini-website has been suspended by platform administration.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            {onBackToApp && (
              <button
                onClick={onBackToApp}
                className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold border border-slate-700 transition"
              >
                <ArrowLeft className="w-4 h-4 mr-1.5" /> Return to Platform
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (publishingIssue === 'DRAFT' || publishingIssue === 'UNPUBLISHED') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-slate-100">
        <div className="max-w-md w-full p-8 bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl text-center">
          <div className="w-14 h-14 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center mx-auto mb-4 border border-blue-500/20">
            <Building2 className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold text-white">Company Profile in Draft</h1>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed">
            This corporate mini-website has not yet been published by company administration.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            {onBackToApp && (
              <button
                onClick={onBackToApp}
                className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold border border-slate-700 transition"
              >
                <ArrowLeft className="w-4 h-4 mr-1.5" /> Return to Platform
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (error || !company || !resolvedWebsite) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-slate-100">
        <div className="max-w-md w-full p-8 bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl text-center">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto mb-4 border border-rose-500/20">
            <Search className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold text-white">Company Profile Not Found</h1>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed">
            The requested organization &quot;{companySlug}&quot; could not be located. The link may
            be incorrect or the company identifier has been modified.
          </p>

          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            {onBackToApp && (
              <button
                onClick={onBackToApp}
                className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold border border-slate-700 transition"
              >
                <ArrowLeft className="w-4 h-4 mr-1.5" /> Return to Platform
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const navTabs = [
    { id: 'home', label: 'Home' },
    { id: 'about', label: 'About' },
    { id: 'services', label: 'Services' },
    ...(resolvedWebsite.products.length > 0 ? [{ id: 'products', label: 'Products' }] : []),
    { id: 'proof', label: 'Metrics' },
    ...(resolvedWebsite.caseStudies.length > 0 ? [{ id: 'work', label: 'Work' }] : []),
    { id: 'team', label: 'Team' },
    ...(resolvedWebsite.testimonials.length > 0 ? [{ id: 'testimonials', label: 'Reviews' }] : []),
    { id: 'contact', label: 'Contact' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-teal-500 selection:text-white flex flex-col items-center w-full max-w-full overflow-x-hidden pb-16 sm:pb-0">
      {/* ======================================================== */}
      {/* 1. TOP HEADER / BRAND BAR                                */}
      {/* ======================================================== */}
      <header className="w-full sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 px-3 sm:px-6 py-2.5 sm:py-3 transition">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-2">
          {/* Company Brand Monogram & Name */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 mr-1 sm:mr-2">
            {resolvedWebsite.logoUrl ? (
              <img
                src={resolvedWebsite.logoUrl}
                alt={resolvedWebsite.name}
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl object-contain bg-slate-900 border border-slate-800 p-1 shadow-sm shrink-0"
              />
            ) : (
              <div
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm sm:text-base shadow-sm shrink-0"
                style={{ backgroundColor: resolvedWebsite.primaryColor }}
              >
                {resolvedWebsite.name[0]}
              </div>
            )}
            <div className="flex flex-col min-w-0 flex-1">
              <div className="flex items-center gap-1 sm:gap-1.5 min-w-0">
                <span className="text-xs sm:text-base font-bold text-white tracking-tight leading-tight truncate">
                  {resolvedWebsite.name}
                </span>
                <ShieldCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-teal-400 shrink-0" />
              </div>
              <span className="text-[9px] sm:text-[10px] text-slate-400 font-medium truncate mt-0.5 max-w-full">
                {resolvedWebsite.tagline}
              </span>
            </div>
          </div>

          {/* Desktop Nav Links & Action Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Desktop Section Links */}
            <nav className="hidden md:flex items-center gap-1 mr-2">
              {navTabs.slice(0, 5).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => scrollToSection(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    activeTab === tab.id
                      ? 'text-teal-300 bg-teal-500/10'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>

            {/* Back Button (Contextual) */}
            {onBackToCard && (
              <button
                onClick={() => onBackToCard()}
                className="hidden sm:inline-flex items-center px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-semibold transition"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1 text-teal-400" />
                <span>Business Card</span>
              </button>
            )}

            {/* Theme Toggle */}
            <div className="shrink-0">
              <ThemeToggle variant="compact" />
            </div>

            {/* Share / Copy Link */}
            <button
              onClick={handleCopyShareLink}
              className="p-1.5 sm:p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition shrink-0"
              title="Share / Copy Link"
            >
              {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
            </button>

            {/* Primary Enquire / Contact Button */}
            <button
              onClick={() => scrollToSection('contact')}
              className="hidden sm:inline-flex items-center px-4 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold shadow-md transition active:scale-95 shrink-0"
            >
              <Send className="w-3.5 h-3.5 mr-1.5" />
              <span>Contact Company</span>
            </button>

            {/* Mobile Menu Toggle Button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-1.5 sm:p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition md:hidden shrink-0"
              aria-label="Toggle navigation menu"
            >
              {isMenuOpen ? <X className="w-4 h-4 sm:w-5 sm:h-5" /> : <Menu className="w-4 h-4 sm:w-5 sm:h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* ======================================================== */}
      {/* 2. SLIDE-OVER MOBILE NAVIGATION DRAWER                   */}
      {/* ======================================================== */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex justify-end md:hidden animate-in fade-in duration-200">
          <div className="w-4/5 max-w-sm h-full bg-slate-900 border-l border-slate-800 p-6 flex flex-col justify-between overflow-y-auto">
            <div className="space-y-6">
              {/* Drawer Top */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <Building2 className="w-5 h-5 text-teal-400" />
                  <span className="font-bold text-sm text-white">{resolvedWebsite.name}</span>
                </div>
                <button
                  onClick={() => setIsMenuOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Navigation Links */}
              <nav className="space-y-1.5">
                {navTabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => scrollToSection(tab.id)}
                    className="w-full flex items-center justify-between p-3 rounded-xl text-left text-xs font-semibold text-slate-200 hover:bg-slate-800/80 hover:text-teal-300 transition"
                  >
                    <span>{tab.label}</span>
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                  </button>
                ))}
              </nav>

              {/* Quick Actions */}
              <div className="pt-4 border-t border-slate-800 space-y-3">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-semibold text-slate-400">Appearance</span>
                  <ThemeToggle variant="compact" />
                </div>

                <button
                  onClick={handleDownloadCompanyVCard}
                  className="w-full py-2.5 px-3 rounded-xl bg-slate-800 text-slate-200 hover:text-white text-xs font-semibold flex items-center justify-center gap-2 border border-slate-700"
                >
                  <Download className="w-4 h-4 text-teal-400" />
                  <span>Download Corporate vCard</span>
                </button>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="pt-6 border-t border-slate-800 text-center">
              <p className="text-[11px] text-slate-400">{resolvedWebsite.location}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">{resolvedWebsite.email}</p>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. HERO SECTION (WHO IS THIS COMPANY & WHAT DOES IT DO)  */}
      {/* ======================================================== */}
      <section
        id="section-home"
        className="w-full relative overflow-hidden bg-slate-900 border-b border-slate-800/80"
      >
        {/* Hero Background Image with Overlay */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-25 mix-blend-luminosity scale-105 pointer-events-none transition duration-700"
          style={{ backgroundImage: `url(${resolvedWebsite.heroImageUrl})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-slate-950/90 to-slate-950" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-16 flex flex-col items-center text-center space-y-4 sm:space-y-5">
          {/* Verified Badge */}
          <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-300 text-[11px] sm:text-xs font-semibold shadow-sm animate-in fade-in duration-300 max-w-full">
            <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-teal-400 shrink-0" />
            <span className="truncate">Verified Corporate Business Identity</span>
          </div>

          {/* Company Name & Tagline */}
          <div className="space-y-1.5 sm:space-y-2 max-w-3xl w-full">
            <h1 className="text-2xl xs:text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight break-words">
              {resolvedWebsite.name}
            </h1>
            <p className="text-sm xs:text-base sm:text-xl font-medium text-teal-300/90 break-words">
              {resolvedWebsite.tagline}
            </p>
          </div>

          {/* Positioning Statement */}
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed font-normal px-1">
            {resolvedWebsite.positioningStatement}
          </p>

          {/* Quick Facts Pill Strip */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 pt-2 max-w-full">
            <div className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-300 text-[10px] sm:text-[11px] font-medium max-w-full">
              <Briefcase className="w-3.5 h-3.5 text-teal-400 shrink-0" />
              <span className="truncate">{resolvedWebsite.industry}</span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-300 text-[10px] sm:text-[11px] font-medium max-w-full">
              <MapPin className="w-3.5 h-3.5 text-teal-400 shrink-0" />
              <span className="truncate">{resolvedWebsite.location}</span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-300 text-[10px] sm:text-[11px] font-medium max-w-full">
              <Users className="w-3.5 h-3.5 text-teal-400 shrink-0" />
              <span className="truncate">{resolvedWebsite.employeeCount}</span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-300 text-[10px] sm:text-[11px] font-medium max-w-full">
              <Calendar className="w-3.5 h-3.5 text-teal-400 shrink-0" />
              <span>Est. {resolvedWebsite.foundedYear}</span>
            </div>
          </div>

          {/* Dual Call To Actions */}
          <div className="flex flex-col sm:flex-row items-center gap-2.5 sm:gap-3 pt-3 sm:pt-4 w-full sm:w-auto">
            <button
              onClick={() => scrollToSection('contact')}
              className="w-full sm:w-auto min-h-[44px] px-5 sm:px-7 py-3 rounded-2xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs sm:text-sm shadow-xl shadow-teal-900/30 transition transform active:scale-95 flex items-center justify-center gap-2 text-center"
            >
              <Send className="w-4 h-4 shrink-0" />
              <span>Contact Company & Enquire</span>
            </button>
            <button
              onClick={() => scrollToSection('about')}
              className="w-full sm:w-auto min-h-[44px] px-5 sm:px-6 py-3 rounded-2xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 font-bold text-xs sm:text-sm border border-slate-700 shadow-md transition transform active:scale-95 flex items-center justify-center gap-2 text-center"
            >
              <span>Our Story & Capabilities</span>
              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
            </button>
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* 4. STICKY HORIZONTAL NAVIGATION TABS (MOBILE & DESKTOP)  */}
      {/* ======================================================== */}
      <div className="sticky top-[49px] sm:top-[57px] z-30 w-full bg-slate-950/95 backdrop-blur-md border-b border-slate-800/80 py-2 px-3 sm:px-4 overflow-x-auto no-scrollbar">
        <div className="max-w-5xl mx-auto flex items-center gap-1.5 sm:gap-2 min-w-max justify-start sm:justify-center">
          {navTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => scrollToSection(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                activeTab === tab.id
                  ? 'bg-teal-600 text-white shadow-md'
                  : 'bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* MAIN CONTENT WRAPPER */}
      <main className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-16">
        {/* ======================================================== */}
        {/* SECTION 5: CORE VALUE PROPOSITIONS / OVERVIEW             */}
        {/* ======================================================== */}
        <section id="section-overview" className="space-y-6">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-widest text-teal-400">
              Enterprise Excellence
            </h2>
            <p className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Why Global Leaders Partner With {resolvedWebsite.name}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {resolvedWebsite.coreValues.map((val, idx) => (
              <div
                key={idx}
                className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 hover:border-teal-500/40 transition duration-200 flex flex-col justify-between space-y-3 shadow-lg"
              >
                <div className="space-y-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-teal-500/10 text-teal-400 flex items-center justify-center border border-teal-500/20">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-bold text-white">{val.title}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{val.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ======================================================== */}
        {/* SECTION 6: ABOUT OUR STORY, MISSION & CERTIFICATIONS     */}
        {/* ======================================================== */}
        <section
          id="section-about"
          className="rounded-3xl bg-slate-900/90 border border-slate-800 p-6 sm:p-10 space-y-8 shadow-2xl"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-teal-400 block mb-1">
                Corporate Narrative
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                About {resolvedWebsite.name}
              </h2>
            </div>
            <button
              onClick={handleDownloadCompanyVCard}
              className="inline-flex items-center text-xs font-semibold text-slate-300 hover:text-white px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 transition self-start"
            >
              <Download className="w-3.5 h-3.5 mr-1.5 text-teal-400" />
              <span>Corporate Contact (vCard)</span>
            </button>
          </div>

          <div className="space-y-4 text-xs sm:text-sm text-slate-300 leading-relaxed whitespace-pre-line">
            {resolvedWebsite.aboutStory}
          </div>

          {/* Mission & Vision Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="p-5 rounded-2xl bg-teal-950/30 border border-teal-800/40 space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-teal-400 block">
                Our Mission
              </span>
              <p className="text-xs text-teal-100/90 leading-relaxed">{resolvedWebsite.mission}</p>
            </div>
            <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                Our Vision
              </span>
              <p className="text-xs text-slate-300 leading-relaxed">{resolvedWebsite.vision}</p>
            </div>
          </div>

          {/* Accreditations & Certifications */}
          {resolvedWebsite.certifications.length > 0 && (
            <div className="pt-4 border-t border-slate-800 space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                Verified Compliance & Accreditations
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {resolvedWebsite.certifications.map((cert, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800/90 space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">{cert.title}</span>
                      {cert.year && (
                        <span className="text-[10px] font-mono text-teal-400">{cert.year}</span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400">{cert.issuer}</p>
                    {cert.badgeText && (
                      <span className="inline-block mt-1 text-[9px] font-semibold text-slate-400 uppercase tracking-wider px-2 py-0.5 rounded bg-slate-800">
                        {cert.badgeText}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ======================================================== */}
        {/* SECTION 7: SERVICES & SOLUTIONS                          */}
        {/* ======================================================== */}
        <section id="section-services" className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-teal-400 block mb-1">
                Offerings & Capabilities
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Services & Solutions
              </h2>
            </div>
            <p className="text-xs text-slate-400 max-w-sm">
              Customized enterprise deployments with dedicated solution architects and SLAs.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {resolvedWebsite.services.map((svc) => (
              <div
                key={svc.id}
                className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-teal-500/50 transition duration-200 flex flex-col justify-between space-y-4 shadow-xl"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-teal-500/10 text-teal-300 border border-teal-500/20">
                      {svc.category || svc.deliveryMode || 'Service'}
                    </span>
                    {svc.startingPrice && (
                      <span className="text-[11px] font-mono font-medium text-slate-400">
                        {svc.startingPrice}
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-bold text-white">{svc.title}</h3>
                  <p className="text-xs text-slate-300 leading-relaxed">{svc.description}</p>

                  {svc.deliverables && svc.deliverables.length > 0 && (
                    <ul className="space-y-1.5 pt-2 border-t border-slate-800/80">
                      {svc.deliverables.map((item, dIdx) => (
                        <li key={dIdx} className="text-[11px] text-slate-300 flex items-start">
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-teal-400 shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <button
                  onClick={() => handleEnquireService(svc.title)}
                  className="w-full py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-teal-300 text-xs font-semibold border border-slate-700 transition text-center flex items-center justify-center gap-1.5"
                >
                  <span>{svc.ctaLabel || 'Enquire About Solution'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* ======================================================== */}
        {/* SECTION 8: PRODUCTS & INNOVATIONS (WHERE CONFIGURED)     */}
        {/* ======================================================== */}
        {resolvedWebsite.products.length > 0 && (
          <section id="section-products" className="space-y-6">
            <div className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-widest text-teal-400 block">
                Product Ecosystem
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Featured Products & Hardware
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {resolvedWebsite.products.map((prod) => (
                <div
                  key={prod.id}
                  className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between space-y-4 shadow-xl"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-teal-300">{prod.category}</span>
                      {prod.badge && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-800 text-amber-300 border border-amber-500/20">
                          {prod.badge}
                        </span>
                      )}
                    </div>

                    <h3 className="text-base sm:text-lg font-bold text-white">{prod.title}</h3>
                    <p className="text-xs text-slate-300 leading-relaxed">{prod.description}</p>

                    {prod.features && (
                      <div className="flex flex-wrap gap-1.5 pt-2">
                        {prod.features.map((feat, fIdx) => (
                          <span
                            key={fIdx}
                            className="px-2.5 py-1 rounded-lg bg-slate-950 text-slate-300 text-[10px] font-mono border border-slate-800"
                          >
                            {feat}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => handleEnquireService(prod.title)}
                    className="w-full py-2.5 px-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold transition text-center"
                  >
                    {prod.actionLabel || 'Request Product Demo'} →
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ======================================================== */}
        {/* SECTION 9: COMPANY PROOF & KEY PERFORMANCE METRICS       */}
        {/* ======================================================== */}
        <section
          id="section-proof"
          className="rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 p-6 sm:p-10 space-y-6 shadow-2xl"
        >
          <div className="text-center max-w-xl mx-auto space-y-1">
            <span className="text-xs font-bold uppercase tracking-widest text-teal-400 block">
              Proven Track Record
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              Enterprise Scale in Numbers
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
            {resolvedWebsite.metrics.map((metric, idx) => (
              <div
                key={idx}
                className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800/80 text-center space-y-1"
              >
                <span className="text-2xl sm:text-4xl font-extrabold text-white block tracking-tight">
                  {metric.value}
                </span>
                <span className="text-xs font-bold text-teal-300 block">{metric.label}</span>
                {metric.description && (
                  <span className="text-[10px] text-slate-400 block leading-tight">
                    {metric.description}
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ======================================================== */}
        {/* SECTION 10: FEATURED WORK & CASE STUDIES                 */}
        {/* ======================================================== */}
        {resolvedWebsite.caseStudies.length > 0 && (
          <section id="section-work" className="space-y-6">
            <div className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-widest text-teal-400 block">
                Impact & Results
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Featured Case Studies
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {resolvedWebsite.caseStudies.map((cs) => (
                <div
                  key={cs.id}
                  className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-xl"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-teal-400">{cs.client}</span>
                    <span className="text-[10px] font-mono text-slate-400">{cs.industry}</span>
                  </div>

                  <h3 className="text-base font-bold text-white">{cs.title}</h3>

                  {cs.challenge && (
                    <div className="text-xs text-slate-400 space-y-1">
                      <span className="font-semibold text-slate-300 block">Challenge:</span>
                      <p>{cs.challenge}</p>
                    </div>
                  )}

                  {cs.outcome && (
                    <div className="p-3.5 rounded-2xl bg-teal-950/40 border border-teal-800/40 space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-teal-400 block">
                        Measurable Outcome
                      </span>
                      <p className="text-xs text-teal-200 leading-relaxed">{cs.outcome}</p>
                    </div>
                  )}

                  {cs.tags && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {cs.tags.map((t, tIdx) => (
                        <span
                          key={tIdx}
                          className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 text-[10px] font-mono"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ======================================================== */}
        {/* SECTION 11: LEADERSHIP & TEAM DIRECTORY                  */}
        {/* ======================================================== */}
        <section id="section-team" className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-teal-400 block mb-1">
                Verified Workforce Directory
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Our Leadership & Team Cards
              </h2>
            </div>
            <p className="text-xs text-slate-400 max-w-sm">
              Connect directly with verified employees on their personal digital business cards.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {resolvedWebsite.team.map((member) => (
              <div
                key={member.id}
                className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-teal-500/40 hover:bg-slate-900 transition duration-200 flex flex-col justify-between space-y-4 shadow-lg group relative"
              >
                <div className="space-y-3">
                  <div className="flex items-start gap-3.5">
                    <a
                      href={`#card/${member.cardSlug}${isAdminPreview ? '?preview=true' : ''}`}
                      aria-label={`View ${member.name}'s business card`}
                      className="relative shrink-0 focus:outline-none focus:ring-2 focus:ring-teal-400 rounded-2xl"
                    >
                      {member.photoUrl ? (
                        <img
                          src={member.photoUrl}
                          alt={member.name}
                          className="w-14 h-14 rounded-2xl object-cover border border-slate-700 shadow-md group-hover:ring-2 group-hover:ring-teal-500/50 transition"
                        />
                      ) : (
                        <div
                          className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-md border border-slate-700 group-hover:ring-2 group-hover:ring-teal-500/50 transition"
                          style={{ backgroundColor: resolvedWebsite.primaryColor }}
                        >
                          {member.name[0]}
                        </div>
                      )}
                      <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-slate-900 rounded-full"></span>
                    </a>

                    <div className="flex-1 min-w-0">
                      <a
                        href={`#card/${member.cardSlug}${isAdminPreview ? '?preview=true' : ''}`}
                        className="text-sm font-bold text-white hover:text-teal-300 transition truncate block tracking-tight"
                      >
                        {member.name}
                      </a>
                      <p className="text-xs font-medium text-teal-300 truncate mt-0.5">
                        {member.designation}
                      </p>
                      {member.departmentName && (
                        <span className="inline-block text-[10px] font-semibold text-slate-400 mt-1 px-2 py-0.5 rounded-md bg-slate-800/80 border border-slate-700/60">
                          {member.departmentName}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Bio / Short Headline if available */}
                  {member.bio && (
                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed italic pt-1">
                      &ldquo;{member.bio}&rdquo;
                    </p>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-800/80 space-y-2">
                  <a
                    href={`#card/${member.cardSlug}${isAdminPreview ? '?preview=true' : ''}`}
                    aria-label={`Open digital business card for ${member.name}`}
                    className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-teal-600 text-slate-200 hover:text-white text-xs font-semibold transition text-center flex items-center justify-center gap-1.5 border border-slate-700 hover:border-teal-500 shadow-sm active:scale-95"
                  >
                    <span>View Business Card</span>
                    <ChevronRight className="w-3.5 h-3.5 text-teal-400 group-hover:text-white transition" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ======================================================== */}
        {/* SECTION 12: CLIENT TESTIMONIALS & REVIEWS                */}
        {/* ======================================================== */}
        {resolvedWebsite.testimonials.length > 0 && (
          <section id="section-testimonials" className="space-y-6">
            <div className="text-center max-w-xl mx-auto space-y-1">
              <span className="text-xs font-bold uppercase tracking-widest text-teal-400 block">
                Endorsements
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                Client Testimonials
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {resolvedWebsite.testimonials.map((test) => (
                <div
                  key={test.id}
                  className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between space-y-4 shadow-xl"
                >
                  <div className="flex items-center gap-1 text-amber-400">
                    {[...Array(test.rating || 5)].map((_, rIdx) => (
                      <Star key={rIdx} className="w-4 h-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>

                  <p className="text-xs sm:text-sm italic text-slate-200 leading-relaxed">
                    &ldquo;{test.quote}&rdquo;
                  </p>

                  <div className="flex items-center gap-3 pt-3 border-t border-slate-800">
                    {test.avatarUrl ? (
                      <img
                        src={test.avatarUrl}
                        alt={test.clientName}
                        className="w-10 h-10 rounded-full object-cover border border-slate-700"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-teal-900/60 border border-teal-700 text-teal-200 font-bold flex items-center justify-center text-xs">
                        {test.clientName[0]}
                      </div>
                    )}
                    <div>
                      <span className="text-xs font-bold text-white block">{test.clientName}</span>
                      <span className="text-[11px] text-slate-400">
                        {test.designation} • {test.companyName}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ======================================================== */}
        {/* SECTION 13: CONTACT & INTERACTIVE LEAD ENQUIRY FORM      */}
        {/* ======================================================== */}
        <section
          id="section-contact"
          ref={contactSectionRef}
          className="rounded-3xl bg-slate-900 border border-slate-800 p-4 sm:p-10 space-y-6 sm:space-y-8 shadow-2xl overflow-hidden"
        >
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="text-xs font-bold uppercase tracking-widest text-teal-400 block">
              Direct Communication & Engagement
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight break-words">
              Get in Touch with {resolvedWebsite.name}
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed px-1">
              Submit your enquiry below to connect with our solution architects, or reach us directly.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
            {/* Left: Contact Coordinates & Hours */}
            <div className="lg:col-span-5 space-y-3 sm:space-y-4">
              <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-300">
                Corporate Coordinates
              </h3>

              <div className="space-y-2.5 sm:space-y-3 text-xs">
                {resolvedWebsite.phone && (
                  <a
                    href={sanitizePhoneHref(resolvedWebsite.phone) || '#'}
                    className="flex items-center p-3 sm:p-3.5 rounded-2xl bg-slate-950 border border-slate-800 hover:border-teal-500/40 text-slate-300 hover:text-white transition"
                  >
                    <Phone className="w-4 h-4 mr-3 text-teal-400 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] text-slate-500 font-semibold block uppercase">
                        Phone (Main Office)
                      </span>
                      <span className="truncate block">{resolvedWebsite.phone}</span>
                    </div>
                  </a>
                )}

                {resolvedWebsite.email && (
                  <a
                    href={sanitizeMailtoHref(resolvedWebsite.email) || '#'}
                    className="flex items-center p-3 sm:p-3.5 rounded-2xl bg-slate-950 border border-slate-800 hover:border-teal-500/40 text-slate-300 hover:text-white transition"
                  >
                    <Mail className="w-4 h-4 mr-3 text-teal-400 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] text-slate-500 font-semibold block uppercase">
                        Email Desk
                      </span>
                      <span className="truncate block break-all">{resolvedWebsite.email}</span>
                    </div>
                  </a>
                )}

                {resolvedWebsite.whatsapp && (
                  <a
                    href={sanitizeWhatsAppHref(resolvedWebsite.whatsapp) || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center p-3 sm:p-3.5 rounded-2xl bg-slate-950 border border-slate-800 hover:border-teal-500/40 text-slate-300 hover:text-white transition"
                  >
                    <MessageSquare className="w-4 h-4 mr-3 text-emerald-400 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] text-slate-500 font-semibold block uppercase">
                        WhatsApp Business
                      </span>
                      <span className="truncate block">{resolvedWebsite.whatsapp}</span>
                    </div>
                  </a>
                )}

                {resolvedWebsite.address && (
                  <div className="flex items-start p-3 sm:p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-slate-300">
                    <MapPin className="w-4 h-4 mr-3 text-teal-400 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] text-slate-500 font-semibold block uppercase">
                        Headquarters Address
                      </span>
                      <span className="leading-relaxed block">{resolvedWebsite.address}</span>
                    </div>
                  </div>
                )}

                {resolvedWebsite.operatingHours && (
                  <div className="flex items-start p-3 sm:p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-slate-300">
                    <Clock className="w-4 h-4 mr-3 text-teal-400 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] text-slate-500 font-semibold block uppercase">
                        Operating Hours
                      </span>
                      <span className="leading-relaxed block">{resolvedWebsite.operatingHours}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Interactive Enquiry Form */}
            <div className="lg:col-span-7 bg-slate-950 p-4 sm:p-7 rounded-3xl border border-slate-800 w-full overflow-hidden">
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <Send className="w-4 h-4 text-teal-400" />
                <span>Send Corporate Enquiry</span>
              </h3>

              {enquirySubmitted ? (
                <div className="p-5 sm:p-6 rounded-2xl bg-teal-950/40 border border-teal-500/40 text-center space-y-3 animate-in fade-in">
                  <div className="w-12 h-12 rounded-full bg-teal-500/20 text-teal-300 flex items-center justify-center mx-auto">
                    <Check className="w-6 h-6" />
                  </div>
                  <h4 className="text-base font-bold text-white">Enquiry Received!</h4>
                  <p className="text-xs text-teal-200/90 leading-relaxed">
                    Thank you for reaching out. Your enquiry has been routed to our solution team and
                    a representative will respond within one business day.
                  </p>
                  <button
                    onClick={() => setEnquirySubmitted(false)}
                    className="mt-2 text-xs font-semibold text-teal-400 hover:underline"
                  >
                    Submit another enquiry
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmitEnquiry} className="space-y-3.5 sm:space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="block font-medium text-slate-300 mb-1">Your Full Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="Jane Doe"
                        value={enquiryName}
                        onChange={(e) => setEnquiryName(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </div>

                    <div>
                      <label className="block font-medium text-slate-300 mb-1">Corporate Email *</label>
                      <input
                        type="email"
                        required
                        placeholder="jane@company.com"
                        value={enquiryEmail}
                        onChange={(e) => setEnquiryEmail(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </div>

                    <div>
                      <label className="block font-medium text-slate-300 mb-1">Phone Number</label>
                      <input
                        type="tel"
                        placeholder="+1 (555) 000-0000"
                        value={enquiryPhone}
                        onChange={(e) => setEnquiryPhone(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </div>

                    <div>
                      <label className="block font-medium text-slate-300 mb-1">Your Organization</label>
                      <input
                        type="text"
                        placeholder="Acme Corp"
                        value={enquiryCompany}
                        onChange={(e) => setEnquiryCompany(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-medium text-slate-300 mb-1">Area of Interest / Service</label>
                    <input
                      type="text"
                      placeholder="e.g. Enterprise Rollout, Advisory, Telemetry, etc."
                      value={enquiryService}
                      onChange={(e) => setEnquiryService(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-slate-300 mb-1">Message / Scope of Discussion *</label>
                    <textarea
                      rows={3}
                      required
                      placeholder="Please share details regarding your organization's timeline, headcount, or technical objectives..."
                      value={enquiryMessage}
                      onChange={(e) => setEnquiryMessage(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingEnquiry}
                    className="w-full py-3 px-4 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-lg transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    <span>{isSubmittingEnquiry ? 'Sending Enquiry...' : 'Submit Official Enquiry'}</span>
                  </button>
                </form>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* ======================================================== */}
      {/* 14. FOOTER & VERIFICATION METADATA                       */}
      {/* ======================================================== */}
      <footer className="w-full bg-slate-950 border-t border-slate-900 py-8 sm:py-10 px-4 sm:px-6 text-center space-y-5 sm:space-y-6">
        <div className="max-w-4xl mx-auto flex flex-col items-center space-y-4">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-teal-400" />
            <span className="font-bold text-sm text-white">{resolvedWebsite.name}</span>
          </div>

          <p className="text-xs text-slate-400 max-w-md">{resolvedWebsite.legalName}</p>

          {/* Social Channels */}
          <div className="flex items-center justify-center gap-2.5 sm:gap-3 flex-wrap">
            {resolvedWebsite.socialLinks?.linkedin && (
              <a
                href={resolvedWebsite.socialLinks.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-xl bg-slate-900 text-slate-400 hover:text-white border border-slate-800 transition"
                title="LinkedIn"
              >
                <Linkedin className="w-4 h-4" />
              </a>
            )}
            {resolvedWebsite.socialLinks?.twitter && (
              <a
                href={resolvedWebsite.socialLinks.twitter}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-xl bg-slate-900 text-slate-400 hover:text-white border border-slate-800 transition"
                title="Twitter"
              >
                <Twitter className="w-4 h-4" />
              </a>
            )}
            {resolvedWebsite.socialLinks?.github && (
              <a
                href={resolvedWebsite.socialLinks.github}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-xl bg-slate-900 text-slate-400 hover:text-white border border-slate-800 transition"
                title="GitHub"
              >
                <Github className="w-4 h-4" />
              </a>
            )}
            {resolvedWebsite.website && (
              <a
                href={resolvedWebsite.website}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-xl bg-slate-900 text-slate-400 hover:text-white border border-slate-800 transition"
                title="Official Website"
              >
                <Globe className="w-4 h-4" />
              </a>
            )}
          </div>

          <div className="pt-4 border-t border-slate-900 text-[10px] sm:text-[11px] text-slate-500 space-y-1">
            <p>Powered by Digital Business Card & Identity SaaS Platform • RFC 6350 Compatible</p>
            <p>© {new Date().getFullYear()} {resolvedWebsite.name}. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* ======================================================== */}
      {/* 15. STICKY MOBILE BOTTOM QUICK ACTION BAR                */}
      {/* ======================================================== */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 p-2 sm:hidden shadow-2xl pb-[max(0.625rem,env(safe-area-inset-bottom))]">
        <div className="grid grid-cols-4 gap-1.5 text-center text-[10px] max-w-md mx-auto">
          {resolvedWebsite.phone && (
            <a
              href={sanitizePhoneHref(resolvedWebsite.phone) || '#'}
              className="py-2 px-1 rounded-xl bg-slate-800 text-slate-200 font-semibold flex flex-col items-center justify-center gap-0.5 border border-slate-700 active:scale-95 transition"
            >
              <Phone className="w-3.5 h-3.5 text-teal-400" />
              <span>Call</span>
            </a>
          )}
          {resolvedWebsite.email && (
            <a
              href={sanitizeMailtoHref(resolvedWebsite.email) || '#'}
              className="py-2 px-1 rounded-xl bg-slate-800 text-slate-200 font-semibold flex flex-col items-center justify-center gap-0.5 border border-slate-700 active:scale-95 transition"
            >
              <Mail className="w-3.5 h-3.5 text-teal-400" />
              <span>Email</span>
            </a>
          )}
          {resolvedWebsite.whatsapp ? (
            <a
              href={sanitizeWhatsAppHref(resolvedWebsite.whatsapp) || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="py-2 px-1 rounded-xl bg-slate-800 text-slate-200 font-semibold flex flex-col items-center justify-center gap-0.5 border border-slate-700 active:scale-95 transition"
            >
              <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
              <span>WhatsApp</span>
            </a>
          ) : (
            <button
              onClick={handleDownloadCompanyVCard}
              className="py-2 px-1 rounded-xl bg-slate-800 text-slate-200 font-semibold flex flex-col items-center justify-center gap-0.5 border border-slate-700 active:scale-95 transition"
            >
              <Download className="w-3.5 h-3.5 text-teal-400" />
              <span>vCard</span>
            </button>
          )}
          <button
            onClick={() => scrollToSection('contact')}
            className="py-2 px-1 rounded-xl bg-teal-600 text-white font-bold flex flex-col items-center justify-center gap-0.5 shadow-md active:scale-95 transition"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Enquire</span>
          </button>
        </div>
      </div>
    </div>
  );
};
