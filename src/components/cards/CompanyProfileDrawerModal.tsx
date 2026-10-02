import React from 'react';
import {
  X,
  Building,
  Globe,
  MapPin,
  ExternalLink,
  ShieldCheck,
  Phone,
  Mail,
} from 'lucide-react';
import { ResolvedCardProfile } from '../../types/cardProfile';
import { entityRoute, isPreviewLocation, navigate } from '../../lib/routes';

interface CompanyProfileDrawerModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: ResolvedCardProfile;
  /** Published website slug; empty when the company has no public website. */
  companySlug?: string;
}

export const CompanyProfileDrawerModal: React.FC<CompanyProfileDrawerModalProps> = ({
  isOpen,
  onClose,
  profile,
  companySlug = '',
}) => {
  if (!isOpen || !profile.hasCompanyAssociation) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg max-h-[85vh] bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden text-slate-800 animate-in slide-in-from-bottom duration-300">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 sticky top-0 z-10">
          <div className="flex items-center space-x-2">
            <Building className="w-5 h-5 text-teal-600" />
            <h2 className="text-base font-bold text-slate-900">Company Profile</h2>
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
          {/* Company Brand Header */}
          <div className="flex items-start gap-4">
            {profile.companyLogoUrl ? (
              <img
                src={profile.companyLogoUrl}
                alt={profile.companyName}
                className="h-16 max-w-[140px] object-contain bg-slate-50 p-2 rounded-2xl border border-slate-100 shadow-sm"
              />
            ) : (
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-sm"
                style={{ backgroundColor: profile.primaryColor }}
              >
                {profile.companyName?.[0] || 'C'}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="text-lg font-bold text-slate-900 truncate">{profile.companyName}</h3>
                <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0" />
              </div>
              <p className="text-xs text-slate-500 mt-0.5">Verified Organization Entity</p>
              {profile.companyWebsite && (
                <a
                  href={profile.companyWebsite.startsWith('http') ? profile.companyWebsite : `https://${profile.companyWebsite}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-xs font-semibold text-teal-700 hover:underline mt-1"
                >
                  <Globe className="w-3.5 h-3.5 mr-1" />
                  Visit Website
                  <ExternalLink className="w-3 h-3 ml-1" />
                </a>
              )}
            </div>
          </div>

          {/* Description */}
          {profile.companyDescription && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">About the Organization</h4>
              <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100">
                {profile.companyDescription}
              </p>
            </div>
          )}

          {/* Organization Details */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Corporate Information</h4>
            <div className="space-y-2 text-xs">
              {profile.companyAddress && (
                <div className="flex items-start p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  <MapPin className="w-4 h-4 text-slate-400 mr-3 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-slate-400 block">Headquarters</span>
                    <span className="text-slate-800">{profile.companyAddress}</span>
                  </div>
                </div>
              )}
              {profile.departmentName && (
                <div className="flex items-center p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  <Building className="w-4 h-4 text-slate-400 mr-3 shrink-0" />
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-slate-400 block">Department / Division</span>
                    <span className="text-slate-800 font-medium">{profile.departmentName}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center gap-2">
          {companySlug && (
            <button
              onClick={() => {
                onClose();
                navigate(entityRoute('company', companySlug, isPreviewLocation()));
              }}
              className="w-full sm:flex-1 py-2.5 px-4 rounded-xl bg-teal-700 text-white font-semibold text-xs hover:bg-teal-800 transition flex items-center justify-center gap-1.5 shadow-sm"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Visit Company Profile</span>
              <ExternalLink className="w-3 h-3 ml-0.5" />
            </button>
          )}
          <button
            onClick={onClose}
            className="w-full sm:w-auto py-2.5 px-4 rounded-xl bg-slate-200 text-slate-800 font-semibold text-xs hover:bg-slate-300 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
