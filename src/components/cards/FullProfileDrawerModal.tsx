import React from 'react';
import {
  X,
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
} from 'lucide-react';
import { ResolvedCardProfile } from '../../types/cardProfile';

interface FullProfileDrawerModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: ResolvedCardProfile;
  onSaveContact: () => void;
  onConnect?: () => void;
}

export const FullProfileDrawerModal: React.FC<FullProfileDrawerModalProps> = ({
  isOpen,
  onClose,
  profile,
  onSaveContact,
  onConnect,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg max-h-[90vh] bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden text-slate-800 animate-in slide-in-from-bottom duration-300">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 sticky top-0 z-10">
          <div className="flex items-center space-x-2">
            <User className="w-5 h-5 text-teal-600" />
            <h2 className="text-base font-bold text-slate-900">Complete Digital Identity</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Identity Header */}
          <div className="flex items-start gap-4">
            {profile.profilePhotoUrl ? (
              <img
                src={profile.profilePhotoUrl}
                alt={profile.displayName}
                className="w-16 h-16 rounded-2xl object-cover border-2 border-teal-500/30 shadow-sm"
              />
            ) : (
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-sm"
                style={{ backgroundColor: profile.primaryColor }}
              >
                {profile.firstName?.[0] || 'U'}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="text-lg font-bold text-slate-900 truncate">{profile.displayName}</h3>
                <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
              </div>
              <p className="text-xs font-semibold text-slate-700 mt-0.5">{profile.designation}</p>
              {profile.hasCompanyAssociation && (
                <p className="text-xs text-slate-500 mt-0.5">
                  {profile.companyName}
                  {profile.departmentName && ` • ${profile.departmentName}`}
                </p>
              )}
            </div>
          </div>

          {/* Professional Headline */}
          {profile.headline && (
            <div className="p-3.5 rounded-2xl bg-teal-50/60 border border-teal-100/80">
              <p className="text-xs font-medium text-teal-900 italic">&ldquo;{profile.headline}&rdquo;</p>
            </div>
          )}

          {/* About / Bio */}
          {profile.about && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">About & Background</h4>
              <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100">
                {profile.about}
              </p>
            </div>
          )}

          {/* Key Metrics */}
          {profile.metrics && profile.metrics.length > 0 && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Professional Highlights</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {profile.metrics.map((m, i) => (
                  <div key={i} className="p-3 rounded-2xl bg-slate-50 border border-slate-100 text-center">
                    <span className="text-sm font-bold text-slate-900 block">{m.value}</span>
                    <span className="text-[11px] text-slate-500">{m.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Skills & Focus Areas */}
          {profile.expertise && profile.expertise.length > 0 && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center">
                <Sparkles className="w-3.5 h-3.5 mr-1.5 text-teal-600" />
                Areas of Expertise
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {profile.expertise.map((exp, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1.5 rounded-xl bg-teal-50 border border-teal-100 text-teal-800 text-xs font-medium"
                  >
                    {exp}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Services Offered */}
          {profile.services && profile.services.length > 0 && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center">
                <Briefcase className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
                Services & Solutions
              </h4>
              <div className="space-y-2">
                {profile.services.map((svc, idx) => (
                  <div
                    key={svc.id || idx}
                    className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 text-slate-800 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">{svc.title}</span>
                      {svc.deliveryMode && (
                        <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">
                          {svc.deliveryMode}
                        </span>
                      )}
                    </div>
                    {svc.description && <p className="text-[11px] text-slate-600 leading-relaxed">{svc.description}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Career Experience */}
          {profile.experiences && profile.experiences.length > 0 && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center">
                <Briefcase className="w-3.5 h-3.5 mr-1.5 text-teal-600" />
                Experience Timeline
              </h4>
              <div className="space-y-2.5">
                {profile.experiences.map((exp, idx) => (
                  <div
                    key={exp.id || idx}
                    className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 text-slate-800 text-xs space-y-1"
                  >
                    <div className="flex items-start justify-between">
                      <span className="font-bold text-slate-900">{exp.role}</span>
                      <span className="text-[10px] font-mono text-slate-500">
                        {exp.startDate} – {exp.endDate || 'Present'}
                      </span>
                    </div>
                    <p className="text-[11px] font-medium text-teal-700">{exp.organization}</p>
                    {exp.description && <p className="text-[11px] text-slate-600 pt-0.5">{exp.description}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Credentials & Certifications */}
          {profile.credentials && profile.credentials.length > 0 && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center">
                <Award className="w-3.5 h-3.5 mr-1.5 text-amber-600" />
                Credentials & Certifications
              </h4>
              <div className="space-y-2">
                {profile.credentials.map((cred, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-2xl bg-amber-50/50 border border-amber-100 text-slate-800 text-xs flex items-center justify-between"
                  >
                    <div>
                      <span className="font-bold block text-slate-900">{cred.title}</span>
                      {cred.issuer && <span className="text-[11px] text-slate-500">{cred.issuer}</span>}
                    </div>
                    {cred.year && (
                      <span className="text-[11px] font-mono text-amber-800 px-2.5 py-0.5 rounded-lg bg-amber-100">
                        {cred.year}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Direct Contact Points */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Direct Contact Channels</h4>
            <div className="space-y-2 text-xs">
              {profile.email && (
                <div className="flex items-center p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  <Mail className="w-4 h-4 text-slate-400 mr-3 shrink-0" />
                  <div className="truncate">
                    <span className="text-[10px] uppercase font-semibold text-slate-400 block">Email</span>
                    <span className="text-slate-800 font-medium">{profile.email}</span>
                  </div>
                </div>
              )}
              {profile.phone && (
                <div className="flex items-center p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  <Phone className="w-4 h-4 text-slate-400 mr-3 shrink-0" />
                  <div className="truncate">
                    <span className="text-[10px] uppercase font-semibold text-slate-400 block">Phone</span>
                    <span className="text-slate-800 font-medium">{profile.phone}</span>
                  </div>
                </div>
              )}
              {profile.website && (
                <div className="flex items-center p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  <Globe className="w-4 h-4 text-slate-400 mr-3 shrink-0" />
                  <div className="truncate">
                    <span className="text-[10px] uppercase font-semibold text-slate-400 block">Website</span>
                    <span className="text-slate-800 font-medium">{profile.website}</span>
                  </div>
                </div>
              )}
              {profile.location && (
                <div className="flex items-center p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  <MapPin className="w-4 h-4 text-slate-400 mr-3 shrink-0" />
                  <div className="truncate">
                    <span className="text-[10px] uppercase font-semibold text-slate-400 block">Location</span>
                    <span className="text-slate-800 font-medium">{profile.location}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center gap-3">
          {onConnect && (
            <button
              onClick={() => {
                onClose();
                onConnect();
              }}
              className="flex-1 py-3 px-4 rounded-xl bg-slate-900 text-white font-semibold text-xs hover:bg-slate-800 transition"
            >
              Connect with {profile.firstName || 'User'}
            </button>
          )}
          <button
            onClick={() => {
              onSaveContact();
            }}
            className="flex-1 py-3 px-4 rounded-xl text-white font-semibold text-xs transition"
            style={{ backgroundColor: profile.primaryColor }}
          >
            Save Contact (.vcf)
          </button>
        </div>
      </div>
    </div>
  );
};
