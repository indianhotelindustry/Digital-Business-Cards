import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { CheckCircle2, EyeOff, Globe, Loader2, Lock, Send } from 'lucide-react';
import { publishingService } from '../../services/publishingService';
import { slugService } from '../../services/slugService';
import { describeBackendError } from '../../lib/backend';
import type { EntityPublishingRecord } from '../../types/publishing';
import { publicEntityUrl } from '../../lib/routes';
import { canonicalOrigin } from '../../lib/environment';

// ============================================================================
// Publishing panel (Directive 26 Phase 3/4)
// ============================================================================
// The one place where a customer publishes a company website or an employee
// card. Every action is the backend's setPublishingState: ownership,
// entitlement, seat lock, slug format / reserved routes and slug ownership are
// all decided server-side. This panel only shows the result.

interface PublishingPanelProps {
  entityType: 'company' | 'card';
  entityId: string;
  /** Suggested slug when the entity has never been published. */
  defaultSlug: string;
  title?: string;
  onChanged?: () => void;
}

const ROUTE: Record<PublishingPanelProps['entityType'], string> = { company: 'company', card: 'card' };

export const PublishingPanel: React.FC<PublishingPanelProps> = ({ entityType, entityId, defaultSlug, title, onChanged }) => {
  const [record, setRecord] = useState<EntityPublishingRecord | null>(null);
  const [slug, setSlug] = useState(slugService.sanitize(defaultSlug));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);

  const state = record?.publishingState ?? 'DRAFT';
  const isPublished = state === 'PUBLISHED';
  const isSuspended = state === 'SUSPENDED';
  const publicSlug = record?.slug || '';
  // Directive 27: the canonical path URL on the designated public origin (what the QR code carries).
  const publicUrl = publicSlug ? publicEntityUrl(entityType, publicSlug, canonicalOrigin()) : '';

  useEffect(() => {
    let alive = true;
    publishingService.fetchRecord(entityId).then((r) => {
      if (!alive) return;
      setRecord(r);
      if (r?.slug) setSlug(r.slug);
    });
    return () => {
      alive = false;
    };
  }, [entityId]);

  useEffect(() => {
    if (!isPublished || !publicUrl) {
      setQr(null);
      return;
    }
    QRCode.toDataURL(publicUrl, { margin: 1, width: 160 }).then(setQr).catch(() => setQr(null));
  }, [isPublished, publicUrl]);

  const run = async (next: 'PUBLISHED' | 'UNPUBLISHED') => {
    setError(null);
    setNotice(null);
    const candidate = slugService.sanitize(slug);
    if (next === 'PUBLISHED') {
      const check = slugService.validateSlug(candidate);
      if (!check.isValid) {
        setError(check.errorMessage || 'Invalid public address.');
        return;
      }
    }
    setBusy(true);
    try {
      await publishingService.setState(entityType, entityId, next, next === 'PUBLISHED' ? candidate : undefined);
      const fresh = await publishingService.fetchRecord(entityId);
      setRecord(fresh);
      setNotice(next === 'PUBLISHED' ? 'Published. The public address is live.' : 'Unpublished. The public address no longer shows this content.');
      onChanged?.();
    } catch (err) {
      setError(describeBackendError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3" data-testid={`publishing-panel-${entityType}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-teal-600" />
          <h3 className="text-sm font-bold text-slate-900">{title || (entityType === 'company' ? 'Public Website' : 'Public Card')}</h3>
        </div>
        <span
          data-testid="publishing-state"
          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
            isPublished ? 'bg-emerald-100 text-emerald-800' : isSuspended ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'
          }`}
        >
          {isPublished ? 'Published' : isSuspended ? 'Suspended by platform' : state === 'UNPUBLISHED' ? 'Unpublished' : 'Not published'}
        </span>
      </div>

      {isSuspended ? (
        <p className="text-xs text-rose-700 flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5" /> The platform has suspended this {entityType === 'company' ? 'website' : 'card'}. Contact support.
        </p>
      ) : (
        <>
          <label className="block text-[11px] font-semibold text-slate-600">
            {entityType === 'card' ? 'Card Link ID' : 'Public address'}
            <div className="mt-1 flex items-center rounded-xl border border-slate-200 overflow-hidden">
              <span className="px-2 py-2 text-[11px] text-slate-500 bg-slate-50 border-r border-slate-200">/{ROUTE[entityType]}/</span>
              <input
                aria-label="Public address slug"
                data-testid="publishing-slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase())}
                className="flex-1 px-2 py-2 text-xs outline-none"
                placeholder="your-public-name"
              />
            </div>
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              data-testid="publish-button"
              disabled={busy}
              onClick={() => run('PUBLISHED')}
              className="inline-flex items-center px-3 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold disabled:opacity-60"
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1.5" />}
              {isPublished ? 'Update & Publish' : 'Publish'}
            </button>
            {isPublished && (
              <button
                type="button"
                data-testid="unpublish-button"
                disabled={busy}
                onClick={() => run('UNPUBLISHED')}
                className="inline-flex items-center px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold disabled:opacity-60"
              >
                <EyeOff className="w-3.5 h-3.5 mr-1.5" /> Unpublish
              </button>
            )}
            {publicSlug && (
              <a
                href={`#${ROUTE[entityType]}/${publicSlug}?preview=true`}
                className="inline-flex items-center px-3 py-2 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-xs font-semibold"
              >
                Preview
              </a>
            )}
          </div>
        </>
      )}

      {notice && (
        <p className="text-xs text-emerald-700 flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5" /> {notice}
        </p>
      )}
      {error && (
        <p role="alert" data-testid="publishing-error" className="text-xs text-rose-700">
          {error}
        </p>
      )}

      {isPublished && publicUrl && (
        <div className="flex items-center gap-3 pt-1">
          {qr && <img src={qr} alt={`QR code for ${publicUrl}`} className="w-20 h-20 rounded-lg border border-slate-200" />}
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Live public URL</div>
            <a data-testid="public-url" href={publicUrl} target="_blank" rel="noreferrer" className="text-xs font-mono text-teal-700 break-all hover:underline">
              {publicUrl}
            </a>
          </div>
        </div>
      )}
    </div>
  );
};
