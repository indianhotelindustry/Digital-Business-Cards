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
  Sparkles,
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
import { CardTemplateRenderProps } from './TemplateClassic';

export const TemplateModern: React.FC<CardTemplateRenderProps> = ({
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
    <div className="w-full max-w-[390px] mx-auto bg-white rounded-[32px] shadow-2xl border border-slate-100 overflow-hidden text-slate-800 transition-all relative select-none flex flex-col justify-between">
      {/* Background Hero Banner */}
      <div
        className="h-36 w-full relative p-5 flex flex-col justify-between"
        style={{
          background: `linear-gradient(135deg, ${profile.primaryColor}, ${profile.secondaryColor})`,
        }}
      >
        <div className="flex items-center justify-between">
          {profile.hasCompanyAssociation ? (
            profile.companyLogoUrl ? (
              <button
                type="button"
                onClick={onViewCompanyProfile}
                aria-label={`Visit ${profile.companyName} company profile`}
                className="cursor-pointer bg-white/95 rounded-xl px-2.5 py-1 shadow-sm flex items-center gap-1.5 transition hover:bg-white active:scale-95 border border-white/20 focus:outline-none focus:ring-2 focus:ring-teal-300"
              >
                <img
                  src={profile.companyLogoUrl}
                  alt={profile.companyName}
                  className="h-6 max-w-[120px] object-contain"
                />
              </button>
            ) : (
              <button
                type="button"
                onClick={onViewCompanyProfile}
                aria-label={`Visit ${profile.companyName} company profile`}
                className="text-white font-bold tracking-tight text-xs flex items-center bg-black/30 hover:bg-black/40 backdrop-blur-sm px-2.5 py-1 rounded-xl border border-white/10 transition active:scale-95 focus:outline-none focus:ring-2 focus:ring-teal-300"
              >
                <Building className="w-3.5 h-3.5 mr-1 opacity-80" />
                <span className="truncate max-w-[140px]">{profile.companyName}</span>
                <ChevronRight className="w-3 h-3 ml-0.5 opacity-70" />
              </button>
            )
          ) : (
            <div className="flex items-center text-white text-xs font-semibold bg-white/15 backdrop-blur-sm px-2.5 py-1 rounded-xl">
              <User className="w-3.5 h-3.5 mr-1" />
              <span>Digital Identity</span>
            </div>
          )}

          <button
            onClick={onShare}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white backdrop-blur-md flex items-center justify-center transition active:scale-95"
            title="Share"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>

        <div className="text-white/90 text-[10px] font-semibold tracking-wider uppercase flex items-center">
          <Sparkles className="w-3 h-3 mr-1 text-teal-300" />
          <span>{profile.departmentName || 'Verified Identity'}</span>
        </div>
      </div>

      {/* Profile Overlap Info Card */}
      <div className="px-5 -mt-12">
        <div className="bg-white rounded-2xl p-3.5 shadow-lg border border-slate-100 flex items-center gap-3.5">
          <div className="relative shrink-0">
            {profile.profilePhotoUrl ? (
              <img
                src={profile.profilePhotoUrl}
                alt={profile.displayName}
                className="w-16 h-16 rounded-2xl object-cover ring-2 ring-slate-100 shadow-sm"
              />
            ) : (
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-xl font-bold"
                style={{ backgroundColor: profile.primaryColor }}
              >
                {profile.firstName?.[0] || 'U'}
              </div>
            )}
            <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full"></span>
          </div>

          <div className="overflow-hidden flex-1 min-w-0">
            <h1 className="text-lg font-bold text-slate-900 truncate tracking-tight">
              {profile.displayName}
            </h1>
            <p className="text-xs font-semibold text-slate-700 truncate">{profile.designation}</p>

            {profile.hasCompanyAssociation ? (
              <button
                onClick={onViewCompanyProfile}
                className="text-[11px] text-teal-700 hover:text-teal-800 font-medium truncate flex items-center gap-0.5 mt-0.5"
              >
                <Building className="w-3 h-3 shrink-0" />
                <span className="truncate">{profile.companyName}</span>
                <ChevronRight className="w-2.5 h-2.5 shrink-0" />
              </button>
            ) : (
              <p className="text-[11px] text-slate-500 truncate flex items-center gap-1 mt-0.5">
                <ShieldCheck className="w-3 h-3 text-teal-600 shrink-0" />
                <span>Independent Professional</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* LOCATION & DEPARTMENT METADATA */}
      <div className="px-5 mt-2 flex items-center justify-center gap-2 text-[11px] text-slate-500">
        {profile.location && (
          <span className="inline-flex items-center gap-1 truncate max-w-[140px]">
            <MapPin className="w-3 h-3 text-blue-600 shrink-0" />
            <span className="truncate">{profile.location}</span>
          </span>
        )}
        {profile.location && profile.departmentName && <span className="text-slate-300">|</span>}
        {profile.departmentName && (
          <span className="inline-flex items-center gap-1 truncate max-w-[150px]">
            <Briefcase className="w-3 h-3 text-slate-600 shrink-0" />
            <span className="truncate">{profile.departmentName}</span>
          </span>
        )}
      </div>

      {/* HEADLINE & SKILLS */}
      <div className="px-5 mt-2">
        {profile.headline && (
          <p className="text-[11px] text-slate-600 italic line-clamp-1 text-center">
            &ldquo;{profile.headline}&rdquo;
          </p>
        )}

        {profile.expertise && profile.expertise.length > 0 && (
          <div className="mt-2 flex flex-wrap justify-center gap-1">
            {profile.expertise.slice(0, 4).map((exp, idx) => (
              <span
                key={idx}
                className="px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-100/60 text-[10px] font-medium"
              >
                {exp}
              </span>
            ))}
            {profile.expertise.length > 4 && (
              <span className="text-[10px] text-slate-400 font-medium self-center">
                +{profile.expertise.length - 4}
              </span>
            )}
          </div>
        )}
      </div>

      {/* METRICS STRIP */}
      {profile.metrics && profile.metrics.length > 0 && (
        <div className="px-5 mt-2.5">
          <div className="grid grid-cols-3 gap-1.5 p-2 bg-slate-50/90 rounded-2xl border border-slate-100 text-center">
            {profile.metrics.slice(0, 3).map((m, idx) => (
              <div key={idx} className="flex flex-col items-center justify-center">
                <div className="flex items-center gap-1">
                  {idx === 0 && <Award className="w-3 h-3 text-blue-600" />}
                  {idx === 1 && <Users className="w-3 h-3 text-teal-600" />}
                  {idx === 2 && <Lightbulb className="w-3 h-3 text-amber-500" />}
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

      {/* QUICK ACTIONS ROW */}
      <div className="px-5 mt-3 grid grid-cols-4 gap-2">
        <button
          onClick={onCall}
          disabled={!profile.phone}
          className="py-2 px-1 rounded-2xl bg-teal-50/70 hover:bg-teal-100 text-teal-900 font-semibold text-[10px] flex flex-col items-center justify-center transition border border-teal-100/60 disabled:opacity-40 disabled:pointer-events-none active:scale-95"
        >
          <Phone className="w-4 h-4 text-emerald-600 mb-0.5" />
          <span>Call</span>
        </button>

        <button
          onClick={onWhatsApp}
          disabled={!profile.whatsapp && !profile.phone}
          className="py-2 px-1 rounded-2xl bg-emerald-50/70 hover:bg-emerald-100 text-emerald-900 font-semibold text-[10px] flex flex-col items-center justify-center transition border border-emerald-100/60 disabled:opacity-40 disabled:pointer-events-none active:scale-95"
        >
          <MessageSquare className="w-4 h-4 text-emerald-600 mb-0.5" />
          <span>WhatsApp</span>
        </button>

        <button
          onClick={onEmail}
          disabled={!profile.email}
          className="py-2 px-1 rounded-2xl bg-blue-50/70 hover:bg-blue-100 text-blue-900 font-semibold text-[10px] flex flex-col items-center justify-center transition border border-blue-100/60 disabled:opacity-40 disabled:pointer-events-none active:scale-95"
        >
          <Mail className="w-4 h-4 text-blue-600 mb-0.5" />
          <span>Email</span>
        </button>

        <button
          onClick={onLinkedIn}
          disabled={!profile.socialLinks?.linkedin}
          className="py-2 px-1 rounded-2xl bg-sky-50/70 hover:bg-sky-100 text-sky-900 font-semibold text-[10px] flex flex-col items-center justify-center transition border border-sky-100/60 disabled:opacity-40 disabled:pointer-events-none active:scale-95"
        >
          <Linkedin className="w-4 h-4 text-sky-600 mb-0.5" />
          <span>LinkedIn</span>
        </button>
      </div>

      {/* PRIMARY CONVERSION / CTAs + SECONDARY CONTEXTUAL CTA */}
      <div className="px-5 mt-3 space-y-2">
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
            style={{
              background: `linear-gradient(135deg, ${profile.primaryColor}, ${profile.secondaryColor})`,
            }}
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
        <div className="flex items-center gap-2.5 text-slate-700">
          {profile.socialLinks?.twitter ? (
            <a href={profile.socialLinks.twitter} target="_blank" rel="noopener noreferrer" className="p-1 hover:text-slate-900" title="X">
              <Twitter className="w-3.5 h-3.5" />
            </a>
          ) : (
            <button onClick={onShare} className="p-1 text-slate-400 hover:text-slate-700"><Twitter className="w-3.5 h-3.5" /></button>
          )}
          {profile.socialLinks?.instagram ? (
            <a href={profile.socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="p-1 hover:text-pink-600" title="Instagram">
              <Instagram className="w-3.5 h-3.5 text-pink-500" />
            </a>
          ) : (
            <button onClick={onShare} className="p-1 text-slate-400 hover:text-pink-500"><Instagram className="w-3.5 h-3.5" /></button>
          )}
          {profile.socialLinks?.github ? (
            <a href={profile.socialLinks.github} target="_blank" rel="noopener noreferrer" className="p-1 hover:text-slate-900" title="GitHub">
              <Github className="w-3.5 h-3.5 text-slate-800" />
            </a>
          ) : (
            <button onClick={onShare} className="p-1 text-slate-400 hover:text-slate-800"><Github className="w-3.5 h-3.5" /></button>
          )}
          {profile.socialLinks?.youtube ? (
            <a href={profile.socialLinks.youtube} target="_blank" rel="noopener noreferrer" className="p-1 hover:text-red-600" title="YouTube">
              <Youtube className="w-3.5 h-3.5 text-red-600" />
            </a>
          ) : (
            <button onClick={onShare} className="p-1 text-slate-400 hover:text-red-500"><Youtube className="w-3.5 h-3.5" /></button>
          )}
          {profile.website ? (
            <a href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`} target="_blank" rel="noopener noreferrer" className="p-1 hover:text-teal-700" title="Web">
              <Globe className="w-3.5 h-3.5 text-teal-700" />
            </a>
          ) : (
            <button onClick={onWebsite} className="p-1 text-slate-400 hover:text-teal-700"><Globe className="w-3.5 h-3.5" /></button>
          )}
        </div>

        <div className="h-4 w-px bg-slate-200"></div>

        <div className="flex items-center gap-2">
          <button
            onClick={onShare}
            className="flex items-center gap-1 text-[10px] font-semibold text-slate-700 hover:text-slate-900"
          >
            <QrCode className="w-3.5 h-3.5 text-slate-800" />
            <span>View QR</span>
          </button>
          {onViewFullProfile && (
            <>
              <span className="text-slate-300">•</span>
              <button
                onClick={onViewFullProfile}
                className="text-[10px] font-semibold text-teal-800 hover:text-teal-950 flex items-center"
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
