import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, Check, Download, Share2, X, ExternalLink, Smartphone } from 'lucide-react';
import { Employee, Company } from '../types';
import { downloadVCard } from '../services/vcardService';
import { recordAnalyticsEvent } from '../services/analyticsService';

interface ShareCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  publicSlug: string;
  employee: Employee;
  company?: Company;
}

export const ShareCardModal: React.FC<ShareCardModalProps> = ({
  isOpen,
  onClose,
  publicSlug,
  employee,
  company,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [shareSuccess, setShareSuccess] = useState<boolean>(false);

  // Construct stable public card URL
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const cardUrl = `${origin}/#card/${publicSlug}`;

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    QRCode.toDataURL(cardUrl, {
      width: 400,
      margin: 2,
      color: {
        dark: company?.branding.primaryColor || '#0f172a',
        light: '#ffffff',
      },
    })
      .then((url) => {
        if (isMounted) setQrDataUrl(url);
      })
      .catch((err) => {
        console.error('Error rendering QR code:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, cardUrl, company?.branding.primaryColor]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(cardUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      if (employee.cardId) {
        recordAnalyticsEvent(employee.companyId, employee.id, employee.cardId, 'share', {
          action: 'copy_link',
        });
      }
    } catch (e) {
      console.warn('Copy failed:', e);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${employee.displayName} - Digital Business Card`,
          text: `Connect with ${employee.displayName} (${employee.designation} at ${company?.name || 'Company'})`,
          url: cardUrl,
        });
        setShareSuccess(true);
        setTimeout(() => setShareSuccess(false), 2500);
        if (employee.cardId) {
          recordAnalyticsEvent(employee.companyId, employee.id, employee.cardId, 'share', {
            action: 'native_share',
          });
        }
      } catch (err) {
        // User cancelled or share failed
      }
    } else {
      handleCopy();
    }
  };

  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `qr_${publicSlug}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSaveContact = () => {
    downloadVCard(employee, company);
    if (employee.cardId) {
      recordAnalyticsEvent(employee.companyId, employee.id, employee.cardId, 'save_contact');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Share Digital Card</h3>
            <p className="text-xs text-slate-500">Persistent public link & scannable QR</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* QR Container */}
          <div className="flex flex-col items-center justify-center p-6 bg-slate-50 rounded-2xl border border-slate-200/80">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="QR Code"
                className="w-48 h-48 rounded-xl shadow-sm bg-white p-2 border border-slate-100"
              />
            ) : (
              <div className="w-48 h-48 flex items-center justify-center bg-white rounded-xl">
                <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
            <div className="mt-4 text-center">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-50 text-teal-700 border border-teal-200">
                <Smartphone className="w-3 h-3 mr-1" /> Scan to view on mobile
              </span>
              <p className="text-xs text-slate-500 mt-1">
                Points directly to stable URL. Never expires.
              </p>
            </div>
          </div>

          {/* Stable URL bar */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600 uppercase tracking-wider">
              Stable Public URL
            </label>
            <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 font-mono">
              <span className="truncate flex-1">{cardUrl}</span>
              <button
                type="button"
                onClick={handleCopy}
                className="ml-2 inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span className="ml-1">{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleNativeShare}
              className="flex items-center justify-center px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold tracking-wide shadow-sm transition"
            >
              <Share2 className="w-4 h-4 mr-1.5" />
              {shareSuccess ? 'Shared!' : 'Share Card'}
            </button>
            <button
              onClick={handleDownloadQr}
              className="flex items-center justify-center px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold tracking-wide transition"
            >
              <Download className="w-4 h-4 mr-1.5" />
              Download QR
            </button>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
            <button
              onClick={handleSaveContact}
              className="text-teal-700 hover:text-teal-800 font-medium inline-flex items-center"
            >
              <Download className="w-3.5 h-3.5 mr-1" /> Download vCard (.vcf)
            </button>
            <a
              href={cardUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-500 hover:text-slate-800 inline-flex items-center"
            >
              Open public card <ExternalLink className="w-3.5 h-3.5 ml-1" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
