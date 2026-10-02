import React, { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, RefreshCw, XCircle } from 'lucide-react';
import { callBackend, describeBackendError } from '../../lib/backend';
import { publicEntityUrl } from '../../lib/routes';
import { canonicalOrigin } from '../../lib/environment';

// ============================================================================
// App Owner — Demo Readiness (Directive 26 Phases 8 & 9)
// ============================================================================
// Read-only operational view computed by the backend (adminGetDemoReadiness),
// which runs the same anonymous public resolver as the real public routes.
// Nothing here edits customer data: each failing check names the existing,
// audited control that fixes it.

interface Check {
  key: string;
  ok: boolean;
  detail: string;
  fix?: string;
}

interface EmployeeRow {
  employeeId: string;
  name: string;
  status: string;
  seatLocked: boolean;
  cardId: string | null;
  publishingState: string;
  cardSlug: string | null;
  publicOutcome: string;
}

interface Customer {
  companyId: string;
  companyName: string;
  isPilot: boolean;
  pilotStage: string | null;
  companyStatus: string;
  publishingState: string;
  websiteSlug: string | null;
  websitePath: string | null;
  websiteOutcome: string;
  employees: EmployeeRow[];
  checks: Check[];
  demoReady: boolean;
  errors: string[];
}

interface ReadinessReport {
  generatedAt: string;
  pilotsOnly: boolean;
  customers: Customer[];
  summary: { total: number; demoReady: number };
}

const LABELS: Record<string, string> = {
  account: 'Account',
  company: 'Company',
  branding: 'Branding',
  website: 'Website',
  employee: 'Employee',
  employeeCard: 'Employee Card',
  published: 'Published',
  publicUrl: 'Public URL',
  qr: 'QR',
};

// Directive 27: canonical path URLs on the designated public origin.
const baseUrl = () => canonicalOrigin().replace(/\/+$/, '');

const QrImage: React.FC<{ url: string }> = ({ url }) => {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    QRCode.toDataURL(url, { margin: 1, width: 120 }).then(setSrc).catch(() => setSrc(null));
  }, [url]);
  return src ? <img src={src} alt={`QR code for ${url}`} className="w-24 h-24 rounded-lg border border-slate-200" /> : null;
};

export const SaaSDemoReadinessTab: React.FC = () => {
  const [pilotsOnly, setPilotsOnly] = useState(true);
  const [report, setReport] = useState<ReadinessReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setReport(await callBackend<ReadinessReport>('adminGetDemoReadiness', { pilotsOnly }));
    } catch (err) {
      setError(describeBackendError(err));
    } finally {
      setLoading(false);
    }
  }, [pilotsOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-5" data-testid="demo-readiness">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Demo Readiness</h2>
          <p className="text-xs text-slate-500">
            Live check of each customer's account, content and public pages, as an anonymous visitor would see them.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-slate-700">
            <input type="checkbox" checked={pilotsOnly} onChange={(e) => setPilotsOnly(e.target.checked)} />
            Pilot customers only
          </label>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold disabled:opacity-60"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
            Re-check
          </button>
        </div>
      </div>

      {error && <p className="text-xs text-rose-700">{error}</p>}
      {report && (
        <p className="text-xs text-slate-600">
          <strong>{report.summary.demoReady}</strong> of {report.summary.total} customer(s) demo ready · checked{' '}
          {new Date(report.generatedAt).toLocaleString()}
        </p>
      )}
      {report && report.customers.length === 0 && (
        <p className="text-xs text-slate-500">
          No {pilotsOnly ? 'pilot ' : ''}customers yet. Mark customers as pilots in First Customer Pilot.
        </p>
      )}

      <div className="grid gap-4">
        {report?.customers.map((c) => {
          const websiteUrl = c.websitePath ? `${baseUrl()}${c.websitePath}` : null;
          return (
            <div key={c.companyId} className="p-4 rounded-2xl border border-slate-200 bg-white" data-testid={`readiness-${c.companyId}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-slate-900">{c.companyName}</div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    {c.companyId} · {c.companyStatus} · website {c.publishingState}
                    {c.isPilot ? ` · pilot${c.pilotStage ? ` (${c.pilotStage})` : ''}` : ''}
                  </div>
                </div>
                <span
                  data-testid="demo-ready-badge"
                  className={`text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full ${
                    c.demoReady ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {c.demoReady ? 'Demo ready' : 'Not ready'}
                </span>
              </div>

              <div className="mt-3 grid sm:grid-cols-3 gap-x-4 gap-y-1.5">
                {c.checks.map((k) => (
                  <div key={k.key} className="flex items-start gap-1.5 text-xs" title={k.fix && !k.ok ? `Fix: ${k.fix}` : undefined}>
                    {k.ok ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-rose-600 mt-0.5 shrink-0" />}
                    <span>
                      <span className="font-semibold text-slate-800">{LABELS[k.key] ?? k.key}</span>{' '}
                      <span className="text-slate-500">— {k.detail}</span>
                    </span>
                  </div>
                ))}
              </div>

              {c.errors.length > 0 && (
                <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 space-y-1">
                  {c.checks
                    .filter((k) => !k.ok && k.fix)
                    .map((k) => (
                      <p key={k.key} className="text-[11px] text-amber-900 flex gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> <span><strong>{LABELS[k.key]}:</strong> {k.fix}</span>
                      </p>
                    ))}
                </div>
              )}

              <div className="mt-3 flex flex-wrap items-start gap-4">
                {websiteUrl && c.websiteOutcome === 'OK' && (
                  <div className="flex items-center gap-3">
                    <QrImage url={websiteUrl} />
                    <a href={websiteUrl} target="_blank" rel="noreferrer" className="text-xs font-mono text-teal-700 break-all hover:underline inline-flex items-center gap-1">
                      {websiteUrl} <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
                <table className="text-[11px] min-w-[18rem]">
                  <thead>
                    <tr className="text-left text-slate-500">
                      <th className="pr-3 font-semibold">Employee</th>
                      <th className="pr-3 font-semibold">Card</th>
                      <th className="font-semibold">Public</th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.employees.map((e) => (
                      <tr key={e.employeeId}>
                        <td className="pr-3 py-0.5">
                          {e.name}
                          {e.seatLocked ? ' (seat locked)' : ''}
                          {e.status !== 'active' ? ` (${e.status})` : ''}
                        </td>
                        <td className="pr-3">{e.publishingState}</td>
                        <td>
                          {e.publicOutcome === 'OK' && e.cardSlug ? (
                            <a href={publicEntityUrl('card', e.cardSlug, canonicalOrigin())} target="_blank" rel="noreferrer" className="text-teal-700 hover:underline">
                              /card/{e.cardSlug}
                            </a>
                          ) : (
                            <span className="text-slate-500">{e.publicOutcome}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {c.employees.length === 0 && (
                      <tr>
                        <td colSpan={3} className="text-slate-500">No employees</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
