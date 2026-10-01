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
  Twitter,
  Instagram,
  Github,
  Youtube,
  Globe,
  QrCode,
} from 'lucide-react';
import { CardTemplateRenderProps } from './TemplateClassic';

export const TemplateMinimal: React.FC<CardTemplateRenderProps> = ({
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
    <div className="w-full max-w-[390px] mx-auto bg-stone-50 rounded-[28px] shadow-xl border border-stone-300/80 p-5 text-stone-900 transition-all select-none flex flex-col justify-between">
      {/* Top Bar: Company / Identity & Share */}
      <div className="flex items-center justify-between pb-3 border-b border-stone-200">
        <div>
          {profile.hasCompanyAssociation ? (
            profile.companyLogoUrl ? (
              <button
                type="button"
                onClick={onViewCompanyProfile}
                aria-label={`Visit ${profile.companyName} company profile`}
                className="cursor-pointer hover:opacity-85 transition p-1 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-400"
              >
                <img
                  src={profile.companyLogoUrl}
                  alt={profile.companyName}
                  className="h-6 max-w-[110px] object-contain"
                />
              </button>
            ) : (
              <button
                type="button"
                onClick={onViewCompanyProfile}
                aria-label={`Visit ${profile.companyName} company profile`}
                className="font-mono text-[11px] uppercase tracking-wider font-bold text-stone-700 hover:text-stone-950 truncate max-w-[140px] block transition text-left focus:outline-none focus:ring-2 focus:ring-stone-400 rounded px-1"
              >
                {profile.companyName}
              </button>
            )
          ) : (
            <span className="font-mono text-[11px] uppercase tracking-wider font-bold text-stone-600 flex items-center">
              <User className="w-3 h-3 mr-1" />
              Identity
            </span>
          )}
        </div>
        <button
          onClick={onShare}
          className="p-1.5 rounded-lg hover:bg-stone-200 text-stone-600 transition active:scale-95"
          title="Share"
        >
          <Share2 className="w-4 h-4" />
        </button>
      </div>

      {/* Main Identity Hierarchy */}
      <div className="pt-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-serif tracking-tight font-medium text-stone-900 truncate">
              {profile.displayName}
            </h1>
            <p className="text-[11px] font-mono tracking-wider uppercase text-stone-600 mt-0.5 font-semibold truncate">
              {profile.designation}
            </p>
            {profile.hasCompanyAssociation ? (
              <button
                onClick={onViewCompanyProfile}
                className="text-[11px] text-stone-500 hover:text-stone-800 font-mono truncate flex items-center gap-0.5 mt-0.5"
              >
                <Building className="w-3 h-3 shrink-0" />
                <span className="truncate">{profile.companyName}</span>
                {profile.departmentName && ` • ${profile.departmentName}`}
              </button>
            ) : (
              <p className="text-[11px] text-stone-400 font-mono truncate flex items-center gap-1 mt-0.5">
                <ShieldCheck className="w-3 h-3 text-stone-500" />
                <span>Independent</span>
              </p>
            )}
          </div>

          {profile.profilePhotoUrl ? (
            <img
              src={profile.profilePhotoUrl}
              alt={profile.displayName}
              className="w-14 h-14 rounded-xl object-cover grayscale contrast-125 border border-stone-300 shrink-0"
            />
          ) : (
            <div className="w-14 h-14 rounded-xl bg-stone-200 flex items-center justify-center font-mono text-stone-700 font-bold text-lg shrink-0">
              {profile.firstName?.[0] || 'U'}
            </div>
          )}
        </div>

        {/* Location & Department Metadata */}
        <div className="mt-2 flex items-center gap-2 text-[11px] font-mono text-stone-500">
          {profile.location && (
            <span className="inline-flex items-center gap-1 truncate max-w-[140px]">
              <MapPin className="w-3 h-3 text-stone-600 shrink-0" />
              <span className="truncate">{profile.location}</span>
            </span>
          )}
          {profile.location && profile.departmentName && <span className="text-stone-300">|</span>}
          {profile.departmentName && (
            <span className="inline-flex items-center gap-1 truncate max-w-[140px]">
              <Briefcase className="w-3 h-3 text-stone-600 shrink-0" />
              <span className="truncate">{profile.departmentName}</span>
            </span>
          )}
        </div>

        {/* Headline */}
        {profile.headline && (
          <p className="text-[11px] text-stone-600 italic mt-2 font-light line-clamp-1 border-l-2 border-stone-300 pl-2">
            &ldquo;{profile.headline}&rdquo;
          </p>
        )}

        {/* Top Skills */}
        {profile.expertise && profile.expertise.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {profile.expertise.slice(0, 4).map((exp, idx) => (
              <span
                key={idx}
                className="px-2 py-0.5 rounded bg-stone-200/70 text-stone-800 font-mono text-[10px]"
              >
                {exp}
              </span>
            ))}
            {profile.expertise.length > 4 && (
              <span className="text-[10px] font-mono text-stone-400 self-center">
                +{profile.expertise.length - 4}
              </span>
            )}
          </div>
        )}
      </div>

      {/* COMPACT METRICS */}
      {profile.metrics && profile.metrics.length > 0 && (
        <div className="mt-2.5">
          <div className="grid grid-cols-3 gap-1.5 p-1.5 bg-stone-100 rounded-lg border border-stone-200 text-center font-mono">
            {profile.metrics.slice(0, 3).map((m, idx) => (
              <div key={idx} className="flex flex-col">
                <span className="text-[11px] font-bold text-stone-900 leading-none">{m.value}</span>
                <span className="text-[9px] text-stone-500 leading-tight mt-0.5 truncate">{m.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* QUICK ACTIONS ROW */}
      <div className="mt-3 grid grid-cols-4 gap-1.5 font-mono">
        <button
          onClick={onCall}
          disabled={!profile.phone}
          className="py-2 px-1 rounded-lg bg-stone-200/70 hover:bg-stone-200 text-stone-800 text-[11px] flex flex-col items-center justify-center transition disabled:opacity-40 disabled:pointer-events-none active:scale-95"
        >
          <Phone className="w-3.5 h-3.5 mb-0.5" />
          <span>Call</span>
        </button>

        <button
          onClick={onWhatsApp}
          disabled={!profile.whatsapp && !profile.phone}
          className="py-2 px-1 rounded-lg bg-stone-200/70 hover:bg-stone-200 text-stone-800 text-[11px] flex flex-col items-center justify-center transition disabled:opacity-40 disabled:pointer-events-none active:scale-95"
        >
          <MessageSquare className="w-3.5 h-3.5 mb-0.5" />
          <span>Chat</span>
        </button>

        <button
          onClick={onEmail}
          disabled={!profile.email}
          className="py-2 px-1 rounded-lg bg-stone-200/70 hover:bg-stone-200 text-stone-800 text-[11px] flex flex-col items-center justify-center transition disabled:opacity-40 disabled:pointer-events-none active:scale-95"
        >
          <Mail className="w-3.5 h-3.5 mb-0.5" />
          <span>Email</span>
        </button>

        <button
          onClick={onLinkedIn}
          disabled={!profile.socialLinks?.linkedin}
          className="py-2 px-1 rounded-lg bg-stone-200/70 hover:bg-stone-200 text-stone-800 text-[11px] flex flex-col items-center justify-center transition disabled:opacity-40 disabled:pointer-events-none active:scale-95"
        >
          <Linkedin className="w-3.5 h-3.5 mb-0.5" />
          <span>Link</span>
        </button>
      </div>

      {/* PRIMARY CONVERSION CTAs + SECONDARY CONTEXTUAL CTA */}
      <div className="mt-3 space-y-2 font-mono">
        <div className="grid grid-cols-2 gap-2">
          {onConnect && (
            <button
              onClick={onConnect}
              className="flex items-center justify-center min-h-[44px] py-2.5 px-2 rounded-xl text-stone-100 text-xs bg-stone-900 hover:bg-stone-800 transition active:scale-[0.99]"
            >
              <UserPlus className="w-3.5 h-3.5 mr-1.5 text-teal-400 shrink-0" />
              <span className="truncate">Connect / Exchange</span>
            </button>
          )}

          <button
            onClick={onSaveContact}
            className={`flex items-center justify-center min-h-[44px] py-2.5 px-2 rounded-xl text-stone-900 text-xs border border-stone-400 hover:bg-stone-200 transition active:scale-[0.99] ${!onConnect ? 'col-span-2' : ''}`}
          >
            <Bookmark className="w-3.5 h-3.5 mr-1.5 shrink-0" />
            <span className="truncate">Save Contact</span>
          </button>
        </div>

        {/* SECONDARY CONTEXTUAL CTA */}
        {profile.hasCompanyAssociation ? (
          <button
            onClick={onViewCompanyProfile}
            className="w-full flex items-center justify-center min-h-[42px] py-2.5 px-3 rounded-xl bg-stone-200/80 hover:bg-stone-300/80 text-stone-800 text-xs font-semibold border border-stone-300 transition active:scale-[0.99]"
          >
            <Building className="w-3.5 h-3.5 mr-1.5 text-stone-600 shrink-0" />
            <span>View Company Profile</span>
            <ChevronRight className="w-3 h-3 ml-1 text-stone-400" />
          </button>
        ) : (
          <button
            onClick={onViewFullProfile}
            className="w-full flex items-center justify-center min-h-[42px] py-2.5 px-3 rounded-xl bg-stone-200/80 hover:bg-stone-300/80 text-stone-800 text-xs font-semibold border border-stone-300 transition active:scale-[0.99]"
          >
            <User className="w-3.5 h-3.5 mr-1.5 text-stone-600 shrink-0" />
            <span>View Full Profile</span>
            <ChevronRight className="w-3 h-3 ml-1 text-stone-400" />
          </button>
        )}
      </div>

      {/* BOTTOM SOCIAL & QR STRIP INSIDE CARD */}
      <div className="w-full pt-3 mt-2.5 border-t border-stone-200 flex items-center justify-between text-xs font-mono">
        <div className="flex items-center gap-2 text-stone-700">
          {profile.socialLinks?.twitter ? (
            <a href={profile.socialLinks.twitter} target="_blank" rel="noopener noreferrer" className="p-1 hover:text-stone-900" title="X">
              <Twitter className="w-3.5 h-3.5" />
            </a>
          ) : (
            <button onClick={onShare} className="p-1 text-stone-400 hover:text-stone-700"><Twitter className="w-3.5 h-3.5" /></button>
          )}
          {profile.socialLinks?.instagram ? (
            <a href={profile.socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="p-1 hover:text-pink-600" title="Instagram">
              <Instagram className="w-3.5 h-3.5" />
            </a>
          ) : (
            <button onClick={onShare} className="p-1 text-stone-400"><Instagram className="w-3.5 h-3.5" /></button>
          )}
          {profile.socialLinks?.github ? (
            <a href={profile.socialLinks.github} target="_blank" rel="noopener noreferrer" className="p-1 hover:text-stone-900" title="GitHub">
              <Github className="w-3.5 h-3.5" />
            </a>
          ) : (
            <button onClick={onShare} className="p-1 text-stone-400"><Github className="w-3.5 h-3.5" /></button>
          )}
          {profile.socialLinks?.youtube ? (
            <a href={profile.socialLinks.youtube} target="_blank" rel="noopener noreferrer" className="p-1 hover:text-red-600" title="YouTube">
              <Youtube className="w-3.5 h-3.5" />
            </a>
          ) : (
            <button onClick={onShare} className="p-1 text-stone-400"><Youtube className="w-3.5 h-3.5" /></button>
          )}
          {profile.website ? (
            <a href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`} target="_blank" rel="noopener noreferrer" className="p-1 hover:text-stone-900" title="Web">
              <Globe className="w-3.5 h-3.5" />
            </a>
          ) : (
            <button onClick={onWebsite} className="p-1 text-stone-400"><Globe className="w-3.5 h-3.5" /></button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onShare}
            className="flex items-center gap-1 text-[10px] font-bold text-stone-800 hover:text-stone-950"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>QR</span>
          </button>
          {onViewFullProfile && (
            <>
              <span className="text-stone-300">•</span>
              <button
                onClick={onViewFullProfile}
                className="text-[10px] font-bold text-stone-800 hover:text-stone-950 flex items-center"
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

