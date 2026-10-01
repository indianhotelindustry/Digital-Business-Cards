import React, { useEffect, useState } from 'react';
import { Card, Company, Department, Employee } from '../../types';
import { getCardBySlug } from '../../services/cardService';
import { getEmployeeById } from '../../services/employeeService';
import { getCompanyById } from '../../services/companyService';
import { getDepartmentById } from '../../services/departmentService';
import { publishingService } from '../../services/publishingService';
import { PublicCardView } from '../cards/PublicCardView';
import { ThemeToggle } from '../common/ThemeToggle';
import { Search, ArrowLeft, Lock, AlertTriangle, FileText } from 'lucide-react';

interface PublicCardPageProps {
  slug: string;
  onBackToApp?: () => void;
  isAdminPreview?: boolean;
}

export const PublicCardPage: React.FC<PublicCardPageProps> = ({
  slug,
  onBackToApp,
  isAdminPreview = false,
}) => {
  const [loading, setLoading] = useState(true);
  const [card, setCard] = useState<Card | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [department, setDepartment] = useState<Department | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [publishingIssue, setPublishingIssue] = useState<'DRAFT' | 'UNPUBLISHED' | 'SUSPENDED' | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadPublicCard() {
      setLoading(true);
      setError(null);
      setPublishingIssue(null);
      try {
        const foundCard = await getCardBySlug(slug);
        if (!foundCard) {
          if (isMounted) {
            setError('Card not found');
            setLoading(false);
          }
          return;
        }

        // Publishing Governance Gate (Directive 20 requirement #6)
        const pubCheck = publishingService.canPublicView(foundCard.id, isAdminPreview);
        if (!pubCheck.allowed) {
          if (isMounted) {
            if (pubCheck.reason === 'SUSPENDED') {
              setPublishingIssue('SUSPENDED');
            } else if (pubCheck.reason === 'DRAFT' || pubCheck.reason === 'UNPUBLISHED') {
              setPublishingIssue(pubCheck.reason);
            } else {
              setError('Card unavailable');
            }
            setLoading(false);
          }
          return;
        }

        let foundEmp: Employee | null = null;
        let foundComp: Company | null = null;
        let foundDept: Department | null = null;

        try {
          foundEmp = await getEmployeeById(foundCard.employeeId);
        } catch (e) {
          console.warn('Could not load employee for card:', e);
        }

        try {
          foundComp = await getCompanyById(foundCard.companyId);
        } catch (e) {
          console.warn('Could not load company for card:', e);
        }

        // Check if company is suspended
        if (foundComp?.status === 'suspended' && !isAdminPreview) {
          if (isMounted) {
            setPublishingIssue('SUSPENDED');
            setLoading(false);
          }
          return;
        }

        if (foundEmp?.departmentId) {
          try {
            foundDept = await getDepartmentById(foundEmp.departmentId);
          } catch (e) {
            console.warn('Could not load department for card:', e);
          }
        }

        if (isMounted) {
          setCard(foundCard);
          setEmployee(foundEmp);
          setCompany(foundComp);
          setDepartment(foundDept);
          setLoading(false);
        }
      } catch (err: any) {
        console.error('Error fetching public card data:', err);
        if (isMounted) {
          setError(err.message || 'Failed to load card');
          setLoading(false);
        }
      }
    }

    if (slug) {
      loadPublicCard();
    }
  }, [slug, isAdminPreview]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 border-3 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-xs font-medium text-slate-500 uppercase tracking-wider">
          Loading Digital Card...
        </p>
      </div>
    );
  }

  // Publishing Governance Screens
  if (publishingIssue === 'SUSPENDED') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full p-8 bg-white border border-slate-200/80 rounded-3xl shadow-sm text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4 border border-amber-200">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h1 className="text-lg font-bold text-slate-900">Card Suspended</h1>
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">
            This digital business card has been temporarily suspended by platform administration or the parent organization.
          </p>
          {onBackToApp && (
            <button
              onClick={onBackToApp}
              className="mt-6 inline-flex items-center px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition"
            >
              <ArrowLeft className="w-4 h-4 mr-1.5" /> Return to Platform
            </button>
          )}
        </div>
      </div>
    );
  }

  if (publishingIssue === 'DRAFT' || publishingIssue === 'UNPUBLISHED') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full p-8 bg-white border border-slate-200/80 rounded-3xl shadow-sm text-center">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4 border border-blue-200">
            <FileText className="w-7 h-7" />
          </div>
          <h1 className="text-lg font-bold text-slate-900">Card Currently in Draft</h1>
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">
            This digital business card has not yet been published by the author. Public viewing will be enabled once onboarding and publishing are completed.
          </p>
          {onBackToApp && (
            <button
              onClick={onBackToApp}
              className="mt-6 inline-flex items-center px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition"
            >
              <ArrowLeft className="w-4 h-4 mr-1.5" /> Return to Platform
            </button>
          )}
        </div>
      </div>
    );
  }

  if (error || !card || !employee) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full p-8 bg-white border border-slate-200/80 rounded-3xl shadow-sm text-center">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4">
            <Search className="w-7 h-7" />
          </div>
          <h1 className="text-lg font-bold text-slate-900">Card Not Found</h1>
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">
            The requested digital business card slug &quot;{slug}&quot; could not be located. The link may
            be incorrect or the cardholder may have updated their URL.
          </p>

          {onBackToApp && (
            <button
              onClick={onBackToApp}
              className="mt-6 inline-flex items-center px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition"
            >
              <ArrowLeft className="w-4 h-4 mr-1.5" /> Return to Platform
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans flex flex-col items-center transition-colors duration-200">
      {/* Floating Visitor Theme Switcher (top-right) */}
      <div className="fixed top-3 right-3 z-50">
        <ThemeToggle variant="compact" />
      </div>

      {/* Container for initial mobile viewport / content */}
      <div className="w-full min-h-[100dvh] flex flex-col items-center justify-center py-6 px-3 sm:px-4">
        {/* LAYER 1: ADMIN PREVIEW SHELL (Rendered ONLY in explicit admin preview mode, NEVER on public card URLs) */}
        {isAdminPreview && onBackToApp && (
          <header className="w-full max-w-[390px] flex items-center justify-between mb-3 px-1">
            <button
              onClick={onBackToApp}
              className="text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white inline-flex items-center px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-800 transition active:scale-95"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Back to Dashboard
            </button>

            <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 bg-white/90 dark:bg-slate-900/90 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
              /{card.publicSlug}
            </div>
          </header>
        )}

        {/* LAYER 2: PUBLIC DIGITAL BUSINESS CARD (The Hero Experience) */}
        <main className="w-full flex-1 flex items-center justify-center">
          <PublicCardView
            card={card}
            employee={employee}
            company={company || undefined}
            department={department}
          />
        </main>
      </div>

      {/* LAYER 3: ACTUAL PAGE FOOTER (Subtle platform metadata positioned below the fold) */}
      <footer className="w-full py-6 pb-8 text-center text-slate-400 dark:text-slate-600 font-sans select-none">
        <p className="text-[11px] font-normal text-slate-400 dark:text-slate-500">
          Powered by{' '}
          <span className="font-semibold text-slate-500 dark:text-slate-400">Digital Business Card SaaS</span>
        </p>
        <p className="text-[9px] text-slate-400/80 dark:text-slate-600 mt-0.5 tracking-tight">
          Universal Appearance System • Multi-Tenant Cloud Architecture • RFC 6350 Compatible
        </p>
      </footer>
    </div>
  );
};

