import React from 'react';
import {
  Phone,
  Mail,
  Linkedin,
  MapPin,
  MessageSquare,
  Bookmark,
  Share2,
  Building,
  UserPlus,
  ChevronRight,
  ShieldCheck,
  User,
  Briefcase,
  Award,
  Users,
  Lightbulb,
  Twitter,
  Instagram,
  Github,
  Youtube,
  Globe,
  QrCode,
} from 'lucide-react';
import { ResolvedCardProfile } from '../../types/cardProfile';

export interface CardTemplateRenderProps {
  profile: ResolvedCardProfile;
  onCall: () => void;
  onWhatsApp: () => void;
  onEmail: () => void;
  onLinkedIn: () => void;
  onWebsite: () => void;
  onSaveContact: () => void;
  onShare: () => void;
  onConnect?: () => void;
  onSocialClick?: (platform: string, url: string) => void;
  onViewFullProfile?: () => void;
  onViewCompanyProfile?: () => void;
}

export const TemplateClassic: React.FC<CardTemplateRenderProps> = ({
  profile,
  onCall,
  onWhatsApp,
  onEmail,
  onLinkedIn,
  onWebsite,
  onSaveContact,
  onShare,
  onConnect,
  onViewFullProfile,
  onViewCompanyProfile,
}) => {
  return (
    <div className="w-full max-w-[390px] mx-auto bg-white rounded-[32px] shadow-2xl border border-slate-200/90 overflow-hidden text-slate-800 transition-all flex flex-col justify-between select-none relative">
      {/* Top Hero Banner & Architectural Branding */}
      <div
        className="h-36 w-full relative px-5 pt-4 flex flex-col justify-between overflow-hidden"
        style={{
          background: profile.heroImageUrl
            ? `linear-gradient(rgba(10, 54, 65, 0.75), rgba(15, 77, 92, 0.9)), url(${profile.heroImageUrl}) center/cover`
            : `linear-gradient(135deg, ${profile.primaryColor}f0, #0a3641)`,
        }}
      >
        {/* Subtle Architectural Graphic / Geometric Accents */}
        <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none"></div>

        {/* Top Bar: Company Logo / Identity & Share Button */}
        <div className="flex items-center justify-between relative z-10">
          {profile.hasCompanyAssociation ? (
            profile.companyLogoUrl ? (
              <button
                type="button"
                onClick={onViewCompanyProfile}
                aria-label={`Visit ${profile.companyName} company profile`}
                className="flex items-center gap-2 bg-white/95 backdrop-blur-md rounded-xl px-2.5 py-1 shadow-sm cursor-pointer max-w-[200px] transition hover:bg-white active:scale-95 text-left border border-white/20 focus:outline-none focus:ring-2 focus:ring-teal-400"
              >
                <img
                  src={profile.companyLogoUrl}
                  alt={profile.companyName}
                  className="h-6 max-w-[36px] object-contain"
                />
                <div className="flex flex-col text-left leading-none truncate">
                  <span className="text-[11px] font-bold text-slate-900 truncate">
                    {profile.companyName}
                  </span>
                  {profile.companyTagline && (
                    <span className="text-[8px] text-slate-500 font-medium truncate mt-0.5">
                      {profile.companyTagline}
                    </span>
                  )}
                </div>
              </button>
            ) : (
              <button
                type="button"
                onClick={onViewCompanyProfile}
                aria-label={`Visit ${profile.companyName} company profile`}
                className="flex items-center text-white text-xs font-bold tracking-tight bg-black/30 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 transition hover:bg-black/40 focus:outline-none focus:ring-2 focus:ring-teal-400 active:scale-95"
              >
                <Building className="w-3.5 h-3.5 mr-1.5 text-teal-300" />
                <span className="truncate max-w-[150px]">{profile.companyName}</span>
                <ChevronRight className="w-3 h-3 ml-1 opacity-70" />
              </button>
            )
          ) : (
            <div className="flex items-center text-white text-xs font-semibold tracking-wide bg-white/20 backdrop-blur-md px-3 py-1 rounded-xl border border-white/15">
              <User className="w-3.5 h-3.5 mr-1.5 text-teal-200" />
              <span>Digital Identity</span>
            </div>
          )}

          {/* Share Button */}
          <button
            onClick={onShare}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white backdrop-blur-md flex items-center justify-center transition active:scale-95 shadow-sm border border-white/15"
            title="Share Card / QR"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>

        {/* Hero slogan: the company's own tagline only (Directive 26: no invented copy) */}
        <div className="flex items-end justify-between pb-2 text-white/90 relative z-10 pointer-events-none min-h-[1.5rem]">
          {profile.companyTagline && (
            <p className="text-[10px] font-medium leading-tight text-white/80 max-w-[160px] drop-shadow-sm">
              {profile.companyTagline}
            </p>
          )}
        </div>
      </div>

      {/* CORE IDENTITY: Avatar, Name, Title, Company Association */}
      <div className="px-5 -mt-12 flex flex-col items-center text-center relative z-20">
        <div className="relative">
          {profile.profilePhotoUrl ? (
            <img
              src={profile.profilePhotoUrl}
              alt={profile.displayName}
              className="w-24 h-24 rounded-full object-cover ring-4 ring-white shadow-xl bg-slate-100"
            />
          ) : (
            <div
              className="w-24 h-24 rounded-full ring-4 ring-white shadow-xl flex items-center justify-center text-white text-3xl font-bold"
              style={{ backgroundColor: profile.primaryColor }}
            >
              {profile.firstName?.[0] || 'U'}
            </div>
          )}
          <span className="absolute bottom-1 right-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full shadow-sm"></span>
        </div>

        {/* Display Name */}
        <h1 className="mt-2 text-2xl font-bold text-slate-900 tracking-tight max-w-full truncate">
          {profile.displayName}
        </h1>

        {/* Designation */}
        <p className="text-xs font-semibold text-slate-700 mt-0.5 truncate max-w-full">
          {profile.designation}
        </p>

        {/* Company Association or Independent Tag */}
        {profile.hasCompanyAssociation ? (
          <button
            type="button"
            onClick={onViewCompanyProfile}
            aria-label={`View ${profile.companyName} company profile`}
            className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-slate-800 hover:text-teal-700 transition px-2 py-0.5 rounded-lg hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <Building className="w-3.5 h-3.5 text-slate-500" />
            <span className="truncate max-w-[200px]">{profile.companyName}</span>
            <ChevronRight className="w-3 h-3 text-slate-400" />
          </button>
        ) : (
          <div className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-slate-600">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
            <span>Independent Professional</span>
          </div>
        )}

        {/* Location & Department Metadata Line */}
        <div className="mt-1 flex items-center justify-center gap-2 text-[11px] text-slate-500">
          {profile.location && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="w-3 h-3 text-blue-600 shrink-0" />
              <span className="truncate max-w-[130px]">{profile.location}</span>
            </span>
          )}
          {profile.location && profile.departmentName && (
            <span className="text-slate-300">|</span>
          )}
          {profile.departmentName && (
            <span className="inline-flex items-center gap-1">
              <Briefcase className="w-3 h-3 text-slate-600 shrink-0" />
              <span className="truncate max-w-[150px]">{profile.departmentName}</span>
            </span>
          )}
        </div>

        {/* Concise Headline */}
        {profile.headline && (
          <p className="mt-1.5 text-[11px] text-slate-600 italic line-clamp-1 max-w-[320px]">
            &ldquo;{profile.headline}&rdquo;
          </p>
        )}

        {/* Skills / Key Competencies Pills */}
        {profile.expertise && profile.expertise.length > 0 && (
          <div className="mt-2.5 flex flex-wrap items-center justify-center gap-1 max-w-[340px]">
            {profile.expertise.slice(0, 5).map((exp, idx) => (
              <span
                key={idx}
                className="px-2.5 py-0.5 rounded-full bg-teal-50/90 border border-teal-100 text-teal-900 text-[10px] font-medium"
              >
                {exp}
              </span>
            ))}
            {profile.expertise.length > 5 && (
              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-medium">
                +{profile.expertise.length - 5} more
              </span>
            )}
          </div>
        )}
      </div>

      {/* COMPACT METRICS STRIP (3 Boxes) */}
      {profile.metrics && profile.metrics.length > 0 && (
        <div className="w-full px-5 mt-2.5">
          <div className="grid grid-cols-3 gap-1.5 p-2 bg-slate-50/90 rounded-2xl border border-slate-100 text-center">
            {profile.metrics.slice(0, 3).map((m, idx) => (
              <div key={idx} className="flex flex-col items-center justify-center">
                <div className="flex items-center gap-1">
                  {idx === 0 && <Award className="w-3.5 h-3.5 text-blue-600" />}
                  {idx === 1 && <Users className="w-3.5 h-3.5 text-teal-600" />}
                  {idx === 2 && <Lightbulb className="w-3.5 h-3.5 text-amber-500" />}
                  <span className="text-[11px] font-bold text-slate-900 leading-none">{m.value}</span>
                </div>
                <span className="text-[9px] text-slate-500 leading-tight mt-0.5 truncate max-w-full">
                  {m.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* QUICK CONTACT ACTIONS ROW (Call, WhatsApp, Email, LinkedIn) */}
      <div className="w-full px-5 mt-3 grid grid-cols-4 gap-2">
        <button
          onClick={onCall}
          disabled={!profile.phone}
          className="flex flex-col items-center justify-center py-2 px-1 rounded-2xl bg-teal-50/70 hover:bg-teal-100/80 border border-teal-100/60 text-teal-900 transition active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
        >
          <Phone className="w-4 h-4 text-emerald-600 mb-0.5" />
          <span className="text-[10px] font-semibold">Call</span>
        </button>

        <button
          onClick={onWhatsApp}
          disabled={!profile.whatsapp && !profile.phone}
          className="flex flex-col items-center justify-center py-2 px-1 rounded-2xl bg-emerald-50/70 hover:bg-emerald-100/80 border border-emerald-100/60 text-emerald-900 transition active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
        >
          <MessageSquare className="w-4 h-4 text-emerald-600 mb-0.5" />
          <span className="text-[10px] font-semibold">WhatsApp</span>
        </button>

        <button
          onClick={onEmail}
          disabled={!profile.email}
          className="flex flex-col items-center justify-center py-2 px-1 rounded-2xl bg-blue-50/70 hover:bg-blue-100/80 border border-blue-100/60 text-blue-900 transition active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
        >
          <Mail className="w-4 h-4 text-blue-600 mb-0.5" />
          <span className="text-[10px] font-semibold">Email</span>
        </button>

        <button
          onClick={onLinkedIn}
          disabled={!profile.socialLinks?.linkedin}
          className="flex flex-col items-center justify-center py-2 px-1 rounded-2xl bg-sky-50/70 hover:bg-sky-100/80 border border-sky-100/60 text-sky-900 transition active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
        >
          <Linkedin className="w-4 h-4 text-sky-600 mb-0.5" />
          <span className="text-[10px] font-semibold">LinkedIn</span>
        </button>
      </div>

      {/* PRIMARY CONVERSION CTAs (Connect & Save Contact) + SECONDARY CONTEXTUAL CTA */}
      <div className="w-full px-5 mt-3 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          {onConnect && (
            <button
              onClick={onConnect}
              className="flex items-center justify-center min-h-[44px] py-2.5 px-2 rounded-2xl text-white font-semibold text-xs shadow-md transition transform active:scale-95 bg-slate-950 hover:bg-slate-900"
            >
              <UserPlus className="w-4 h-4 mr-1.5 text-teal-400 shrink-0" />
              <span className="truncate">Connect / Exchange</span>
            </button>
          )}

          <button
            onClick={onSaveContact}
            className={`flex items-center justify-center min-h-[44px] py-2.5 px-2 rounded-2xl text-white font-semibold text-xs shadow-md transition transform active:scale-95 ${!onConnect ? 'col-span-2' : ''}`}
            style={{ backgroundColor: profile.primaryColor }}
          >
            <Bookmark className="w-4 h-4 mr-1.5 shrink-0" />
            <span className="truncate">Save Contact</span>
          </button>
        </div>

        {/* SECONDARY CONTEXTUAL CTA */}
        {profile.hasCompanyAssociation ? (
          <button
            onClick={onViewCompanyProfile}
            className="w-full flex items-center justify-center min-h-[42px] py-2.5 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200/90 text-slate-800 font-semibold text-xs border border-slate-200/80 shadow-sm transition active:scale-95"
          >
            <Building className="w-4 h-4 mr-2 text-slate-600 shrink-0" />
            <span>View Company Profile</span>
            <ChevronRight className="w-3.5 h-3.5 ml-1 text-slate-400" />
          </button>
        ) : (
          <button
            onClick={onViewFullProfile}
            className="w-full flex items-center justify-center min-h-[42px] py-2.5 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200/90 text-slate-800 font-semibold text-xs border border-slate-200/80 shadow-sm transition active:scale-95"
          >
            <User className="w-4 h-4 mr-2 text-slate-600 shrink-0" />
            <span>View Full Profile</span>
            <ChevronRight className="w-3.5 h-3.5 ml-1 text-slate-400" />
          </button>
        )}
      </div>

      {/* BOTTOM SOCIAL & QR STRIP INSIDE CARD */}
      <div className="w-full px-5 py-2.5 mt-2.5 bg-slate-50/90 border-t border-slate-100 flex items-center justify-between text-xs">
        {/* Left Social Channels */}
        <div className="flex items-center gap-2.5 text-slate-700">
          {profile.socialLinks?.twitter ? (
            <a
              href={profile.socialLinks.twitter}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 hover:text-slate-900 transition"
              title="X (Twitter)"
            >
              <Twitter className="w-3.5 h-3.5" />
            </a>
          ) : (
            <button onClick={onShare} className="p-1 text-slate-400 hover:text-slate-700 transition" title="X (Twitter)">
              <Twitter className="w-3.5 h-3.5" />
            </button>
          )}

          {profile.socialLinks?.instagram ? (
            <a
              href={profile.socialLinks.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 hover:text-pink-600 transition"
              title="Instagram"
            >
              <Instagram className="w-3.5 h-3.5 text-pink-500" />
            </a>
          ) : (
            <button onClick={onShare} className="p-1 text-slate-400 hover:text-pink-500 transition" title="Instagram">
              <Instagram className="w-3.5 h-3.5" />
            </button>
          )}

          {profile.socialLinks?.github ? (
            <a
              href={profile.socialLinks.github}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 hover:text-slate-900 transition"
              title="GitHub"
            >
              <Github className="w-3.5 h-3.5 text-slate-800" />
            </a>
          ) : (
            <button onClick={onShare} className="p-1 text-slate-400 hover:text-slate-800 transition" title="GitHub">
              <Github className="w-3.5 h-3.5" />
            </button>
          )}

          {profile.socialLinks?.youtube ? (
            <a
              href={profile.socialLinks.youtube}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 hover:text-red-600 transition"
              title="YouTube"
            >
              <Youtube className="w-3.5 h-3.5 text-red-600" />
            </a>
          ) : (
            <button onClick={onShare} className="p-1 text-slate-400 hover:text-red-500 transition" title="YouTube">
              <Youtube className="w-3.5 h-3.5" />
            </button>
          )}

          {profile.website ? (
            <a
              href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 hover:text-teal-700 transition"
              title="Website"
            >
              <Globe className="w-3.5 h-3.5 text-teal-700" />
            </a>
          ) : (
            <button onClick={onWebsite} className="p-1 text-slate-400 hover:text-teal-700 transition" title="Website">
              <Globe className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Divider */}
        <div className="h-4 w-px bg-slate-200"></div>

        {/* Right QR Code & Full Profile Trigger */}
        <div className="flex items-center gap-2">
          <button
            onClick={onShare}
            className="flex items-center gap-1 text-[10px] font-semibold text-slate-700 hover:text-slate-900 transition"
          >
            <QrCode className="w-3.5 h-3.5 text-slate-800" />
            <span>View QR</span>
          </button>

          {onViewFullProfile && (
            <>
              <span className="text-slate-300">•</span>
              <button
                onClick={onViewFullProfile}
                className="text-[10px] font-semibold text-teal-800 hover:text-teal-950 transition flex items-center"
              >
                <span>Profile</span>
                <ChevronRight className="w-3 h-3 ml-0.5" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};


