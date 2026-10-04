import React from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { CheckCircle2, Loader2, XCircle, HelpCircle } from 'lucide-react';
import { db } from '../../lib/firebase';
import { slugService } from '../../services/slugService';

// ============================================================================
// Card Link ID (Directive 32)
// ============================================================================
// The customer-facing name for a card's public address. Availability is read
// from slugs/{id}, which only the backend writes; the backend still claims the
// ID atomically when the card is published (setPublishingState) and refuses
// it there if someone else got it first. "Available" is shown only when that
// read actually succeeded.

export type CardLinkState = 'empty' | 'checking' | 'available' | 'taken' | 'reserved' | 'invalid' | 'unknown';

export interface CardLinkStatus {
  state: CardLinkState;
  message: string;
}

export async function checkCardLinkId(candidate: string, ownCardId?: string): Promise<CardLinkStatus> {
  if (!candidate) return { state: 'empty', message: '' };
  const format = slugService.validateSlug(candidate);
  if (!format.isValid) {
    if (format.errorCode === 'RESERVED_SYSTEM_ROUTE') return { state: 'reserved', message: `"${candidate}" is reserved and cannot be used.` };
    if (format.errorCode === 'TOO_SHORT') return { state: 'invalid', message: 'Use at least 3 characters.' };
    if (format.errorCode === 'TOO_LONG') return { state: 'invalid', message: 'Use at most 48 characters.' };
    return { state: 'invalid', message: 'Use lowercase letters, numbers and single hyphens only.' };
  }
  // The validator normalises first; the ID must already be exactly what will be saved.
  if (format.sanitizedSlug !== candidate) {
    return { state: 'invalid', message: 'Use lowercase letters, numbers and single hyphens, not starting or ending with a hyphen.' };
  }
  try {
    const snap = await getDoc(doc(db, 'slugs', candidate));
    if (snap.exists() && snap.get('entityId') !== ownCardId) return { state: 'taken', message: 'Already taken. Please choose another.' };
    return { state: 'available', message: 'Available' };
  } catch {
    return { state: 'unknown', message: 'Could not check right now; it is checked again when you publish.' };
  }
}

interface CardLinkIdFieldProps {
  value: string;
  onChange?: (value: string) => void;
  status?: CardLinkStatus;
  /** Shown under the field (e.g. why a suggestion was made). */
  note?: string | null;
  readOnly?: boolean;
}

const ICON: Partial<Record<CardLinkState, React.ReactNode>> = {
  checking: <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />,
  available: <CheckCircle2 className="w-3.5 h-3.5 mr-1" />,
  taken: <XCircle className="w-3.5 h-3.5 mr-1" />,
  reserved: <XCircle className="w-3.5 h-3.5 mr-1" />,
  invalid: <XCircle className="w-3.5 h-3.5 mr-1" />,
  unknown: <HelpCircle className="w-3.5 h-3.5 mr-1" />,
};

const TONE: Record<CardLinkState, string> = {
  empty: 'text-slate-400',
  checking: 'text-slate-500',
  available: 'text-emerald-700',
  taken: 'text-rose-700',
  reserved: 'text-rose-700',
  invalid: 'text-rose-700',
  unknown: 'text-amber-700',
};

export const CardLinkIdField: React.FC<CardLinkIdFieldProps> = ({ value, onChange, status, note, readOnly }) => {
  const bad = status && ['taken', 'reserved', 'invalid'].includes(status.state);
  return (
    <div data-testid="card-link-id-field">
      <label className="block font-medium text-slate-700 mb-1" htmlFor="card-link-id">Card Link ID</label>
      <div className="flex items-center gap-2">
        <input
          id="card-link-id"
          type="text"
          data-testid="card-link-id-input"
          value={value}
          readOnly={readOnly}
          onChange={(e) => onChange?.(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))}
          placeholder="first-last"
          className={`flex-1 px-3 py-2 rounded-xl border ${bad ? 'border-rose-400' : 'border-slate-200'} ${readOnly ? 'bg-slate-50 text-slate-600' : ''} focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono text-[11px]`}
        />
        {status && status.state !== 'empty' && (
          <span className={`inline-flex items-center text-[11px] font-semibold whitespace-nowrap ${TONE[status.state]}`} data-testid="card-link-id-status" data-state={status.state} role={bad ? 'alert' : undefined}>
            {ICON[status.state]}
            {status.state === 'available' ? 'Available' : status.state === 'checking' ? 'Checking…' : status.state === 'taken' ? 'Already taken' : status.state === 'reserved' ? 'Reserved' : status.state === 'invalid' ? 'Invalid format' : 'Not checked'}
          </span>
        )}
      </div>
      <span className="text-[10px] text-slate-400 mt-1 block">
        Used in your public card link{value ? <>: <span className="font-mono">/card/{value}</span></> : '.'}
      </span>
      {status && bad && <span className="text-[11px] text-rose-700 mt-0.5 block">{status.message}</span>}
      {status?.state === 'unknown' && <span className="text-[11px] text-amber-700 mt-0.5 block">{status.message}</span>}
      {note && <span className="text-[11px] text-slate-500 mt-0.5 block" data-testid="card-link-id-note">{note}</span>}
    </div>
  );
};
