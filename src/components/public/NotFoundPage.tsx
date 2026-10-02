import React from 'react';
import { Compass } from 'lucide-react';

// Directive 27 Phase 9: unknown routes render a plain "not found" page. Nothing
// about other customers, drafts or the application is revealed here.
export function NotFoundPage({ path, onHome }: { path: string; onHome: () => void }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4" data-testid="not-found-page">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-8 text-center shadow-sm">
        <Compass className="w-12 h-12 text-slate-400 mx-auto mb-3" />
        <h1 className="text-lg font-bold text-slate-900">Page not found</h1>
        <p className="text-xs text-slate-500 mt-2 break-all">
          Nothing is published at <span className="font-mono">{path}</span>.
        </p>
        <button
          type="button"
          onClick={onHome}
          className="mt-5 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition"
        >
          Go to the home page
        </button>
      </div>
    </div>
  );
}
