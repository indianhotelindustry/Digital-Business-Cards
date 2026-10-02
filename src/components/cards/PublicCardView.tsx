import React, { useEffect, useState } from 'react';
import { Card, Company, Department, Employee } from '../../types';
import { DigitalIdentityProfile, ResolvedCardProfile } from '../../types/cardProfile';
import { resolveCardProfile } from '../../services/cardSectionResolver';
import { getDigitalIdentityProfile } from '../../services/digitalIdentityProfileService';
import { resolveCompanySlug } from '../../services/companyProfileResolver';
import { TemplateClassic } from './TemplateClassic';
import { TemplateModern } from './TemplateModern';
import { TemplateMinimal } from './TemplateMinimal';
import { ShareCardModal } from '../ShareCardModal';
import { ExchangeContactModal } from '../connect/ExchangeContactModal';
import { FullProfileDrawerModal } from './FullProfileDrawerModal';
import { CompanyProfileDrawerModal } from './CompanyProfileDrawerModal';
import { downloadVCard } from '../../services/vcardService';
import { recordAnalyticsEvent } from '../../services/analyticsService';
import { ShieldAlert, AlertCircle } from 'lucide-react';
import {
  sanitizeUrl,
  sanitizePhoneHref,
  sanitizeWhatsAppHref,
  sanitizeMailtoHref,
} from '../../lib/securityUtils';

interface PublicCardViewProps {
  card: Card;
  employee: Employee;
  company?: Company;
  department?: Department | null;
  profileOverride?: DigitalIdentityProfile | null;
  interactive?: boolean; // whether to trigger actual window.open / analytics
}

export const PublicCardView: React.FC<PublicCardViewProps> = ({
  card,
  employee,
  company,
  department,
  profileOverride,
  interactive = true,
}) => {
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [isFullProfileOpen, setIsFullProfileOpen] = useState(false);
  const [isCompanyProfileOpen, setIsCompanyProfileOpen] = useState(false);
  const [fetchedProfile, setFetchedProfile] = useState<DigitalIdentityProfile | null>(null);

  // Fetch optional DigitalIdentityProfile asynchronously
  useEffect(() => {
    let isMounted = true;
    if (profileOverride !== undefined) {
      setFetchedProfile(profileOverride);
      return;
    }

    async function loadProfile() {
      try {
        const p = await getDigitalIdentityProfile(employee.id);
        if (isMounted && p) {
          setFetchedProfile(p);
        }
      } catch (err) {
        console.warn('Error loading digital identity profile:', err);
      }
    }
    loadProfile();
    return () => {
      isMounted = false;
    };
  }, [employee.id, profileOverride]);

  // Log card view event once per session
  useEffect(() => {
    if (!interactive) return;
    recordAnalyticsEvent(employee.companyId, employee.id, card.id, 'card_view');
  }, [card.id, employee.id, employee.companyId, interactive]);

  // Resolve pure presentation profile from authoritative employee + company + profile
  const resolvedProfile: ResolvedCardProfile = resolveCardProfile(
    employee,
    company,
    department,
    profileOverride !== undefined ? profileOverride : fetchedProfile
  );

  // Handle suspended company
  if (company?.status === 'suspended') {
    return (
      <div className="w-full max-w-md mx-auto p-8 bg-amber-50/90 border border-amber-200 rounded-3xl text-center shadow-lg">
        <ShieldAlert className="w-12 h-12 text-amber-600 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-amber-900">Organization Suspended</h2>
        <p className="text-xs text-amber-700 mt-2 leading-relaxed">
          This digital business card is currently unavailable as the organization account has been
          suspended.
        </p>
      </div>
    );
  }

  // Handle inactive employee or card
  if (card.status === 'inactive' || employee.status === 'inactive') {
    return (
      <div className="w-full max-w-md mx-auto p-8 bg-slate-50 border border-slate-200 rounded-3xl text-center shadow-lg">
        <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-800">Card Unavailable</h2>
        <p className="text-xs text-slate-500 mt-2 leading-relaxed">
          This digital business card is currently inactive. Please contact the cardholder directly
          for up-to-date credentials.
        </p>
      </div>
    );
  }

  const handleCall = () => {
    if (!interactive) return;
    const href = sanitizePhoneHref(resolvedProfile.phone);
    if (href) {
      recordAnalyticsEvent(employee.companyId, employee.id, card.id, 'phone_click');
      window.location.href = href;
    }
  };

  const handleWhatsApp = () => {
    if (!interactive) return;
    const cleanNumber = resolvedProfile.whatsapp || resolvedProfile.phone;
    const href = sanitizeWhatsAppHref(cleanNumber);
    if (href) {
      recordAnalyticsEvent(employee.companyId, employee.id, card.id, 'whatsapp_click');
      window.open(href, '_blank', 'noopener,noreferrer');
    }
  };

  const handleEmail = () => {
    if (!interactive) return;
    const href = sanitizeMailtoHref(resolvedProfile.email);
    if (href) {
      recordAnalyticsEvent(employee.companyId, employee.id, card.id, 'email_click');
      window.location.href = href;
    }
  };

  const handleLinkedIn = () => {
    if (!interactive) return;
    const safeUrl = sanitizeUrl(resolvedProfile.socialLinks.linkedin);
    if (safeUrl) {
      recordAnalyticsEvent(employee.companyId, employee.id, card.id, 'linkedin_click');
      window.open(safeUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleWebsite = () => {
    if (!interactive) return;
    const targetUrl = resolvedProfile.website || resolvedProfile.companyWebsite;
    const safeUrl = sanitizeUrl(targetUrl);
    if (safeUrl) {
      recordAnalyticsEvent(employee.companyId, employee.id, card.id, 'website_click');
      window.open(safeUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleSocialClick = (platform: string, url: string) => {
    if (!interactive) return;
    const safeUrl = sanitizeUrl(url);
    if (safeUrl) {
      recordAnalyticsEvent(employee.companyId, employee.id, card.id, 'website_click', { platform });
      window.open(safeUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleSaveContact = () => {
    if (!interactive) return;
    recordAnalyticsEvent(employee.companyId, employee.id, card.id, 'save_contact');
    downloadVCard(employee, company, department);
  };

  const handleShare = () => {
    setIsShareModalOpen(true);
  };

  const handleConnect = () => {
    setIsConnectModalOpen(true);
  };

  const handleViewFullProfile = () => {
    if (card?.publicSlug) {
      const isPreview = window.location.hash.includes('preview=true');
      window.location.hash = `profile/${card.publicSlug}${isPreview ? '?preview=true' : ''}`;
    } else {
      setIsFullProfileOpen(true);
    }
  };

  const handleViewCompanyProfile = () => {
    if (resolvedProfile.hasCompanyAssociation) {
      const cSlug = company ? resolveCompanySlug(company) : '';
      if (cSlug) {
        const isPreview = window.location.hash.includes('preview=true');
        window.location.hash = `company/${cSlug}${isPreview ? '?preview=true' : ''}`;
      } else {
        setIsCompanyProfileOpen(true);
      }
    }
  };

  const templateProps = {
    profile: resolvedProfile,
    onCall: handleCall,
    onWhatsApp: handleWhatsApp,
    onEmail: handleEmail,
    onLinkedIn: handleLinkedIn,
    onWebsite: handleWebsite,
    onSaveContact: handleSaveContact,
    onShare: handleShare,
    onConnect: handleConnect,
    onSocialClick: handleSocialClick,
    onViewFullProfile: handleViewFullProfile,
    onViewCompanyProfile: handleViewCompanyProfile,
  };

  return (
    <>
      {card.templateId === 'modern' ? (
        <TemplateModern {...templateProps} />
      ) : card.templateId === 'minimal' ? (
        <TemplateMinimal {...templateProps} />
      ) : (
        <TemplateClassic {...templateProps} />
      )}

      {/* Full Profile Drawer Modal */}
      <FullProfileDrawerModal
        isOpen={isFullProfileOpen}
        onClose={() => setIsFullProfileOpen(false)}
        profile={resolvedProfile}
        onSaveContact={handleSaveContact}
        onConnect={handleConnect}
      />

      {/* Company Profile Drawer Modal */}
      {resolvedProfile.hasCompanyAssociation && (
        <CompanyProfileDrawerModal
          companySlug={company ? resolveCompanySlug(company) : ''}
          isOpen={isCompanyProfileOpen}
          onClose={() => setIsCompanyProfileOpen(false)}
          profile={resolvedProfile}
        />
      )}

      {/* Share & QR Modal */}
      {interactive && (
        <ShareCardModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          publicSlug={card.publicSlug}
          employee={employee}
          company={company}
        />
      )}

      {/* Exchange Contact / Connect Modal */}
      {interactive && (
        <ExchangeContactModal
          isOpen={isConnectModalOpen}
          onClose={() => setIsConnectModalOpen(false)}
          employee={employee}
          company={company}
        />
      )}
    </>
  );
};

