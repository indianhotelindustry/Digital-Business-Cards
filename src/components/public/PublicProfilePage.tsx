import React, { useEffect, useState } from 'react';
import { Card, Company, Department, Employee } from '../../types';
import { ResolvedCardProfile, CardSectionType } from '../../types/cardProfile';
import { resolveCardProfile } from '../../services/cardSectionResolver';
import { publicResolver } from '../../services/publicResolver';
import { resolveCompanySlug } from '../../services/companyProfileResolver';
import { downloadVCard } from '../../services/vcardService';
import { recordAnalyticsEvent } from '../../services/analyticsService';
import { sanitizeUrl } from '../../lib/securityUtils';
import { ExchangeContactModal } from '../connect/ExchangeContactModal';
import { CompanyProfileDrawerModal } from '../cards/CompanyProfileDrawerModal';
import { ThemeToggle } from '../common/ThemeToggle';
import {
  User,
  Briefcase,
  Award,
  Sparkles,
  Mail,
  Phone,
  Globe,
  MapPin,
  Building,
  ExternalLink,
  Github,
  Twitter,
  Youtube,
  Linkedin,
  Instagram,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowLeft,
  Download,
  Share2,
  Search,
  MessageSquare,
  Quote,
  GraduationCap,
  Trophy,
  FolderGit2,
  ChevronRight,
  ShieldCheck,
  Send,
} from 'lucide-react';
import { entityRoute, navigate } from '../../lib/routes';

interface PublicProfilePageProps {
  slug: string;
  onBackToCard?: () => void;
  onBackToApp?: () => void;
  isAdminPreview?: boolean;
}

export const PublicProfilePage: React.FC<PublicProfilePageProps> = ({
  slug,
  onBackToCard,
  onBackToApp,
  isAdminPreview = false,
}) => {
  const [loading, setLoading] = useState(true);
  const [card, setCard] = useState<Card | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [department, setDepartment] = useState<Department | null>(null);
  const [resolvedProfile, setResolvedProfile] = useState<ResolvedCardProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [isCompanyDrawerOpen, setIsCompanyDrawerOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function loadFullProfile() {
      setLoading(true);
      setError(null);
      // Directive 26: resolved by the backend (published card, visible profile,
      // PUBLIC sections only, full-profile entitlement of the tenant).
      const r = await publicResolver.profile(slug, isAdminPreview);
      if (!isMounted) return;
      if (r.outcome === 'OK') {
        setCard(r.card!);
        setEmployee(r.employee!);
        setCompany(r.company!);
        setDepartment(r.department ?? null);
        setResolvedProfile(resolveCardProfile(r.employee!, r.company!, r.department ?? null, r.profile ?? null));
        recordAnalyticsEvent(r.employee!.companyId, r.employee!.id, r.card!.id, 'card_view', { viewType: 'full_profile' });
      } else if (r.outcome === 'NOT_PUBLISHED' || r.outcome === 'UNAVAILABLE') {
        setError('This profile is not publicly available.');
      } else if (r.outcome === 'ERROR') {
        setError('This profile could not be loaded right now. Please try again.');
      } else {
        setError('Profile not found');
      }
      setLoading(false);
    }

    if (slug) {
      loadFullProfile();
    }
    return () => {
      isMounted = false;
    };
  }, [slug, isAdminPreview]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 border-3 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-xs font-medium text-slate-500 uppercase tracking-wider">
          Loading Full Professional Profile...
        </p>
      </div>
    );
  }

  if (error || !card || !employee || !resolvedProfile) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full p-8 bg-white border border-slate-200/80 rounded-3xl shadow-sm text-center">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4">
            <Search className="w-7 h-7" />
          </div>
          <h1 className="text-lg font-bold text-slate-900">Profile Not Found</h1>
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">
            The requested individual profile slug &quot;{slug}&quot; could not be located. The link may
            be incorrect or the identity record has been updated.
          </p>

          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              onClick={() => {
                if (onBackToCard) {
                  onBackToCard();
                } else {
                  navigate(entityRoute('card', slug));
                }
              }}
              className="inline-flex items-center px-4 py-2.5 rounded-xl bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 transition"
            >
              <ArrowLeft className="w-4 h-4 mr-1.5" /> Return to Business Card
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleSaveContact = () => {
    recordAnalyticsEvent(employee.companyId, employee.id, card.id, 'save_contact');
    downloadVCard(employee, company, department);
  };

  const handleConnect = () => {
    setIsConnectModalOpen(true);
  };

  const handleBackToCardView = () => {
    if (onBackToCard) {
      onBackToCard();
    } else {
      navigate(entityRoute('card', slug, isAdminPreview));
    }
  };

  const handleSocialClick = (platform: string, url?: string) => {
    if (!url) return;
    const safeUrl = sanitizeUrl(url);
    if (safeUrl) {
      recordAnalyticsEvent(employee.companyId, employee.id, card.id, 'website_click', { platform });
      window.open(safeUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const isSectionEnabled = (secType: CardSectionType): boolean => {
    return resolvedProfile.enabledSections.includes(secType);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans selection:bg-teal-500 selection:text-white flex flex-col items-center">
      {/* Container ensuring page fills full viewport on mobile before page footer */}
      <div className="w-full min-h-[100dvh] flex flex-col items-center">
        {/* TOP FLOATING NAVIGATION BAR */}
        <header className="w-full sticky top-0 z-40 bg-slate-900/85 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-6 py-3">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <button
              id="profile-back-to-card-btn"
              onClick={handleBackToCardView}
              className="inline-flex items-center px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition active:scale-95 shadow-sm"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1.5 text-teal-400" />
              <span>Digital Business Card</span>
            </button>

            <div className="flex items-center gap-2">
              <ThemeToggle variant="compact" />

              {isAdminPreview && (
                <span className="hidden sm:inline-block text-[10px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  Admin Preview
                </span>
              )}
              <button
                id="profile-header-save-contact-btn"
                onClick={handleSaveContact}
                className="inline-flex items-center px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition"
                title="Download RFC 6350 vCard"
              >
                <Download className="w-3.5 h-3.5 mr-1.5 text-teal-400" />
                <span className="hidden sm:inline">Save Contact</span>
                <span className="sm:hidden">vCard</span>
              </button>

              <button
                id="profile-header-connect-btn"
                onClick={handleConnect}
                className="inline-flex items-center px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold shadow-sm transition active:scale-95"
              >
                <Send className="w-3.5 h-3.5 mr-1.5" />
                <span>Connect</span>
              </button>
            </div>
          </div>
        </header>

        {/* MAIN PROFILE HERO CONTAINER */}
        <main className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8 flex-1">
          {/* ======================================================== */}
          {/* SECTION 01: PROFILE HEADER & CORE IDENTITY               */}
          {/* ======================================================== */}
          <section
            id="section-profile-header"
            className="relative overflow-hidden rounded-3xl bg-slate-800/80 border border-slate-700/80 shadow-2xl p-6 sm:p-8"
          >
            {/* Background Ambient Glow */}
            <div
              className="absolute -top-24 -right-24 w-96 h-96 rounded-full blur-3xl opacity-20 pointer-events-none"
              style={{ backgroundColor: resolvedProfile.primaryColor || '#0f766e' }}
            />

            <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center gap-6">
              {/* Profile Avatar / Photo */}
              <div className="relative shrink-0">
                {resolvedProfile.profilePhotoUrl ? (
                  <img
                    src={resolvedProfile.profilePhotoUrl}
                    alt={resolvedProfile.displayName}
                    className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover border-2 border-slate-700 shadow-md ring-4 ring-teal-500/20"
                  />
                ) : (
                  <div
                    className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl flex items-center justify-center text-white font-bold text-3xl shadow-md border-2 border-slate-700"
                    style={{ backgroundColor: resolvedProfile.primaryColor || '#0f766e' }}
                  >
                    {resolvedProfile.firstName?.[0] || 'U'}
                  </div>
                )}
                <div
                  className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-slate-900 flex items-center justify-center border-2 border-slate-800"
                  title="Verified Professional Identity"
                >
                  <ShieldCheck className="w-4 h-4 text-teal-400" />
                </div>
              </div>

              {/* Title & Core Metadata */}
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                    {resolvedProfile.displayName}
                  </h1>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-teal-500/10 text-teal-300 border border-teal-500/20">
                    <CheckCircle2 className="w-3 h-3 mr-1 text-teal-400" />
                    Verified Identity
                  </span>
                </div>

                <p className="text-base sm:text-lg font-semibold text-teal-300">
                  {resolvedProfile.designation}
                </p>

                {/* Optional Company & Department Association */}
                {resolvedProfile.hasCompanyAssociation ? (
                  <div className="flex flex-wrap items-center gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        const cSlug = company ? resolveCompanySlug(company) : '';
                        if (cSlug) {
                          navigate(entityRoute('company', cSlug, isAdminPreview));
                        } else {
                          setIsCompanyDrawerOpen(true);
                        }
                      }}
                      aria-label={`View ${resolvedProfile.companyName} company profile`}
                      className="inline-flex items-center text-xs font-semibold text-slate-300 hover:text-white px-2.5 py-1 rounded-lg bg-slate-700/60 hover:bg-slate-700 border border-slate-600 transition focus:outline-none focus:ring-2 focus:ring-teal-400 active:scale-95"
                    >
                      <Building className="w-3.5 h-3.5 mr-1.5 text-teal-400" />
                      <span>{resolvedProfile.companyName}</span>
                      <ChevronRight className="w-3.5 h-3.5 ml-1 text-slate-400" />
                    </button>

                    {resolvedProfile.departmentName && (
                      <span className="text-xs text-slate-400 px-2 py-0.5 rounded-lg bg-slate-800 border border-slate-700">
                        {resolvedProfile.departmentName}
                      </span>
                    )}

                    {resolvedProfile.location && (
                      <span className="inline-flex items-center text-xs text-slate-400">
                        <MapPin className="w-3.5 h-3.5 mr-1 text-slate-500" />
                        {resolvedProfile.location}
                      </span>
                    )}
                  </div>
                ) : (
                  resolvedProfile.location && (
                    <div className="flex items-center text-xs text-slate-400 pt-0.5">
                      <MapPin className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                      <span>{resolvedProfile.location}</span>
                    </div>
                  )
                )}

                {/* Professional Headline */}
                {resolvedProfile.headline && (
                  <p className="text-sm text-slate-300 font-normal leading-relaxed pt-1">
                    {resolvedProfile.headline}
                  </p>
                )}
              </div>
            </div>

            {/* Quick CTAs & Key Metrics Bar */}
            {resolvedProfile.metrics && resolvedProfile.metrics.length > 0 && (
              <div className="mt-6 pt-6 border-t border-slate-700/70 grid grid-cols-2 sm:grid-cols-4 gap-3">
                {resolvedProfile.metrics.map((metric, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-2xl bg-slate-900/60 border border-slate-700/60 text-center"
                  >
                    <span className="text-base font-bold text-white block">{metric.value}</span>
                    <span className="text-[11px] font-medium text-slate-400">{metric.label}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ======================================================== */}
          {/* SECTION 02: ABOUT & PHILOSOPHY                           */}
          {/* ======================================================== */}
          {isSectionEnabled('ABOUT') && (resolvedProfile.about || resolvedProfile.philosophy) && (
            <section
              id="section-profile-about"
              className="rounded-3xl bg-slate-800/80 border border-slate-700/80 p-6 sm:p-8 space-y-4"
            >
              <div className="flex items-center space-x-2 border-b border-slate-700/60 pb-3">
                <User className="w-5 h-5 text-teal-400" />
                <h2 className="text-lg font-bold text-white">About & Background</h2>
              </div>

              {resolvedProfile.about && (
                <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                  {resolvedProfile.about}
                </p>
              )}

              {resolvedProfile.philosophy && (
                <div className="mt-4 p-4 rounded-2xl bg-teal-950/40 border border-teal-800/50 flex items-start gap-3">
                  <Quote className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-teal-400 block mb-1">
                      Professional Philosophy
                    </span>
                    <p className="text-xs sm:text-sm italic text-teal-100/90 leading-relaxed">
                      &ldquo;{resolvedProfile.philosophy}&rdquo;
                    </p>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* ======================================================== */}
          {/* SECTION 03: EXPERTISE & SKILLS                           */}
          {/* ======================================================== */}
          {isSectionEnabled('EXPERTISE') &&
            (resolvedProfile.skillCategories.length > 0 || resolvedProfile.expertise.length > 0) && (
              <section
                id="section-profile-expertise"
                className="rounded-3xl bg-slate-800/80 border border-slate-700/80 p-6 sm:p-8 space-y-5"
              >
                <div className="flex items-center space-x-2 border-b border-slate-700/60 pb-3">
                  <Sparkles className="w-5 h-5 text-teal-400" />
                  <h2 className="text-lg font-bold text-white">Expertise & Competencies</h2>
                </div>

                {resolvedProfile.skillCategories.length > 0 ? (
                  <div className="space-y-4">
                    {resolvedProfile.skillCategories.map((cat, idx) => (
                      <div key={idx} className="space-y-2">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          {cat.categoryName}
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {cat.skills.map((skill, sIdx) => (
                            <span
                              key={sIdx}
                              className="px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-700 text-slate-200 text-xs font-medium hover:border-teal-500/50 transition"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {resolvedProfile.expertise.map((skill, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-700 text-slate-200 text-xs font-medium"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                )}
              </section>
            )}

          {/* ======================================================== */}
          {/* SECTION 04: CAREER TIMELINE / EXPERIENCE                 */}
          {/* ======================================================== */}
          {isSectionEnabled('EXPERIENCE') && resolvedProfile.experiences.length > 0 && (
            <section
              id="section-profile-experience"
              className="rounded-3xl bg-slate-800/80 border border-slate-700/80 p-6 sm:p-8 space-y-6"
            >
              <div className="flex items-center space-x-2 border-b border-slate-700/60 pb-3">
                <Briefcase className="w-5 h-5 text-teal-400" />
                <h2 className="text-lg font-bold text-white">Career Experience</h2>
              </div>

              <div className="space-y-6 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-slate-700">
                {resolvedProfile.experiences.map((exp, idx) => (
                  <div key={exp.id || idx} className="relative pl-8 space-y-2">
                    {/* Timeline Node Icon */}
                    <div className="absolute left-1.5 top-1.5 -translate-x-1/2 w-4 h-4 rounded-full bg-slate-900 border-2 border-teal-400 shadow" />

                    <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-700/70 space-y-2">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h3 className="text-sm sm:text-base font-bold text-white">{exp.role}</h3>
                          <p className="text-xs font-semibold text-teal-300">{exp.organization}</p>
                        </div>
                        <div className="text-right">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-[11px] font-mono font-medium bg-slate-800 text-slate-300 border border-slate-700">
                            {exp.startDate} – {exp.endDate || 'Present'}
                          </span>
                          {exp.location && (
                            <p className="text-[11px] text-slate-400 mt-0.5">{exp.location}</p>
                          )}
                        </div>
                      </div>

                      {exp.description && (
                        <p className="text-xs text-slate-300 leading-relaxed pt-1">
                          {exp.description}
                        </p>
                      )}

                      {exp.achievements && exp.achievements.length > 0 && (
                        <ul className="space-y-1 pt-1.5">
                          {exp.achievements.map((ach, aIdx) => (
                            <li key={aIdx} className="text-xs text-slate-300 flex items-start">
                              <span className="text-teal-400 mr-2 font-bold">•</span>
                              <span>{ach}</span>
                            </li>
                          ))}
                        </ul>
                      )}

                      {exp.technologies && exp.technologies.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-2">
                          {exp.technologies.map((tech, tIdx) => (
                            <span
                              key={tIdx}
                              className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[10px] font-mono border border-slate-700"
                            >
                              {tech}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ======================================================== */}
          {/* SECTION 05: SERVICES & ADVISORY                          */}
          {/* ======================================================== */}
          {isSectionEnabled('SERVICES') && resolvedProfile.services.length > 0 && (
            <section
              id="section-profile-services"
              className="rounded-3xl bg-slate-800/80 border border-slate-700/80 p-6 sm:p-8 space-y-5"
            >
              <div className="flex items-center space-x-2 border-b border-slate-700/60 pb-3">
                <Layers className="w-5 h-5 text-teal-400" />
                <h2 className="text-lg font-bold text-white">Services & Advisory</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {resolvedProfile.services.map((svc, idx) => (
                  <div
                    key={svc.id || idx}
                    className="p-5 rounded-2xl bg-slate-900/70 border border-slate-700/70 hover:border-teal-500/40 transition flex flex-col justify-between space-y-3"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-teal-500/10 text-teal-300 border border-teal-500/20">
                          {svc.deliveryMode || 'Advisory'}
                        </span>
                        {svc.startingPrice && (
                          <span className="text-[11px] font-mono text-slate-400">
                            {svc.startingPrice}
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-bold text-white">{svc.title}</h3>
                      <p className="text-xs text-slate-300 leading-relaxed">{svc.description}</p>
                    </div>

                    <button
                      onClick={handleConnect}
                      className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-teal-300 text-xs font-semibold border border-slate-700 transition text-center"
                    >
                      {svc.ctaLabel || 'Inquire About Service'} →
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ======================================================== */}
          {/* SECTION 06: PROJECTS & PORTFOLIO                         */}
          {/* ======================================================== */}
          {isSectionEnabled('PORTFOLIO') && resolvedProfile.projects.length > 0 && (
            <section
              id="section-profile-projects"
              className="rounded-3xl bg-slate-800/80 border border-slate-700/80 p-6 sm:p-8 space-y-5"
            >
              <div className="flex items-center space-x-2 border-b border-slate-700/60 pb-3">
                <FolderGit2 className="w-5 h-5 text-teal-400" />
                <h2 className="text-lg font-bold text-white">Projects & Case Studies</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {resolvedProfile.projects.map((proj, idx) => (
                  <div
                    key={proj.id || idx}
                    className="p-5 rounded-2xl bg-slate-900/70 border border-slate-700/70 flex flex-col justify-between space-y-3"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-teal-300">
                          {proj.organizationOrClient || 'Enterprise Initiative'}
                        </span>
                        {proj.role && (
                          <span className="text-[11px] text-slate-400">{proj.role}</span>
                        )}
                      </div>
                      <h3 className="text-sm sm:text-base font-bold text-white">{proj.title}</h3>
                      <p className="text-xs text-slate-300 leading-relaxed">{proj.description}</p>

                      {proj.outcome && (
                        <div className="p-3 rounded-xl bg-teal-950/30 border border-teal-800/40">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-teal-400 block">
                            Key Outcome / Metric
                          </span>
                          <p className="text-xs text-teal-200 mt-0.5">{proj.outcome}</p>
                        </div>
                      )}
                    </div>

                    {proj.technologies && proj.technologies.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {proj.technologies.map((t, tIdx) => (
                          <span
                            key={tIdx}
                            className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 text-[10px] font-mono border border-slate-700"
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
          {/* SECTION 07: EDUCATION & CERTIFICATIONS                   */}
          {/* ======================================================== */}
          {((isSectionEnabled('EDUCATION') && resolvedProfile.education.length > 0) ||
            (isSectionEnabled('CREDENTIALS') && resolvedProfile.credentials.length > 0)) && (
            <section
              id="section-profile-education-credentials"
              className="rounded-3xl bg-slate-800/80 border border-slate-700/80 p-6 sm:p-8 space-y-6"
            >
              <div className="flex items-center space-x-2 border-b border-slate-700/60 pb-3">
                <GraduationCap className="w-5 h-5 text-teal-400" />
                <h2 className="text-lg font-bold text-white">Education & Certifications</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Academic History */}
                {resolvedProfile.education.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center">
                      <GraduationCap className="w-4 h-4 mr-1.5 text-teal-400" />
                      Academic Background
                    </h3>
                    <div className="space-y-3">
                      {resolvedProfile.education.map((edu, idx) => (
                        <div
                          key={edu.id || idx}
                          className="p-4 rounded-2xl bg-slate-900/70 border border-slate-700/70 space-y-1"
                        >
                          <div className="flex items-start justify-between">
                            <span className="text-xs sm:text-sm font-bold text-white">
                              {edu.qualification}
                            </span>
                            {edu.startDate && (
                              <span className="text-[10px] font-mono text-slate-400">
                                {edu.startDate} – {edu.endDate || 'Present'}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-teal-300 font-semibold">{edu.institution}</p>
                          {edu.field && (
                            <p className="text-[11px] text-slate-400">{edu.field}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Professional Certifications */}
                {resolvedProfile.credentials.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center">
                      <Award className="w-4 h-4 mr-1.5 text-amber-400" />
                      Verified Certifications
                    </h3>
                    <div className="space-y-3">
                      {resolvedProfile.credentials.map((cred, idx) => (
                        <div
                          key={cred.id || idx}
                          className="p-4 rounded-2xl bg-slate-900/70 border border-slate-700/70 space-y-1"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-xs sm:text-sm font-bold text-white">
                              {cred.title}
                            </span>
                            {cred.year && (
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                                {cred.year}
                              </span>
                            )}
                          </div>
                          {cred.issuer && (
                            <p className="text-xs text-slate-400">{cred.issuer}</p>
                          )}
                          {cred.credentialId && (
                            <p className="text-[10px] font-mono text-slate-500">
                              ID: {cred.credentialId}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ======================================================== */}
          {/* SECTION 08: ACHIEVEMENTS & HONORS                        */}
          {/* ======================================================== */}
          {isSectionEnabled('ACHIEVEMENTS') && resolvedProfile.achievements.length > 0 && (
            <section
              id="section-profile-achievements"
              className="rounded-3xl bg-slate-800/80 border border-slate-700/80 p-6 sm:p-8 space-y-5"
            >
              <div className="flex items-center space-x-2 border-b border-slate-700/60 pb-3">
                <Trophy className="w-5 h-5 text-amber-400" />
                <h2 className="text-lg font-bold text-white">Awards & Recognition</h2>
              </div>

              <div className="space-y-3">
                {resolvedProfile.achievements.map((ach, idx) => (
                  <div
                    key={ach.id || idx}
                    className="p-4 rounded-2xl bg-slate-900/70 border border-slate-700/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <h3 className="text-sm font-bold text-white">{ach.title}</h3>
                      {ach.issuerOrEvent && (
                        <p className="text-xs text-amber-300 font-semibold mt-0.5">
                          {ach.issuerOrEvent}
                        </p>
                      )}
                      {ach.description && (
                        <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                          {ach.description}
                        </p>
                      )}
                    </div>
                    {ach.year && (
                      <span className="self-start sm:self-center shrink-0 text-xs font-mono text-slate-400 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700">
                        {ach.year}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ======================================================== */}
          {/* SECTION 09: TESTIMONIALS & REFERENCES                    */}
          {/* ======================================================== */}
          {isSectionEnabled('TESTIMONIALS') && resolvedProfile.testimonials.length > 0 && (
            <section
              id="section-profile-testimonials"
              className="rounded-3xl bg-slate-800/80 border border-slate-700/80 p-6 sm:p-8 space-y-5"
            >
              <div className="flex items-center space-x-2 border-b border-slate-700/60 pb-3">
                <MessageSquare className="w-5 h-5 text-teal-400" />
                <h2 className="text-lg font-bold text-white">Endorsements & Testimonials</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {resolvedProfile.testimonials.map((test, idx) => (
                  <div
                    key={test.id || idx}
                    className="p-5 rounded-2xl bg-slate-900/70 border border-slate-700/70 flex flex-col justify-between space-y-4"
                  >
                    <p className="text-xs sm:text-sm italic text-slate-200 leading-relaxed">
                      &ldquo;{test.quote}&rdquo;
                    </p>

                    <div className="flex items-center gap-3 pt-2 border-t border-slate-800">
                      {test.photoUrl ? (
                        <img
                          src={test.photoUrl}
                          alt={test.personName}
                          className="w-10 h-10 rounded-full object-cover border border-slate-700"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-teal-900/60 border border-teal-700 text-teal-200 font-bold flex items-center justify-center text-xs">
                          {test.personName[0]}
                        </div>
                      )}
                      <div>
                        <span className="text-xs font-bold text-white block">
                          {test.personName}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {test.designation} {test.company && `• ${test.company}`}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ======================================================== */}
          {/* SECTION 10: PROFESSIONAL LINKS                           */}
          {/* ======================================================== */}
          {isSectionEnabled('SOCIAL_PROFESSIONAL') && (
            <section
              id="section-profile-social-links"
              className="rounded-3xl bg-slate-800/80 border border-slate-700/80 p-6 sm:p-8 space-y-4"
            >
              <div className="flex items-center space-x-2 border-b border-slate-700/60 pb-3">
                <Globe className="w-5 h-5 text-teal-400" />
                <h2 className="text-lg font-bold text-white">Verified Professional Links</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {resolvedProfile.socialLinks.linkedin && (
                  <button
                    onClick={() => handleSocialClick('linkedin', resolvedProfile.socialLinks.linkedin)}
                    className="p-3 rounded-2xl bg-slate-900/70 hover:bg-slate-700/50 border border-slate-700 flex items-center justify-between text-xs font-semibold text-slate-200 transition text-left"
                  >
                    <div className="flex items-center space-x-2.5">
                      <Linkedin className="w-4 h-4 text-blue-400" />
                      <span>LinkedIn Profile</span>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                )}

                {resolvedProfile.socialLinks.github && (
                  <button
                    onClick={() => handleSocialClick('github', resolvedProfile.socialLinks.github)}
                    className="p-3 rounded-2xl bg-slate-900/70 hover:bg-slate-700/50 border border-slate-700 flex items-center justify-between text-xs font-semibold text-slate-200 transition text-left"
                  >
                    <div className="flex items-center space-x-2.5">
                      <Github className="w-4 h-4 text-slate-300" />
                      <span>GitHub</span>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                )}

                {resolvedProfile.socialLinks.twitter && (
                  <button
                    onClick={() => handleSocialClick('twitter', resolvedProfile.socialLinks.twitter)}
                    className="p-3 rounded-2xl bg-slate-900/70 hover:bg-slate-700/50 border border-slate-700 flex items-center justify-between text-xs font-semibold text-slate-200 transition text-left"
                  >
                    <div className="flex items-center space-x-2.5">
                      <Twitter className="w-4 h-4 text-sky-400" />
                      <span>X (Twitter)</span>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                )}

                {resolvedProfile.socialLinks.website && (
                  <button
                    onClick={() => handleSocialClick('website', resolvedProfile.socialLinks.website)}
                    className="p-3 rounded-2xl bg-slate-900/70 hover:bg-slate-700/50 border border-slate-700 flex items-center justify-between text-xs font-semibold text-slate-200 transition text-left"
                  >
                    <div className="flex items-center space-x-2.5">
                      <Globe className="w-4 h-4 text-teal-400" />
                      <span>Official Website</span>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                )}

                {resolvedProfile.socialLinks.portfolio && (
                  <button
                    onClick={() => handleSocialClick('portfolio', resolvedProfile.socialLinks.portfolio)}
                    className="p-3 rounded-2xl bg-slate-900/70 hover:bg-slate-700/50 border border-slate-700 flex items-center justify-between text-xs font-semibold text-slate-200 transition text-left"
                  >
                    <div className="flex items-center space-x-2.5">
                      <FolderGit2 className="w-4 h-4 text-purple-400" />
                      <span>Portfolio</span>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                )}

                {resolvedProfile.socialLinks.medium && (
                  <button
                    onClick={() => handleSocialClick('medium', resolvedProfile.socialLinks.medium)}
                    className="p-3 rounded-2xl bg-slate-900/70 hover:bg-slate-700/50 border border-slate-700 flex items-center justify-between text-xs font-semibold text-slate-200 transition text-left"
                  >
                    <div className="flex items-center space-x-2.5">
                      <Quote className="w-4 h-4 text-emerald-400" />
                      <span>Publications & Articles</span>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                )}
              </div>
            </section>
          )}

          {/* ======================================================== */}
          {/* SECTION 11: DIRECT CONTACT & CONNECT CALLOUT             */}
          {/* ======================================================== */}
          {isSectionEnabled('CONTACT') && (
            <section
              id="section-profile-contact"
              className="rounded-3xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/80 p-6 sm:p-8 space-y-6"
            >
              <div className="flex items-center space-x-2 border-b border-slate-700/60 pb-3">
                <Phone className="w-5 h-5 text-teal-400" />
                <h2 className="text-lg font-bold text-white">Direct Communication & Exchange</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                {resolvedProfile.email && (
                  <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-700 flex items-center space-x-3">
                    <Mail className="w-5 h-5 text-teal-400 shrink-0" />
                    <div className="truncate">
                      <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                        Email Address
                      </span>
                      <a
                        href={`mailto:${resolvedProfile.email}`}
                        className="text-slate-200 hover:text-teal-300 font-medium truncate block"
                      >
                        {resolvedProfile.email}
                      </a>
                    </div>
                  </div>
                )}

                {resolvedProfile.phone && (
                  <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-700 flex items-center space-x-3">
                    <Phone className="w-5 h-5 text-teal-400 shrink-0" />
                    <div className="truncate">
                      <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                        Phone / Mobile
                      </span>
                      <a
                        href={`tel:${resolvedProfile.phone}`}
                        className="text-slate-200 hover:text-teal-300 font-medium truncate block"
                      >
                        {resolvedProfile.phone}
                      </a>
                    </div>
                  </div>
                )}

                {resolvedProfile.whatsapp && (
                  <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-700 flex items-center space-x-3">
                    <MessageSquare className="w-5 h-5 text-emerald-400 shrink-0" />
                    <div className="truncate">
                      <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                        WhatsApp
                      </span>
                      <a
                        href={`https://wa.me/${resolvedProfile.whatsapp.replace(/[^0-9]/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-200 hover:text-emerald-300 font-medium truncate block"
                      >
                        {resolvedProfile.whatsapp}
                      </a>
                    </div>
                  </div>
                )}

                {resolvedProfile.website && (
                  <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-700 flex items-center space-x-3">
                    <Globe className="w-5 h-5 text-blue-400 shrink-0" />
                    <div className="truncate">
                      <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                        Web Portal
                      </span>
                      <a
                        href={sanitizeUrl(resolvedProfile.website)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-200 hover:text-blue-300 font-medium truncate block"
                      >
                        {resolvedProfile.website}
                      </a>
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom CTAs */}
              <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                <button
                  id="profile-footer-connect-btn"
                  onClick={handleConnect}
                  className="w-full sm:flex-1 py-3.5 px-6 rounded-2xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-lg shadow-teal-900/30 transition active:scale-95 flex items-center justify-center space-x-2"
                >
                  <Send className="w-4 h-4" />
                  <span>Exchange Contact / Connect</span>
                </button>

                <button
                  id="profile-footer-save-contact-btn"
                  onClick={handleSaveContact}
                  className="w-full sm:w-auto py-3.5 px-6 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold text-xs transition active:scale-95 flex items-center justify-center space-x-2"
                >
                  <Download className="w-4 h-4 text-teal-400" />
                  <span>Save Contact (vCard)</span>
                </button>
              </div>
            </section>
          )}
        </main>
      </div>

      {/* ======================================================== */}
      {/* PAGE FOOTER (Positioned below the fold)                   */}
      {/* ======================================================== */}
      <footer className="w-full py-8 text-center text-slate-500 font-sans select-none border-t border-slate-800/60">
        <p className="text-[11px] font-normal text-slate-400">
          Powered by{' '}
          <span className="font-semibold text-slate-300">Digital Business Card SaaS</span>
        </p>
        <p className="text-[9px] text-slate-500 mt-0.5 tracking-tight">
          Secure Multi-Tenant Cloud Architecture • RFC 6350 Compatible
        </p>
      </footer>

      {/* Connect Modal */}
      <ExchangeContactModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        employee={employee}
        company={company}
      />

      {/* Company Profile Drawer Modal */}
      {resolvedProfile.hasCompanyAssociation && (
        <CompanyProfileDrawerModal
          companySlug={company ? resolveCompanySlug(company) : ''}
          isOpen={isCompanyDrawerOpen}
          onClose={() => setIsCompanyDrawerOpen(false)}
          profile={resolvedProfile}
        />
      )}
    </div>
  );
};
