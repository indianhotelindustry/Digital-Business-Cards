import React from 'react';
import { ShieldCheck, Terminal, X } from 'lucide-react';

// ============================================================================
// Legacy in-browser security test runner — RETIRED (Directive 25 Phase 13)
// ============================================================================
// The Directive 18-23 runner exercised the localStorage simulation of plans,
// subscriptions, payments, publishing and quotas. That simulation no longer
// exists: authority now lives in Cloud Functions and Firestore, so a browser
// cannot prove (or disprove) any of it. Security evidence comes only from the
// emulator suite:
//
//   npm test                 unit + Firestore rules + backend authority
//   npm run test:backend     Cloud Functions authority (AUTH-001..025)
//
// This DEVELOPMENT-only modal remains so the existing menu entry still works.

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const SecurityTestRunnerModal: React.FC<Props> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Security tests run on the emulator</h2>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
          Plans, entitlements, subscriptions, payments, quotas and publishing are enforced by the backend and
          Firestore rules, so browser-side tests cannot prove them. Run the emulator suite instead:
        </p>
        <div className="rounded-xl bg-slate-950 text-slate-100 font-mono text-xs p-4 space-y-1">
          <div className="flex items-center space-x-2 text-slate-400">
            <Terminal className="w-3.5 h-3.5" />
            <span>project root</span>
          </div>
          <div>npm test</div>
          <div>npm run test:backend</div>
        </div>
      </div>
    </div>
  );
};
