import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Employee, Department, Card } from '../../types';
import {
  DigitalIdentityProfile,
  ServiceItem,
  ExperienceItem,
  ProjectItem,
  EducationItem,
  CertificationItem,
  AchievementItem,
  TestimonialItem,
  ProfileMetric,
} from '../../types/cardProfile';
import { getEmployeeById, updateEmployee } from '../../services/employeeService';
import { getDepartmentById } from '../../services/departmentService';
import { getCardById, updateCard } from '../../services/cardService';
import { getDigitalIdentityProfile, saveDigitalIdentityProfile } from '../../services/digitalIdentityProfileService';
import { pilotService, CustomerReadinessReport } from '../../services/pilotService';
import { PublicCardView } from '../cards/PublicCardView';
import { ThemeScope } from '../../context/ThemeContext';
import { ThemeMode } from '../../types/theme';
import {
  CreditCard,
  QrCode,
  Share2,
  Copy,
  Check,
  Save,
  Download,
  ExternalLink,
  Shield,
  Smartphone,
  Sparkles,
  Briefcase,
  Award,
  Layers,
  Layout,
  Plus,
  Trash2,
  Phone,
  Mail,
  Globe,
  MapPin,
  GraduationCap,
  MessageSquareQuote,
  BarChart3,
  FileCode,
  FolderGit2,
} from 'lucide-react';
import QRCode from 'qrcode';
import { downloadVCard } from '../../services/vcardService';

interface EmployeePortalViewProps {
  onNavigateToCard?: (slug: string) => void;
}

export const EmployeePortalView: React.FC<EmployeePortalViewProps> = ({ onNavigateToCard }) => {
  const { userProfile, activeCompany } = useAuth();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [card, setCard] = useState<Card | null>(null);
  const [department, setDepartment] = useState<Department | null>(null);
  const [digitalProfile, setDigitalProfile] = useState<DigitalIdentityProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Tab Navigation
  const [activeTab, setActiveTab] = useState<
    'identity' | 'template' | 'contact' | 'services' | 'career' | 'qr'
  >('identity');

  // Core Identity
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [designation, setDesignation] = useState('');
  const [profilePhotoUrl, setProfilePhotoUrl] = useState('');
  const [heroImageUrl, setHeroImageUrl] = useState('');
  const [location, setLocation] = useState('');
  const [headline, setHeadline] = useState('');
  const [about, setAbout] = useState('');
  const [philosophy, setPhilosophy] = useState('');

  // Contact Coordinates
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');

  // Social Channels
  const [linkedin, setLinkedin] = useState('');
  const [twitter, setTwitter] = useState('');
  const [github, setGithub] = useState('');
  const [instagram, setInstagram] = useState('');
  const [youtube, setYoutube] = useState('');
  const [medium, setMedium] = useState('');
  const [portfolio, setPortfolio] = useState('');

  // Skills, Services & Metrics
  const [expertiseInput, setExpertiseInput] = useState('');
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [metrics, setMetrics] = useState<ProfileMetric[]>([]);

  // Career, Projects, Credentials & Testimonials
  const [experiences, setExperiences] = useState<ExperienceItem[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [education, setEducation] = useState<EducationItem[]>([]);
  const [credentials, setCredentials] = useState<CertificationItem[]>([]);
  const [achievements, setAchievements] = useState<AchievementItem[]>([]);
  const [testimonials, setTestimonials] = useState<TestimonialItem[]>([]);

  // Template & Appearance Selection
  const [selectedTemplate, setSelectedTemplate] = useState<'classic' | 'modern' | 'minimal'>('classic');
  const [appearanceMode, setAppearanceMode] = useState<ThemeMode>('system');
  const [customSlug, setCustomSlug] = useState('');

  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');

  // Pilot & Self-Service Lifecycle Modals (Directive 23)
  const [isReadinessModalOpen, setIsReadinessModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isDeletionModalOpen, setIsDeletionModalOpen] = useState(false);
  const [deletionReason, setDeletionReason] = useState('');
  const [deletionSubmitted, setDeletionSubmitted] = useState(false);

  const employeeId = userProfile?.employeeId || 'emp_acme_rahul';

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setLoading(true);
      try {
        const emp = await getEmployeeById(employeeId);
        if (emp && isMounted) {
          setEmployee(emp);
          setFirstName(emp.firstName || '');
          setLastName(emp.lastName || '');
          setDisplayName(emp.displayName || `${emp.firstName || ''} ${emp.lastName || ''}`.trim());
          setDesignation(emp.designation || '');
          setPhone(emp.phone || '');
          setWhatsapp(emp.whatsapp || '');
          setEmail(emp.email || '');
          setProfilePhotoUrl(emp.profilePhotoUrl || '');
          setWebsite(emp.website || '');
          setLinkedin(emp.linkedin || '');
          setInstagram(emp.instagram || '');

          if (emp.departmentId) {
            const dept = await getDepartmentById(emp.departmentId);
            if (isMounted) setDepartment(dept);
          }

          if (emp.cardId) {
            const c = await getCardById(emp.cardId);
            if (isMounted && c) {
              setCard(c);
              setSelectedTemplate(c.templateId);
              setCustomSlug(c.publicSlug);
            }
          }

          // Fetch digital identity profile
          const dip = await getDigitalIdentityProfile(emp.id);
          if (isMounted && dip) {
            setDigitalProfile(dip);
            setHeadline(dip.headline || '');
            setAbout(dip.about || emp.bio || '');
            setPhilosophy(dip.philosophy || '');
            setLocation(dip.location || '');
            setHeroImageUrl(dip.heroImageUrl || '');
            setExpertiseInput((dip.expertise || []).join(', '));

            // Normalize services
            if (dip.services && dip.services.length > 0) {
              const normServices: ServiceItem[] = dip.services.map((s, idx) => {
                if (typeof s === 'string') {
                  return { id: `srv_${idx + 1}`, title: s, description: 'Specialized consulting delivery', deliveryMode: 'Consulting' };
                }
                return s;
              });
              setServices(normServices);
            }

            setMetrics(dip.metrics || []);
            setExperiences(dip.experiences || []);
            setProjects(dip.projects || []);
            setEducation(dip.education || []);
            setCredentials(dip.credentials || []);
            setAchievements(dip.achievements || []);
            setTestimonials(dip.testimonials || []);

            setLinkedin(dip.socialLinks?.linkedin || emp.linkedin || '');
            setTwitter(dip.socialLinks?.twitter || '');
            setGithub(dip.socialLinks?.github || '');
            setInstagram(dip.socialLinks?.instagram || emp.instagram || '');
            setYoutube(dip.socialLinks?.youtube || '');
            setMedium(dip.socialLinks?.medium || '');
            setPortfolio(dip.socialLinks?.portfolio || '');

            if (dip.appearance?.mode) {
              setAppearanceMode(dip.appearance.mode);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load employee profile:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, [employeeId]);

  const publicSlug = customSlug || card?.publicSlug || employee?.displayName.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'card';
  const cardUrl = `${window.location.origin}${window.location.pathname}#card/${publicSlug}`;

  useEffect(() => {
    if (publicSlug) {
      QRCode.toDataURL(cardUrl, {
        width: 360,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      })
        .then(setQrDataUrl)
        .catch((err) => console.error('Error generating QR:', err));
    }
  }, [publicSlug, cardUrl]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(cardUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadQR = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `card-qr-${publicSlug}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadVCard = () => {
    if (!employee) return;
    downloadVCard(employee, activeCompany || undefined, department);
  };

  const handleTemplateChange = async (templateId: 'classic' | 'modern' | 'minimal') => {
    setSelectedTemplate(templateId);
    if (card) {
      const updated = { ...card, templateId };
      setCard(updated);
      try {
        await updateCard(card.id, { templateId });
      } catch (e) {
        console.error('Failed to update card template:', e);
      }
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee) return;

    setSaving(true);
    setSavedSuccess(false);

    try {
      // 1. Update Employee Authoritative contact coordinates
      const updatedEmp: Employee = {
        ...employee,
        firstName: firstName.trim() || employee.firstName,
        lastName: lastName.trim() || employee.lastName,
        displayName: displayName.trim() || `${firstName.trim()} ${lastName.trim()}`.trim() || employee.displayName,
        designation: designation.trim() || employee.designation,
        phone: phone.trim(),
        whatsapp: whatsapp.trim(),
        email: email.trim() || employee.email,
        bio: about.trim() || employee.bio,
        profilePhotoUrl: profilePhotoUrl.trim() || undefined,
        website: website.trim(),
        linkedin: linkedin.trim(),
        instagram: instagram.trim(),
        otherSocialLinks: {
          twitter: twitter.trim() || undefined,
          github: github.trim() || undefined,
          youtube: youtube.trim() || undefined,
          medium: medium.trim() || undefined,
          portfolio: portfolio.trim() || undefined,
        },
        updatedAt: new Date().toISOString(),
      };
      await updateEmployee(employee.id, updatedEmp);
      setEmployee(updatedEmp);

      // 2. Update Card Slug & Template if modified
      if (card) {
        const cleanedSlug = customSlug.trim()
          ? customSlug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
          : card.publicSlug;
        if (cleanedSlug !== card.publicSlug || selectedTemplate !== card.templateId) {
          await updateCard(card.id, { publicSlug: cleanedSlug, templateId: selectedTemplate });
          setCard({ ...card, publicSlug: cleanedSlug, templateId: selectedTemplate });
        }
      }

      // 3. Parse & Save Digital Identity Profile
      const parsedExpertise = expertiseInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const profileToSave: DigitalIdentityProfile = {
        id: employee.id,
        employeeId: employee.id,
        companyId: employee.companyId,
        headline: headline.trim(),
        about: about.trim() || updatedEmp.bio,
        philosophy: philosophy.trim(),
        location: location.trim(),
        heroImageUrl: heroImageUrl.trim() || undefined,
        expertise: parsedExpertise,
        services,
        metrics,
        experiences,
        projects,
        education,
        credentials,
        achievements,
        testimonials,
        socialLinks: {
          linkedin: linkedin.trim(),
          twitter: twitter.trim(),
          github: github.trim(),
          instagram: instagram.trim(),
          youtube: youtube.trim(),
          medium: medium.trim(),
          portfolio: portfolio.trim(),
          website: website.trim(),
        },
        appearance: { mode: appearanceMode },
        updatedAt: new Date().toISOString(),
      };

      await saveDigitalIdentityProfile(profileToSave);
      setDigitalProfile(profileToSave);

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to save profile:', err);
    } finally {
      setSaving(false);
    }
  };

  // Construct active digital profile for live preview
  const previewProfileOverride: DigitalIdentityProfile = {
    id: employee?.id || 'demo_emp',
    employeeId: employee?.id || 'demo_emp',
    companyId: employee?.companyId || 'demo_company',
    headline,
    about: about || employee?.bio,
    philosophy,
    location,
    heroImageUrl: heroImageUrl || undefined,
    expertise: expertiseInput.split(',').map((s) => s.trim()).filter(Boolean),
    services,
    metrics,
    experiences,
    projects,
    education,
    credentials,
    achievements,
    testimonials,
    socialLinks: {
      linkedin,
      twitter,
      github,
      instagram,
      youtube,
      medium,
      portfolio,
      website,
    },
    appearance: { mode: appearanceMode },
    updatedAt: new Date().toISOString(),
  };

  if (loading) {
    return (
      <div className="p-12 text-center bg-white rounded-3xl border border-slate-200">
        <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-xs text-slate-400 mt-2">Loading member digital card...</p>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
        <p className="text-xs text-slate-500">Employee profile not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Digital Identity & Public Business Card
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Self-service management for your verified digital card, professional narrative, services, and live QR code.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsReadinessModalOpen(true)}
            className="inline-flex items-center px-3 py-1.5 rounded-xl border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-bold shadow-2xs transition"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1 text-teal-600" /> Readiness Checklist
          </button>

          <button
            type="button"
            onClick={() => setIsExportModalOpen(true)}
            className="inline-flex items-center px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition"
          >
            <Download className="w-3.5 h-3.5 mr-1 text-slate-400" /> Export My Data
          </button>

          <button
            type="button"
            onClick={handleCopyLink}
            className="inline-flex items-center px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" /> Copied Link!
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 mr-1 text-slate-400" /> Copy Card URL
              </>
            )}
          </button>

          {onNavigateToCard && (
            <button
              type="button"
              onClick={() => onNavigateToCard(publicSlug)}
              className="inline-flex items-center px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition"
            >
              <ExternalLink className="w-3.5 h-3.5 mr-1" /> Open Public Card
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-2 sm:gap-6 text-xs font-semibold overflow-x-auto no-scrollbar pb-1">
        {[
          { id: 'identity', label: 'Identity & Bio', icon: Sparkles },
          { id: 'template', label: 'Template & Layout', icon: Layout },
          { id: 'contact', label: 'Contact & Socials', icon: Phone },
          { id: 'services', label: `Services & Skills (${services.length})`, icon: Briefcase },
          { id: 'career', label: `Career & Proof (${experiences.length + projects.length + credentials.length})`, icon: Award },
          { id: 'qr', label: 'QR Code & Export', icon: QrCode },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`pb-2.5 px-1 border-b-2 flex items-center whitespace-nowrap transition ${
                isActive
                  ? 'border-teal-600 text-teal-700 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5 mr-1.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 7 Columns: Form or Settings */}
        <div className="lg:col-span-7 space-y-6">
          {/* ========================================================= */}
          {/* TAB 1: IDENTITY & BIO                                    */}
          {/* ========================================================= */}
          {activeTab === 'identity' && (
            <form onSubmit={handleSaveProfile} className="space-y-6 text-xs">
              {/* Read-Only Corporate Info Box */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-3xl p-5 text-xs text-slate-600 space-y-3">
                <div className="flex items-center space-x-2 font-semibold text-slate-800">
                  <Shield className="w-4 h-4 text-teal-600" />
                  <span>Verified Corporate Credentials</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Designation</span>
                    <span className="font-semibold text-slate-900">{employee.designation}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Department</span>
                    <span className="font-semibold text-slate-900">{department?.name || 'Leadership'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Corporate Email</span>
                    <span className="font-semibold text-slate-900 truncate block">{employee.email}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Authoritative Slug</span>
                    <span className="font-mono text-slate-700">/{publicSlug}</span>
                  </div>
                </div>
              </div>

              {/* Core Identity Details */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
                <h2 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100 flex items-center">
                  <Sparkles className="w-4 h-4 text-teal-600 mr-2" />
                  Personal Identity & Narrative
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">First Name</label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Last Name</label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-slate-700 mb-1">Professional Display Name</label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Professional Designation / Title</label>
                    <input
                      type="text"
                      value={designation}
                      onChange={(e) => setDesignation(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Location / Office Hub</label>
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="e.g. San Francisco, CA"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-slate-700 mb-1">Profile Photo URL</label>
                    <div className="flex items-center space-x-3">
                      <input
                        type="url"
                        value={profilePhotoUrl}
                        onChange={(e) => setProfilePhotoUrl(e.target.value)}
                        placeholder="https://images.unsplash.com/..."
                        className="flex-1 px-3 py-2 rounded-xl border border-slate-200 font-mono text-[11px]"
                      />
                      {profilePhotoUrl && (
                        <img
                          src={profilePhotoUrl}
                          alt="Avatar preview"
                          className="w-9 h-9 rounded-full object-cover border border-slate-200"
                        />
                      )}
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-slate-700 mb-1">Hero Banner Image URL (Optional)</label>
                    <input
                      type="url"
                      value={heroImageUrl}
                      onChange={(e) => setHeroImageUrl(e.target.value)}
                      placeholder="https://images.unsplash.com/..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-[11px]"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-slate-700 mb-1">Professional Headline / Tagline</label>
                    <input
                      type="text"
                      value={headline}
                      onChange={(e) => setHeadline(e.target.value)}
                      placeholder="e.g. Architecting high-scale distributed systems and enterprise zero-trust infrastructure."
                      className="w-full px-3 py-2 rounded-xl border border-slate-200"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-slate-700 mb-1">Executive Biography / About</label>
                    <textarea
                      rows={4}
                      value={about}
                      onChange={(e) => setAbout(e.target.value)}
                      placeholder="Detailed background, areas of operational focus, and executive career milestones..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-200"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-slate-700 mb-1">Personal Philosophy / Quote</label>
                    <input
                      type="text"
                      value={philosophy}
                      onChange={(e) => setPhilosophy(e.target.value)}
                      placeholder="e.g. Elegant architectures are forged at the intersection of simplicity and discipline."
                      className="w-full px-3 py-2 rounded-xl border border-slate-200"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  {savedSuccess ? (
                    <span className="text-xs font-semibold text-emerald-600 inline-flex items-center">
                      <Check className="w-4 h-4 mr-1.5" /> Profile updated successfully!
                    </span>
                  ) : (
                    <span></span>
                  )}

                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold shadow-sm transition disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5 mr-1.5" />
                    {saving ? 'Publishing...' : 'Save & Publish Identity'}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* ========================================================= */}
          {/* TAB 2: TEMPLATE & LAYOUT                                  */}
          {/* ========================================================= */}
          {activeTab === 'template' && (
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-6">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Visual Card Template</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select your visual layout template. Switching templates adapts formatting without losing identity data.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Classic */}
                <div
                  onClick={() => handleTemplateChange('classic')}
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition flex flex-col justify-between ${
                    selectedTemplate === 'classic'
                      ? 'border-teal-600 bg-teal-50/40 text-slate-900 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300 text-slate-600'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Layout className="w-5 h-5 text-teal-700" />
                      {selectedTemplate === 'classic' && <Check className="w-4 h-4 text-teal-700" />}
                    </div>
                    <h3 className="text-xs font-bold text-slate-900">Executive Classic</h3>
                    <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                      Header banner, centered profile avatar, prominent designation hierarchy.
                    </p>
                  </div>
                  <span className="mt-4 text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 w-fit">
                    Corporate Standard
                  </span>
                </div>

                {/* Modern */}
                <div
                  onClick={() => handleTemplateChange('modern')}
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition flex flex-col justify-between ${
                    selectedTemplate === 'modern'
                      ? 'border-blue-600 bg-blue-50/40 text-slate-900 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300 text-slate-600'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Sparkles className="w-5 h-5 text-blue-700" />
                      {selectedTemplate === 'modern' && <Check className="w-4 h-4 text-blue-700" />}
                    </div>
                    <h3 className="text-xs font-bold text-slate-900">Dynamic Modern</h3>
                    <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                      Gradient canvas banner with badge card overlay and competency chips.
                    </p>
                  </div>
                  <span className="mt-4 text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 w-fit">
                    High Impact
                  </span>
                </div>

                {/* Minimal */}
                <div
                  onClick={() => handleTemplateChange('minimal')}
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition flex flex-col justify-between ${
                    selectedTemplate === 'minimal'
                      ? 'border-stone-800 bg-stone-100 text-slate-900 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300 text-slate-600'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <CreditCard className="w-5 h-5 text-stone-700" />
                      {selectedTemplate === 'minimal' && <Check className="w-4 h-4 text-stone-900" />}
                    </div>
                    <h3 className="text-xs font-bold text-slate-900">Editorial Minimal</h3>
                    <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                      Monochrome typography, serif headings, and generous negative space.
                    </p>
                  </div>
                  <span className="mt-4 text-[10px] font-mono px-2 py-0.5 rounded-full bg-stone-200 text-stone-800 w-fit">
                    Swiss Minimal
                  </span>
                </div>
              </div>

              {/* Appearance Mode Configuration */}
              <div className="pt-4 border-t border-slate-200/80 space-y-3">
                <div>
                  <h3 className="text-xs font-bold text-slate-900">Card Appearance Mode</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Configure default light, dark, or system matching for your public card.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setAppearanceMode('light')}
                    className={`p-3 rounded-2xl border-2 text-left transition flex flex-col justify-between ${
                      appearanceMode === 'light'
                        ? 'border-teal-600 bg-teal-50/40 text-slate-900 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300 text-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">Light Mode</span>
                      {appearanceMode === 'light' && <Check className="w-4 h-4 text-teal-600" />}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">Crisp corporate presentation on white canvas.</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAppearanceMode('dark')}
                    className={`p-3 rounded-2xl border-2 text-left transition flex flex-col justify-between ${
                      appearanceMode === 'dark'
                        ? 'border-teal-600 bg-teal-50/40 text-slate-900 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300 text-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">Dark Mode</span>
                      {appearanceMode === 'dark' && <Check className="w-4 h-4 text-teal-600" />}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">Deep obsidian contrast with luminous accents.</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAppearanceMode('system')}
                    className={`p-3 rounded-2xl border-2 text-left transition flex flex-col justify-between ${
                      appearanceMode === 'system'
                        ? 'border-teal-600 bg-teal-50/40 text-slate-900 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300 text-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">System (Auto)</span>
                      {appearanceMode === 'system' && <Check className="w-4 h-4 text-teal-600" />}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">Matches the visitor&apos;s OS preference.</p>
                  </button>
                </div>
              </div>

              {/* Public Slug Configuration */}
              <div className="pt-4 border-t border-slate-200/80 space-y-2 text-xs">
                <label className="block font-semibold text-slate-700">Custom Public Slug</label>
                <div className="flex items-center">
                  <span className="px-3 py-2 bg-slate-100 border border-r-0 border-slate-200 rounded-l-xl text-slate-500 font-mono text-[11px]">
                    #/card/
                  </span>
                  <input
                    type="text"
                    value={customSlug}
                    onChange={(e) => setCustomSlug(e.target.value)}
                    placeholder="firstname-lastname"
                    className="flex-1 px-3 py-2 border border-slate-200 rounded-r-xl font-mono text-[11px]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 3: CONTACT & SOCIALS                                  */}
          {/* ========================================================= */}
          {activeTab === 'contact' && (
            <form onSubmit={handleSaveProfile} className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4 text-xs">
              <h2 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100 flex items-center">
                <Phone className="w-4 h-4 text-teal-600 mr-2" />
                Contact Coordinates & Social Channels
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Direct Phone</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">WhatsApp Number</label>
                  <input
                    type="text"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    placeholder="+14158902341"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Direct / Corporate Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Personal / Portfolio Website</label>
                  <input
                    type="url"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://example.com"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">LinkedIn Profile</label>
                  <input
                    type="url"
                    value={linkedin}
                    onChange={(e) => setLinkedin(e.target.value)}
                    placeholder="https://linkedin.com/in/username"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-[11px]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Twitter / X URL</label>
                  <input
                    type="url"
                    value={twitter}
                    onChange={(e) => setTwitter(e.target.value)}
                    placeholder="https://twitter.com/username"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-[11px]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">GitHub Profile</label>
                  <input
                    type="url"
                    value={github}
                    onChange={(e) => setGithub(e.target.value)}
                    placeholder="https://github.com/username"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-[11px]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Instagram URL</label>
                  <input
                    type="url"
                    value={instagram}
                    onChange={(e) => setInstagram(e.target.value)}
                    placeholder="https://instagram.com/username"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-[11px]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">YouTube Channel</label>
                  <input
                    type="url"
                    value={youtube}
                    onChange={(e) => setYoutube(e.target.value)}
                    placeholder="https://youtube.com/@channel"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-[11px]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Medium / Blog URL</label>
                  <input
                    type="url"
                    value={medium}
                    onChange={(e) => setMedium(e.target.value)}
                    placeholder="https://medium.com/@username"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-[11px]"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                {savedSuccess ? (
                  <span className="text-xs font-semibold text-emerald-600 inline-flex items-center">
                    <Check className="w-4 h-4 mr-1.5" /> Contacts saved successfully!
                  </span>
                ) : (
                  <span></span>
                )}

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold shadow-sm transition disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5 mr-1.5" />
                  {saving ? 'Saving...' : 'Save Contacts'}
                </button>
              </div>
            </form>
          )}

          {/* ========================================================= */}
          {/* TAB 4: SERVICES & SKILLS                                  */}
          {/* ========================================================= */}
          {activeTab === 'services' && (
            <form onSubmit={handleSaveProfile} className="space-y-6 text-xs">
              {/* Skills */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-3">
                <h2 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100 flex items-center">
                  <Sparkles className="w-4 h-4 text-teal-600 mr-2" />
                  Core Competencies & Skills
                </h2>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Areas of Expertise (Comma-separated)
                  </label>
                  <input
                    type="text"
                    value={expertiseInput}
                    onChange={(e) => setExpertiseInput(e.target.value)}
                    placeholder="Cloud Architecture, Distributed Systems, Zero-Trust Security, SaaS Scaling"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  />
                </div>
              </div>

              {/* Services Offered */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <h2 className="text-sm font-bold text-slate-900 flex items-center">
                    <Briefcase className="w-4 h-4 text-blue-600 mr-2" />
                    Professional Services & Consulting
                  </h2>
                  <button
                    type="button"
                    onClick={() => {
                      setServices([
                        ...services,
                        {
                          id: `srv_${Date.now()}`,
                          title: 'New Service',
                          description: 'Consulting and advisory delivery in specialized area.',
                          deliveryMode: 'Consulting',
                          startingPrice: 'Custom Plan',
                          ctaLabel: 'Enquire for Details',
                        },
                      ]);
                    }}
                    className="inline-flex items-center px-3 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-semibold"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Service
                  </button>
                </div>

                <div className="space-y-3">
                  {services.map((s, idx) => (
                    <div key={s.id || idx} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <input
                          type="text"
                          value={s.title}
                          onChange={(e) => {
                            const updated = [...services];
                            updated[idx] = { ...updated[idx], title: e.target.value };
                            setServices(updated);
                          }}
                          placeholder="Service Title"
                          className="font-bold text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-slate-200 text-xs flex-1 mr-2"
                        />
                        <button
                          type="button"
                          onClick={() => setServices(services.filter((_, i) => i !== idx))}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <textarea
                        rows={2}
                        value={s.description}
                        onChange={(e) => {
                          const updated = [...services];
                          updated[idx] = { ...updated[idx], description: e.target.value };
                          setServices(updated);
                        }}
                        placeholder="Service description and scope..."
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Profile Metrics */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <h2 className="text-sm font-bold text-slate-900 flex items-center">
                    <BarChart3 className="w-4 h-4 text-emerald-600 mr-2" />
                    Public Proof Metrics
                  </h2>
                  <button
                    type="button"
                    onClick={() => setMetrics([...metrics, { label: 'Metric Name', value: '10+' }])}
                    className="inline-flex items-center px-3 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-semibold"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Metric
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {metrics.map((m, idx) => (
                    <div key={idx} className="p-3 rounded-2xl border border-slate-200 bg-slate-50/50 flex items-center gap-2">
                      <input
                        type="text"
                        value={m.value}
                        onChange={(e) => {
                          const updated = [...metrics];
                          updated[idx] = { ...updated[idx], value: e.target.value };
                          setMetrics(updated);
                        }}
                        placeholder="Value (e.g. 12+ Yrs)"
                        className="w-24 px-2 py-1 rounded-lg border border-slate-200 bg-white font-bold"
                      />
                      <input
                        type="text"
                        value={m.label}
                        onChange={(e) => {
                          const updated = [...metrics];
                          updated[idx] = { ...updated[idx], label: e.target.value };
                          setMetrics(updated);
                        }}
                        placeholder="Label (e.g. Experience)"
                        className="flex-1 px-2 py-1 rounded-lg border border-slate-200 bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => setMetrics(metrics.filter((_, i) => i !== idx))}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  {savedSuccess ? (
                    <span className="text-xs font-semibold text-emerald-600 inline-flex items-center">
                      <Check className="w-4 h-4 mr-1.5" /> Services saved!
                    </span>
                  ) : (
                    <span></span>
                  )}

                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold shadow-sm transition disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5 mr-1.5" />
                    {saving ? 'Saving...' : 'Save Services & Skills'}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* ========================================================= */}
          {/* TAB 5: CAREER & PROOF                                     */}
          {/* ========================================================= */}
          {activeTab === 'career' && (
            <form onSubmit={handleSaveProfile} className="space-y-6 text-xs">
              {/* Experiences */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <h2 className="text-sm font-bold text-slate-900 flex items-center">
                    <Briefcase className="w-4 h-4 text-teal-600 mr-2" />
                    Career Timeline & Experience
                  </h2>
                  <button
                    type="button"
                    onClick={() => {
                      setExperiences([
                        ...experiences,
                        {
                          id: `exp_${Date.now()}`,
                          organization: 'Organization Name',
                          role: 'Role Title',
                          startDate: '2022',
                          endDate: 'Present',
                          description: 'Key leadership responsibilities and accomplishments.',
                        },
                      ]);
                    }}
                    className="inline-flex items-center px-3 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-semibold"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Experience
                  </button>
                </div>

                <div className="space-y-3">
                  {experiences.map((exp, idx) => (
                    <div key={exp.id || idx} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="grid grid-cols-2 gap-2 flex-1 mr-2">
                          <input
                            type="text"
                            value={exp.role}
                            onChange={(e) => {
                              const updated = [...experiences];
                              updated[idx] = { ...updated[idx], role: e.target.value };
                              setExperiences(updated);
                            }}
                            placeholder="Role Title"
                            className="font-bold text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-slate-200"
                          />
                          <input
                            type="text"
                            value={exp.organization}
                            onChange={(e) => {
                              const updated = [...experiences];
                              updated[idx] = { ...updated[idx], organization: e.target.value };
                              setExperiences(updated);
                            }}
                            placeholder="Organization / Company"
                            className="bg-white px-2.5 py-1 rounded-lg border border-slate-200"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => setExperiences(experiences.filter((_, i) => i !== idx))}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <textarea
                        rows={2}
                        value={exp.description}
                        onChange={(e) => {
                          const updated = [...experiences];
                          updated[idx] = { ...updated[idx], description: e.target.value };
                          setExperiences(updated);
                        }}
                        placeholder="Leadership impact and deliverables..."
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Projects */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <h2 className="text-sm font-bold text-slate-900 flex items-center">
                    <FolderGit2 className="w-4 h-4 text-blue-600 mr-2" />
                    Portfolio & Featured Projects
                  </h2>
                  <button
                    type="button"
                    onClick={() => {
                      setProjects([
                        ...projects,
                        {
                          id: `proj_${Date.now()}`,
                          title: 'Project Title',
                          description: 'Scope and technical delivery of project.',
                          outcome: 'Measurable impact and outcome.',
                        },
                      ]);
                    }}
                    className="inline-flex items-center px-3 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-semibold"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Project
                  </button>
                </div>

                <div className="space-y-3">
                  {projects.map((proj, idx) => (
                    <div key={proj.id || idx} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <input
                          type="text"
                          value={proj.title}
                          onChange={(e) => {
                            const updated = [...projects];
                            updated[idx] = { ...updated[idx], title: e.target.value };
                            setProjects(updated);
                          }}
                          placeholder="Project Title"
                          className="font-bold text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-slate-200 flex-1 mr-2"
                        />
                        <button
                          type="button"
                          onClick={() => setProjects(projects.filter((_, i) => i !== idx))}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <textarea
                        rows={2}
                        value={proj.description}
                        onChange={(e) => {
                          const updated = [...projects];
                          updated[idx] = { ...updated[idx], description: e.target.value };
                          setProjects(updated);
                        }}
                        placeholder="Project description and architecture..."
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Certifications & Credentials */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <h2 className="text-sm font-bold text-slate-900 flex items-center">
                    <Award className="w-4 h-4 text-amber-600 mr-2" />
                    Verified Credentials & Certifications
                  </h2>
                  <button
                    type="button"
                    onClick={() => {
                      setCredentials([
                        ...credentials,
                        {
                          title: 'Verified Certification',
                          issuer: activeCompany?.name || 'Verified Org',
                          year: '2025',
                        },
                      ]);
                    }}
                    className="inline-flex items-center px-3 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-semibold"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Credential
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {credentials.map((cred, idx) => (
                    <div key={idx} className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <input
                          type="text"
                          value={cred.title}
                          onChange={(e) => {
                            const updated = [...credentials];
                            updated[idx] = { ...updated[idx], title: e.target.value };
                            setCredentials(updated);
                          }}
                          placeholder="Credential Title"
                          className="font-bold text-slate-900 bg-white px-2 py-1 rounded-lg border border-slate-200 flex-1 mr-2"
                        />
                        <button
                          type="button"
                          onClick={() => setCredentials(credentials.filter((_, i) => i !== idx))}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={cred.issuer || ''}
                          onChange={(e) => {
                            const updated = [...credentials];
                            updated[idx] = { ...updated[idx], issuer: e.target.value };
                            setCredentials(updated);
                          }}
                          placeholder="Issuer"
                          className="bg-white px-2 py-1 rounded-lg border border-slate-200"
                        />
                        <input
                          type="text"
                          value={cred.year || ''}
                          onChange={(e) => {
                            const updated = [...credentials];
                            updated[idx] = { ...updated[idx], year: e.target.value };
                            setCredentials(updated);
                          }}
                          placeholder="Year"
                          className="bg-white px-2 py-1 rounded-lg border border-slate-200"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  {savedSuccess ? (
                    <span className="text-xs font-semibold text-emerald-600 inline-flex items-center">
                      <Check className="w-4 h-4 mr-1.5" /> Career details saved!
                    </span>
                  ) : (
                    <span></span>
                  )}

                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold shadow-sm transition disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5 mr-1.5" />
                    {saving ? 'Saving...' : 'Save Career & Credentials'}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* ========================================================= */}
          {/* TAB 6: QR CODE & EXPORT                                   */}
          {/* ========================================================= */}
          {activeTab === 'qr' && (
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center gap-6">
              {qrDataUrl && (
                <img
                  src={qrDataUrl}
                  alt="QR Code"
                  className="w-44 h-44 rounded-2xl border border-slate-200 p-2 shadow-2xs shrink-0"
                />
              )}
              <div className="space-y-3 text-center sm:text-left">
                <h3 className="text-sm font-bold text-slate-900">Your High-Resolution Public QR Code</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Scan with any smartphone camera to instantly access your digital identity card, download your RFC 6350 vCard, or initiate a bidirectional contact exchange.
                </p>
                <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadQR}
                    className="inline-flex items-center px-3.5 py-2 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-semibold transition"
                  >
                    <Download className="w-3.5 h-3.5 mr-1.5" /> Download QR Image
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadVCard}
                    className="inline-flex items-center px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition"
                  >
                    <Download className="w-3.5 h-3.5 mr-1.5" /> Download vCard (.vcf)
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="inline-flex items-center px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition"
                  >
                    <Copy className="w-3.5 h-3.5 mr-1.5 text-slate-400" /> Copy Direct Link
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right 5 Columns: Real-Time Live Preview */}
        <div className="lg:col-span-5 sticky top-20">
          <div className="bg-slate-900 text-white px-4 py-2.5 rounded-t-3xl text-xs font-semibold flex items-center justify-between">
            <span className="flex items-center">
              <Smartphone className="w-4 h-4 mr-2 text-teal-400" />
              Live Identity Preview
            </span>
            <span className="text-[10px] text-teal-400 uppercase font-mono font-bold">
              {selectedTemplate.toUpperCase()}
            </span>
          </div>

          <div className="bg-slate-100 dark:bg-slate-950 p-4 rounded-b-3xl border border-slate-200/80 dark:border-slate-800 shadow-md transition-colors">
            {card && (
              <ThemeScope mode={appearanceMode}>
                <PublicCardView
                  card={{ ...card, templateId: selectedTemplate }}
                  employee={{
                    ...employee,
                    firstName,
                    lastName,
                    displayName,
                    designation,
                    phone,
                    whatsapp,
                    email,
                    profilePhotoUrl,
                    website,
                    linkedin,
                    instagram,
                  }}
                  company={activeCompany || undefined}
                  department={department}
                  profileOverride={previewProfileOverride}
                  interactive={false}
                />
              </ThemeScope>
            )}
          </div>
        </div>
      </div>

      {/* Customer Readiness Checklist Modal */}
      {isReadinessModalOpen && employee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-teal-600" />
                <h3 className="text-sm font-bold text-slate-900">Your Identity Readiness Checklist</h3>
              </div>
              <button
                onClick={() => setIsReadinessModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <Check className="w-4 h-4" />
              </button>
            </div>

            {(() => {
              const report = pilotService.calculateIndividualReadiness(employee, null);
              return (
                <>
                  <div className="py-3 flex items-center justify-between bg-teal-50 p-3 rounded-2xl border border-teal-100 my-2">
                    <span className="text-xs font-bold text-teal-900">Readiness Score</span>
                    <span className="text-sm font-extrabold text-teal-700 font-mono">{report.score}%</span>
                  </div>

                  <div className="space-y-2 overflow-y-auto flex-1 py-2">
                    {report.items.map((item) => (
                      <div
                        key={item.id}
                        className={`p-2.5 rounded-xl border flex items-start space-x-2.5 text-xs ${
                          item.completed ? 'bg-emerald-50/40 border-emerald-200' : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <span className="pt-0.5 shrink-0 text-emerald-600">
                          {item.completed ? '✓' : '○'}
                        </span>
                        <div>
                          <div className="font-bold text-slate-900">{item.title}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5">{item.details}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setIsReadinessModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Data Export Modal */}
      {isExportModalOpen && employee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Download className="w-4 h-4 text-teal-600" />
                <h3 className="text-sm font-bold text-slate-900">Export Your Personal Business Identity</h3>
              </div>
              <button
                onClick={() => setIsExportModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500 my-3 leading-relaxed">
              In accordance with data portability and GDPR/CCPA standards, you can download a complete, structured JSON package of your profile coordinates, bio, services, portfolio, and social links. Zero internal logs or administrative metadata are included.
            </p>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-slate-700 text-xs font-mono mb-4">
              File: {employee.displayName.toLowerCase().replace(/\s+/g, '_')}_dsbc_identity.json
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => setIsExportModalOpen(false)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const data = pilotService.exportIndividualData(employee, userProfile, null);
                  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${employee.displayName.toLowerCase().replace(/\s+/g, '_')}_dsbc_identity.json`;
                  a.click();
                  setIsExportModalOpen(false);
                }}
                className="px-4 py-1.5 rounded-xl bg-teal-600 text-white text-xs font-bold hover:bg-teal-500"
              >
                Download My Package
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
