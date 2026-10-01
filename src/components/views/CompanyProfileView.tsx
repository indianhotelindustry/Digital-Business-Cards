import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { updateCompany } from '../../services/companyService';
import { resolveCompanySlug } from '../../services/companyProfileResolver';
import {
  Palette,
  Building2,
  Globe,
  Mail,
  Phone,
  MapPin,
  Check,
  Save,
  ExternalLink,
  Sun,
  Moon,
  Laptop,
  Briefcase,
  Package,
  BarChart3,
  FileText,
  MessageSquareQuote,
  Clock,
  Plus,
  Trash2,
  Share2,
  Sparkles,
  Shield,
  Layers,
  Award,
} from 'lucide-react';
import { ThemeMode } from '../../types/theme';
import {
  CompanyServiceItem,
  CompanyProductItem,
  CompanyMetricItem,
  CompanyCaseStudyItem,
  CompanyTestimonialItem,
  CompanyCoreValue,
  CompanySocialLinks,
} from '../../types/companyProfile';

export const CompanyProfileView: React.FC = () => {
  const { activeCompany, refreshUserData } = useAuth();

  // Active Management Tab
  const [activeTab, setActiveTab] = useState<
    'identity' | 'overview' | 'services' | 'products' | 'metrics' | 'testimonials' | 'contact'
  >('identity');

  // Basic / Identity
  const [name, setName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [tagline, setTagline] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [heroImageUrl, setHeroImageUrl] = useState('');
  const [positioningStatement, setPositioningStatement] = useState('');
  const [industry, setIndustry] = useState('');
  const [foundedYear, setFoundedYear] = useState('');

  // Branding
  const [primaryColor, setPrimaryColor] = useState('#0f766e');
  const [secondaryColor, setSecondaryColor] = useState('#134e4a');
  const [accentColor, setAccentColor] = useState('#14b8a6');
  const [cardThemePreference, setCardThemePreference] = useState<'classic' | 'modern' | 'minimal'>('classic');
  const [showCompanyAddress, setShowCompanyAddress] = useState(true);
  const [appearanceMode, setAppearanceMode] = useState<ThemeMode>('dark');

  // Overview / Story
  const [description, setDescription] = useState('');
  const [mission, setMission] = useState('');
  const [vision, setVision] = useState('');
  const [coreValues, setCoreValues] = useState<CompanyCoreValue[]>([]);

  // Services
  const [services, setServices] = useState<CompanyServiceItem[]>([]);

  // Products
  const [products, setProducts] = useState<CompanyProductItem[]>([]);

  // Metrics & Case Studies
  const [metrics, setMetrics] = useState<CompanyMetricItem[]>([]);
  const [caseStudies, setCaseStudies] = useState<CompanyCaseStudyItem[]>([]);

  // Testimonials
  const [testimonials, setTestimonials] = useState<CompanyTestimonialItem[]>([]);

  // Contact Coordinates & Socials
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [website, setWebsite] = useState('');
  const [address, setAddress] = useState('');
  const [operatingHours, setOperatingHours] = useState('');
  const [socialLinks, setSocialLinks] = useState<CompanySocialLinks>({});

  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (activeCompany) {
      setName(activeCompany.name || '');
      setLegalName(activeCompany.legalName || '');
      setTagline(activeCompany.tagline || '');
      setLogoUrl(activeCompany.logoUrl || '');
      setHeroImageUrl(activeCompany.heroImageUrl || '');
      setPositioningStatement(activeCompany.positioningStatement || '');
      setIndustry(activeCompany.industry || '');
      setFoundedYear(activeCompany.foundedYear || '');

      setPrimaryColor(activeCompany.branding?.primaryColor || '#0f766e');
      setSecondaryColor(activeCompany.branding?.secondaryColor || '#134e4a');
      setAccentColor(activeCompany.branding?.accentColor || '#14b8a6');
      setCardThemePreference(activeCompany.branding?.cardThemePreference || 'classic');
      setShowCompanyAddress(activeCompany.branding?.showCompanyAddress !== false);
      setAppearanceMode(activeCompany.branding?.appearance?.mode || 'dark');

      setDescription(activeCompany.description || '');
      setMission(activeCompany.mission || '');
      setVision(activeCompany.vision || '');
      setCoreValues(activeCompany.coreValues || []);

      setServices(activeCompany.services || []);
      setProducts(activeCompany.products || []);
      setMetrics(activeCompany.metrics || []);
      setCaseStudies(activeCompany.caseStudies || []);
      setTestimonials(activeCompany.testimonials || []);

      setEmail(activeCompany.email || '');
      setPhone(activeCompany.phone || '');
      setWhatsapp(activeCompany.whatsapp || '');
      setWebsite(activeCompany.website || '');
      setAddress(activeCompany.address || '');
      setOperatingHours(activeCompany.operatingHours || '');
      setSocialLinks(activeCompany.socialLinks || {});
    }
  }, [activeCompany]);

  if (!activeCompany) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedSuccess(false);

    try {
      await updateCompany(activeCompany.id, {
        name: name.trim(),
        legalName: legalName.trim(),
        tagline: tagline.trim(),
        logoUrl: logoUrl.trim() || undefined,
        heroImageUrl: heroImageUrl.trim() || undefined,
        positioningStatement: positioningStatement.trim(),
        industry: industry.trim(),
        foundedYear: foundedYear.trim(),
        description: description.trim(),
        mission: mission.trim(),
        vision: vision.trim(),
        coreValues,
        services,
        products,
        metrics,
        caseStudies,
        testimonials,
        email: email.trim(),
        phone: phone.trim(),
        whatsapp: whatsapp.trim() || undefined,
        website: website.trim(),
        address: address.trim(),
        operatingHours: operatingHours.trim(),
        socialLinks,
        branding: {
          primaryColor,
          secondaryColor,
          accentColor,
          cardThemePreference,
          showCompanyAddress,
          appearance: { mode: appearanceMode },
        },
      });

      await refreshUserData();
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      console.error('Failed to update company profile:', err);
      alert(`Error updating profile: ${err.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  // Helper additions for lists
  const addCoreValue = () => {
    setCoreValues([
      ...coreValues,
      { title: 'New Core Value', description: 'Description of this foundational principle.', icon: 'Shield' },
    ]);
  };

  const removeCoreValue = (idx: number) => {
    setCoreValues(coreValues.filter((_, i) => i !== idx));
  };

  const addService = () => {
    const newId = `svc_${Date.now()}`;
    setServices([
      ...services,
      {
        id: newId,
        title: 'New Enterprise Service',
        description: 'Comprehensive business solution tailored to organizational requirements.',
        deliverables: ['Custom Scoping', 'Turnkey Delivery', 'Ongoing Support'],
        deliveryMode: 'Turnkey Solution',
        startingPrice: 'Custom Plan',
        ctaLabel: 'Enquire for Details',
        category: 'Consulting',
      },
    ]);
  };

  const removeService = (id: string) => {
    setServices(services.filter((s) => s.id !== id));
  };

  const addProduct = () => {
    const newId = `prod_${Date.now()}`;
    setProducts([
      ...products,
      {
        id: newId,
        title: 'New Product Innovation',
        category: 'Platform Solution',
        description: 'High-performance proprietary technology empowering distributed corporate operations.',
        features: ['Enterprise scalability', 'Zero-trust isolation', 'Instant cloud telemetry'],
        badge: 'New Release',
        actionLabel: 'Explore Product',
      },
    ]);
  };

  const removeProduct = (id: string) => {
    setProducts(products.filter((p) => p.id !== id));
  };

  const addMetric = () => {
    setMetrics([...metrics, { label: 'New Metric', value: '100+', description: 'Active deployments' }]);
  };

  const removeMetric = (idx: number) => {
    setMetrics(metrics.filter((_, i) => i !== idx));
  };

  const addCaseStudy = () => {
    const newId = `cs_${Date.now()}`;
    setCaseStudies([
      ...caseStudies,
      {
        id: newId,
        title: 'Enterprise Transformation Case Study',
        client: 'Global Corporate Client',
        industry: 'Technology & Enterprise',
        challenge: 'Legacy workflows resulted in latency and coordination friction across teams.',
        solution: 'Implemented unified digital platform with automated synchronization.',
        outcome: 'Achieved 40% efficiency improvement within the first quarter.',
        tags: ['Transformation', 'Productivity', 'Enterprise'],
      },
    ]);
  };

  const removeCaseStudy = (id: string) => {
    setCaseStudies(caseStudies.filter((c) => c.id !== id));
  };

  const addTestimonial = () => {
    const newId = `test_${Date.now()}`;
    setTestimonials([
      ...testimonials,
      {
        id: newId,
        quote: 'Working with this organization has elevated our team capability and customer satisfaction across all divisions.',
        clientName: 'Executive Leader',
        designation: 'Managing Director',
        companyName: 'Partner Enterprise',
        rating: 5,
      },
    ]);
  };

  const removeTestimonial = (id: string) => {
    setTestimonials(testimonials.filter((t) => t.id !== id));
  };

  const companySlug = resolveCompanySlug(activeCompany);

  return (
    <div className="max-w-5xl space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Company Profile & Mini-Website Self-Service
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage your organization identity, public mini-website content, service offerings, and verification proof.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              window.location.hash = `company/${companySlug}?preview=true`;
            }}
            className="inline-flex items-center px-3.5 py-2 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-xs font-semibold shadow-xs transition"
          >
            <Globe className="w-3.5 h-3.5 mr-1.5 text-teal-600" />
            <span>Preview Mini-Website</span>
            <ExternalLink className="w-3 h-3 ml-1 text-teal-500" />
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 gap-2 sm:gap-6 text-xs font-semibold overflow-x-auto no-scrollbar pb-1">
        {[
          { id: 'identity', label: 'Identity & Brand', icon: Building2 },
          { id: 'overview', label: 'Overview & Story', icon: Sparkles },
          { id: 'services', label: `Services (${services.length})`, icon: Briefcase },
          { id: 'products', label: `Products (${products.length})`, icon: Package },
          { id: 'metrics', label: `Metrics & Work (${metrics.length})`, icon: BarChart3 },
          { id: 'testimonials', label: `Testimonials (${testimonials.length})`, icon: MessageSquareQuote },
          { id: 'contact', label: 'Contact & Socials', icon: Phone },
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

      <form onSubmit={handleSave} className="space-y-6">
        {/* ========================================================= */}
        {/* TAB 1: IDENTITY & BRAND                                  */}
        {/* ========================================================= */}
        {activeTab === 'identity' && (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center space-x-2 pb-3 border-b border-slate-100">
                <Building2 className="w-4 h-4 text-teal-600" />
                <h2 className="text-sm font-bold text-slate-900">Organization Identity</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Company Display Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Legal Registered Entity Name</label>
                  <input
                    type="text"
                    value={legalName}
                    onChange={(e) => setLegalName(e.target.value)}
                    placeholder="e.g. Acme Innovations International Ltd."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-medium text-slate-700 mb-1">Company Tagline</label>
                  <input
                    type="text"
                    value={tagline}
                    onChange={(e) => setTagline(e.target.value)}
                    placeholder="e.g. Innovating today for a smarter tomorrow"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Company Logo URL</label>
                  <div className="flex items-center space-x-3">
                    <input
                      type="url"
                      placeholder="https://..."
                      value={logoUrl}
                      onChange={(e) => setLogoUrl(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono text-[11px]"
                    />
                    {logoUrl && (
                      <img
                        src={logoUrl}
                        alt="Logo preview"
                        className="w-9 h-9 rounded-lg object-contain bg-slate-50 border border-slate-200 p-1 shrink-0"
                      />
                    )}
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Hero / Banner Background Image URL</label>
                  <div className="flex items-center space-x-3">
                    <input
                      type="url"
                      placeholder="https://images.unsplash.com/..."
                      value={heroImageUrl}
                      onChange={(e) => setHeroImageUrl(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono text-[11px]"
                    />
                    {heroImageUrl && (
                      <img
                        src={heroImageUrl}
                        alt="Hero preview"
                        className="w-9 h-9 rounded-lg object-cover bg-slate-50 border border-slate-200 shrink-0"
                      />
                    )}
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Industry Classification</label>
                  <input
                    type="text"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    placeholder="e.g. Enterprise Software & Cloud Systems"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Founded Year</label>
                  <input
                    type="text"
                    value={foundedYear}
                    onChange={(e) => setFoundedYear(e.target.value)}
                    placeholder="e.g. 2018"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>
            </div>

            {/* Brand Colors & Presentation */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center space-x-2 pb-3 border-b border-slate-100">
                <Palette className="w-4 h-4 text-teal-600" />
                <h2 className="text-sm font-bold text-slate-900">Brand Palette & Theme Configuration</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="block font-medium text-slate-700 mb-1.5">Primary Brand Color</label>
                  <div className="flex items-center space-x-3">
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-10 h-10 rounded-xl border border-slate-200 cursor-pointer p-0.5"
                    />
                    <input
                      type="text"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-28 px-3 py-2 rounded-xl border border-slate-200 font-mono text-[11px]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1.5">Secondary Brand Color</label>
                  <div className="flex items-center space-x-3">
                    <input
                      type="color"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="w-10 h-10 rounded-xl border border-slate-200 cursor-pointer p-0.5"
                    />
                    <input
                      type="text"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="w-28 px-3 py-2 rounded-xl border border-slate-200 font-mono text-[11px]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1.5">Luminous Accent Color</label>
                  <div className="flex items-center space-x-3">
                    <input
                      type="color"
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      className="w-10 h-10 rounded-xl border border-slate-200 cursor-pointer p-0.5"
                    />
                    <input
                      type="text"
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      className="w-28 px-3 py-2 rounded-xl border border-slate-200 font-mono text-[11px]"
                    />
                  </div>
                </div>

                <div className="sm:col-span-3 pt-2 border-t border-slate-100">
                  <label className="block font-medium text-slate-700 mb-1">
                    Public Mini-Website & Card Default Appearance
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                    {[
                      { id: 'dark', label: 'Dark Mode (Default)', desc: 'Luminous accents on obsidian canvas' },
                      { id: 'light', label: 'Light Mode', desc: 'Crisp corporate aesthetic on clean white' },
                      { id: 'system', label: 'System (Auto)', desc: 'Follows visitor device preferences' },
                    ].map((modeItem) => (
                      <button
                        key={modeItem.id}
                        type="button"
                        onClick={() => setAppearanceMode(modeItem.id as any)}
                        className={`p-3.5 rounded-2xl border text-left transition ${
                          appearanceMode === modeItem.id
                            ? 'border-teal-600 bg-teal-50/70 text-teal-900 ring-2 ring-teal-500/20'
                            : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between font-bold text-xs">
                          <span>{modeItem.label}</span>
                          {appearanceMode === modeItem.id && <Check className="w-3.5 h-3.5 text-teal-600" />}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5 leading-snug">{modeItem.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="sm:col-span-3 pt-2">
                  <label className="block font-medium text-slate-700 mb-2">Default Employee Card Template</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { id: 'classic', label: 'Executive Classic', desc: 'Brand banner with structured corporate hierarchy' },
                      { id: 'modern', label: 'Neo Modern', desc: 'Dynamic gradient backdrop and badge chip overlays' },
                      { id: 'minimal', label: 'Nordic Minimal', desc: 'Clean monochrome typographic layout' },
                    ].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setCardThemePreference(item.id as any)}
                        className={`p-3.5 rounded-2xl border text-left transition ${
                          cardThemePreference === item.id
                            ? 'border-teal-600 bg-teal-50/70 text-teal-900 ring-2 ring-teal-500/20'
                            : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="font-bold text-xs">{item.label}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5 leading-snug">{item.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="sm:col-span-3 pt-2">
                  <label className="flex items-center space-x-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showCompanyAddress}
                      onChange={(e) => setShowCompanyAddress(e.target.checked)}
                      className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 border-slate-300"
                    />
                    <span className="font-medium text-slate-700 text-xs">
                      Display company office address on employee digital business cards
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: OVERVIEW & STORY                                   */}
        {/* ========================================================= */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center space-x-2 pb-3 border-b border-slate-100">
                <Sparkles className="w-4 h-4 text-teal-600" />
                <h2 className="text-sm font-bold text-slate-900">Company Narrative & Strategic Positioning</h2>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Positioning Statement (Executive Tagline / Hero Paragraph)
                  </label>
                  <textarea
                    rows={2}
                    value={positioningStatement}
                    onChange={(e) => setPositioningStatement(e.target.value)}
                    placeholder="e.g. Pioneering zero-trust digital business identity and contactless enterprise communication infrastructure."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Company About Story & Background (About Us Section)
                  </label>
                  <textarea
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Detailed corporate background, founding story, scale, and enterprise capabilities..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Corporate Mission</label>
                    <textarea
                      rows={2}
                      value={mission}
                      onChange={(e) => setMission(e.target.value)}
                      placeholder="e.g. To empower global enterprises with seamless, verifiable, and secure digital identity ecosystems..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Corporate Vision</label>
                    <textarea
                      rows={2}
                      value={vision}
                      onChange={(e) => setVision(e.target.value)}
                      placeholder="e.g. A universally connected enterprise world where every professional interaction is instant, verified, and protected..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Core Values Section */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center space-x-2">
                  <Shield className="w-4 h-4 text-teal-600" />
                  <h2 className="text-sm font-bold text-slate-900">Core Values & Operational Principles</h2>
                </div>
                <button
                  type="button"
                  onClick={addCoreValue}
                  className="inline-flex items-center px-3 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-semibold transition"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add Value
                </button>
              </div>

              <div className="space-y-3">
                {coreValues.map((val, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row items-start sm:items-center gap-3 text-xs"
                  >
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2 w-full">
                      <input
                        type="text"
                        placeholder="Value Title"
                        value={val.title}
                        onChange={(e) => {
                          const updated = [...coreValues];
                          updated[idx] = { ...updated[idx], title: e.target.value };
                          setCoreValues(updated);
                        }}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white font-bold"
                      />
                      <input
                        type="text"
                        placeholder="Description"
                        value={val.description}
                        onChange={(e) => {
                          const updated = [...coreValues];
                          updated[idx] = { ...updated[idx], description: e.target.value };
                          setCoreValues(updated);
                        }}
                        className="sm:col-span-2 px-3 py-1.5 rounded-xl border border-slate-200 bg-white"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeCoreValue(idx)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition self-end sm:self-center"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 3: SERVICES                                          */}
        {/* ========================================================= */}
        {activeTab === 'services' && (
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center">
                  <Briefcase className="w-4 h-4 text-teal-600 mr-2" />
                  Corporate Services & Solutions
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Published services displayed on your company mini-website with deliverables, pricing, and enquiry CTA.
                </p>
              </div>
              <button
                type="button"
                onClick={addService}
                className="inline-flex items-center px-3.5 py-2 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-semibold transition"
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Service
              </button>
            </div>

            <div className="space-y-4">
              {services.map((svc, idx) => (
                <div
                  key={svc.id || idx}
                  className="p-5 rounded-2xl border border-slate-200 bg-slate-50/40 space-y-3 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">Service #{idx + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeService(svc.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">Service Title *</label>
                      <input
                        type="text"
                        value={svc.title}
                        onChange={(e) => {
                          const updated = [...services];
                          updated[idx] = { ...updated[idx], title: e.target.value };
                          setServices(updated);
                        }}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block font-medium text-slate-700 mb-1">Category</label>
                      <input
                        type="text"
                        value={svc.category || ''}
                        onChange={(e) => {
                          const updated = [...services];
                          updated[idx] = { ...updated[idx], category: e.target.value };
                          setServices(updated);
                        }}
                        placeholder="e.g. Identity & Access, Cloud, Consulting"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block font-medium text-slate-700 mb-1">Description</label>
                      <textarea
                        rows={2}
                        value={svc.description}
                        onChange={(e) => {
                          const updated = [...services];
                          updated[idx] = { ...updated[idx], description: e.target.value };
                          setServices(updated);
                        }}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block font-medium text-slate-700 mb-1">
                        Deliverables (Comma-separated)
                      </label>
                      <input
                        type="text"
                        value={(svc.deliverables || []).join(', ')}
                        onChange={(e) => {
                          const updated = [...services];
                          const parsed = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
                          updated[idx] = { ...updated[idx], deliverables: parsed };
                          setServices(updated);
                        }}
                        placeholder="Custom Domain, SSO Integration, Automated Provisioning, Dedicated Support"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block font-medium text-slate-700 mb-1">Delivery Mode / Frequency</label>
                      <input
                        type="text"
                        value={svc.deliveryMode || ''}
                        onChange={(e) => {
                          const updated = [...services];
                          updated[idx] = { ...updated[idx], deliveryMode: e.target.value };
                          setServices(updated);
                        }}
                        placeholder="e.g. Turnkey Enterprise, Retainer, Project"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block font-medium text-slate-700 mb-1">Starting Price Indicator</label>
                      <input
                        type="text"
                        value={svc.startingPrice || ''}
                        onChange={(e) => {
                          const updated = [...services];
                          updated[idx] = { ...updated[idx], startingPrice: e.target.value };
                          setServices(updated);
                        }}
                        placeholder="e.g. Custom Plan or $4,500 / Project"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 4: PRODUCTS                                          */}
        {/* ========================================================= */}
        {activeTab === 'products' && (
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center">
                  <Package className="w-4 h-4 text-teal-600 mr-2" />
                  Commercial Products & Platforms
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Showcase software platforms, hardware suites, or digital solutions on your mini-website.
                </p>
              </div>
              <button
                type="button"
                onClick={addProduct}
                className="inline-flex items-center px-3.5 py-2 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-semibold transition"
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Product
              </button>
            </div>

            <div className="space-y-4">
              {products.map((prod, idx) => (
                <div
                  key={prod.id || idx}
                  className="p-5 rounded-2xl border border-slate-200 bg-slate-50/40 space-y-3 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">Product #{idx + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeProduct(prod.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">Product Name *</label>
                      <input
                        type="text"
                        value={prod.title}
                        onChange={(e) => {
                          const updated = [...products];
                          updated[idx] = { ...updated[idx], title: e.target.value };
                          setProducts(updated);
                        }}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block font-medium text-slate-700 mb-1">Category</label>
                      <input
                        type="text"
                        value={prod.category || ''}
                        onChange={(e) => {
                          const updated = [...products];
                          updated[idx] = { ...updated[idx], category: e.target.value };
                          setProducts(updated);
                        }}
                        placeholder="e.g. Digital Identity Platform, Smart Hardware"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block font-medium text-slate-700 mb-1">Product Description</label>
                      <textarea
                        rows={2}
                        value={prod.description}
                        onChange={(e) => {
                          const updated = [...products];
                          updated[idx] = { ...updated[idx], description: e.target.value };
                          setProducts(updated);
                        }}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block font-medium text-slate-700 mb-1">
                        Key Features (Comma-separated)
                      </label>
                      <input
                        type="text"
                        value={(prod.features || []).join(', ')}
                        onChange={(e) => {
                          const updated = [...products];
                          const parsed = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
                          updated[idx] = { ...updated[idx], features: parsed };
                          setProducts(updated);
                        }}
                        placeholder="Zero-trust RBAC, Lead capture & sync, Interactive mini-websites"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block font-medium text-slate-700 mb-1">Badge Tag</label>
                      <input
                        type="text"
                        value={prod.badge || ''}
                        onChange={(e) => {
                          const updated = [...products];
                          updated[idx] = { ...updated[idx], badge: e.target.value };
                          setProducts(updated);
                        }}
                        placeholder="e.g. Flagship Platform or Hardware Innovation"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block font-medium text-slate-700 mb-1">CTA Action Label</label>
                      <input
                        type="text"
                        value={prod.actionLabel || ''}
                        onChange={(e) => {
                          const updated = [...products];
                          updated[idx] = { ...updated[idx], actionLabel: e.target.value };
                          setProducts(updated);
                        }}
                        placeholder="e.g. Request Platform Demo"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 5: METRICS & WORK                                     */}
        {/* ========================================================= */}
        {activeTab === 'metrics' && (
          <div className="space-y-6">
            {/* Proof Metrics */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 flex items-center">
                    <BarChart3 className="w-4 h-4 text-teal-600 mr-2" />
                    Verified Corporate Proof Metrics
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Quantifiable scale indicators (e.g. Clients, Uptime, Volume, Active Users).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addMetric}
                  className="inline-flex items-center px-3 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-semibold transition"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add Metric
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {metrics.map((m, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/50 flex items-center gap-2 text-xs"
                  >
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Metric Value (e.g. 140+)"
                        value={m.value}
                        onChange={(e) => {
                          const updated = [...metrics];
                          updated[idx] = { ...updated[idx], value: e.target.value };
                          setMetrics(updated);
                        }}
                        className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white font-bold"
                      />
                      <input
                        type="text"
                        placeholder="Label (e.g. Enterprise Clients)"
                        value={m.label}
                        onChange={(e) => {
                          const updated = [...metrics];
                          updated[idx] = { ...updated[idx], label: e.target.value };
                          setMetrics(updated);
                        }}
                        className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeMetric(idx)}
                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Case Studies */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 flex items-center">
                    <FileText className="w-4 h-4 text-teal-600 mr-2" />
                    Case Studies & Success Stories
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Documented client challenges, delivered solutions, and measurable outcomes.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addCaseStudy}
                  className="inline-flex items-center px-3 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-semibold transition"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add Case Study
                </button>
              </div>

              <div className="space-y-4">
                {caseStudies.map((cs, idx) => (
                  <div
                    key={cs.id || idx}
                    className="p-5 rounded-2xl border border-slate-200 bg-slate-50/40 space-y-3 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">Case Study #{idx + 1}</span>
                      <button
                        type="button"
                        onClick={() => removeCaseStudy(cs.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="sm:col-span-2">
                        <label className="block font-medium text-slate-700 mb-1">Case Study Title *</label>
                        <input
                          type="text"
                          value={cs.title}
                          onChange={(e) => {
                            const updated = [...caseStudies];
                            updated[idx] = { ...updated[idx], title: e.target.value };
                            setCaseStudies(updated);
                          }}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                        />
                      </div>

                      <div>
                        <label className="block font-medium text-slate-700 mb-1">Client Name</label>
                        <input
                          type="text"
                          value={cs.client || ''}
                          onChange={(e) => {
                            const updated = [...caseStudies];
                            updated[idx] = { ...updated[idx], client: e.target.value };
                            setCaseStudies(updated);
                          }}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                        />
                      </div>

                      <div>
                        <label className="block font-medium text-slate-700 mb-1">Industry</label>
                        <input
                          type="text"
                          value={cs.industry || ''}
                          onChange={(e) => {
                            const updated = [...caseStudies];
                            updated[idx] = { ...updated[idx], industry: e.target.value };
                            setCaseStudies(updated);
                          }}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                        />
                      </div>

                      <div>
                        <label className="block font-medium text-slate-700 mb-1">The Challenge</label>
                        <textarea
                          rows={2}
                          value={cs.challenge || ''}
                          onChange={(e) => {
                            const updated = [...caseStudies];
                            updated[idx] = { ...updated[idx], challenge: e.target.value };
                            setCaseStudies(updated);
                          }}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                        />
                      </div>

                      <div>
                        <label className="block font-medium text-slate-700 mb-1">The Solution</label>
                        <textarea
                          rows={2}
                          value={cs.solution || ''}
                          onChange={(e) => {
                            const updated = [...caseStudies];
                            updated[idx] = { ...updated[idx], solution: e.target.value };
                            setCaseStudies(updated);
                          }}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block font-medium text-slate-700 mb-1">Measurable Outcome</label>
                        <input
                          type="text"
                          value={cs.outcome || ''}
                          onChange={(e) => {
                            const updated = [...caseStudies];
                            updated[idx] = { ...updated[idx], outcome: e.target.value };
                            setCaseStudies(updated);
                          }}
                          placeholder="e.g. Achieved 100% digital card adoption in 14 days and saved $140,000"
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 6: TESTIMONIALS                                       */}
        {/* ========================================================= */}
        {activeTab === 'testimonials' && (
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center">
                  <MessageSquareQuote className="w-4 h-4 text-teal-600 mr-2" />
                  Client Endorsements & Testimonials
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Customer reviews and executive quotes verifying corporate excellence.
                </p>
              </div>
              <button
                type="button"
                onClick={addTestimonial}
                className="inline-flex items-center px-3.5 py-2 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-semibold transition"
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Testimonial
              </button>
            </div>

            <div className="space-y-4">
              {testimonials.map((t, idx) => (
                <div
                  key={t.id || idx}
                  className="p-5 rounded-2xl border border-slate-200 bg-slate-50/40 space-y-3 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">Testimonial #{idx + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeTestimonial(t.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-3">
                      <label className="block font-medium text-slate-700 mb-1">Executive Quote *</label>
                      <textarea
                        rows={3}
                        value={t.quote}
                        onChange={(e) => {
                          const updated = [...testimonials];
                          updated[idx] = { ...updated[idx], quote: e.target.value };
                          setTestimonials(updated);
                        }}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block font-medium text-slate-700 mb-1">Client Name</label>
                      <input
                        type="text"
                        value={t.clientName}
                        onChange={(e) => {
                          const updated = [...testimonials];
                          updated[idx] = { ...updated[idx], clientName: e.target.value };
                          setTestimonials(updated);
                        }}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block font-medium text-slate-700 mb-1">Designation</label>
                      <input
                        type="text"
                        value={t.designation}
                        onChange={(e) => {
                          const updated = [...testimonials];
                          updated[idx] = { ...updated[idx], designation: e.target.value };
                          setTestimonials(updated);
                        }}
                        placeholder="e.g. Chief Technology Officer"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block font-medium text-slate-700 mb-1">Company</label>
                      <input
                        type="text"
                        value={t.companyName}
                        onChange={(e) => {
                          const updated = [...testimonials];
                          updated[idx] = { ...updated[idx], companyName: e.target.value };
                          setTestimonials(updated);
                        }}
                        placeholder="e.g. Apex Cloud Systems"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 7: CONTACT & SOCIALS                                  */}
        {/* ========================================================= */}
        {activeTab === 'contact' && (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center space-x-2 pb-3 border-b border-slate-100">
                <Phone className="w-4 h-4 text-teal-600" />
                <h2 className="text-sm font-bold text-slate-900">Corporate Contact Coordinates</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Corporate Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Headquarters Phone</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">WhatsApp Direct Number</label>
                  <input
                    type="text"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    placeholder="+14158902341"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Official Website</label>
                  <input
                    type="url"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Physical Address</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Operating Hours</label>
                  <input
                    type="text"
                    value={operatingHours}
                    onChange={(e) => setOperatingHours(e.target.value)}
                    placeholder="Monday – Friday: 8:00 AM – 6:00 PM PST"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>
            </div>

            {/* Social Media Links */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center space-x-2 pb-3 border-b border-slate-100">
                <Share2 className="w-4 h-4 text-teal-600" />
                <h2 className="text-sm font-bold text-slate-900">Social Media & Corporate Channels</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">LinkedIn Company Page</label>
                  <input
                    type="url"
                    value={socialLinks.linkedin || ''}
                    onChange={(e) => setSocialLinks({ ...socialLinks, linkedin: e.target.value })}
                    placeholder="https://linkedin.com/company/name"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-[11px]"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Twitter / X URL</label>
                  <input
                    type="url"
                    value={socialLinks.twitter || ''}
                    onChange={(e) => setSocialLinks({ ...socialLinks, twitter: e.target.value })}
                    placeholder="https://twitter.com/handle"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-[11px]"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">GitHub Organization</label>
                  <input
                    type="url"
                    value={socialLinks.github || ''}
                    onChange={(e) => setSocialLinks({ ...socialLinks, github: e.target.value })}
                    placeholder="https://github.com/org"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-[11px]"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">YouTube Channel</label>
                  <input
                    type="url"
                    value={socialLinks.youtube || ''}
                    onChange={(e) => setSocialLinks({ ...socialLinks, youtube: e.target.value })}
                    placeholder="https://youtube.com/@channel"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-[11px]"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Instagram Profile</label>
                  <input
                    type="url"
                    value={socialLinks.instagram || ''}
                    onChange={(e) => setSocialLinks({ ...socialLinks, instagram: e.target.value })}
                    placeholder="https://instagram.com/handle"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-[11px]"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Facebook Page</label>
                  <input
                    type="url"
                    value={socialLinks.facebook || ''}
                    onChange={(e) => setSocialLinks({ ...socialLinks, facebook: e.target.value })}
                    placeholder="https://facebook.com/page"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-[11px]"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Global Save Action Bar */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center justify-between sticky bottom-4 z-20">
          <div>
            {savedSuccess ? (
              <span className="text-xs font-semibold text-emerald-600 inline-flex items-center">
                <Check className="w-4 h-4 mr-1.5" /> Company profile saved and live on mini-website!
              </span>
            ) : (
              <span className="text-xs text-slate-500">
                All changes reflect instantly on your public company mini-website and cards.
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-sm transition disabled:opacity-50"
          >
            <Save className="w-4 h-4 mr-1.5" />
            {saving ? 'Publishing changes...' : 'Save & Publish Organization Profile'}
          </button>
        </div>
      </form>
    </div>
  );
};

