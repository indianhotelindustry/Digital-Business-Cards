import React, { useCallback, useEffect, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, CircleSlash, HelpCircle, RefreshCw, XCircle } from 'lucide-react';
import { callBackend, describeBackendError } from '../../lib/backend';
import type { PlatformHealthReport, PlatformHealthState } from '../../../shared/domain/platformHealth';

// ============================================================================
// Platform Health (Directive 27 Phase 4)
// ============================================================================
// Every row comes from adminGetPlatformHealth, which measures each dependency
// on the server at request time. The browser never invents a status, a latency
// or an uptime figure; anything the backend could not verify says so.

const STYLE: Record<PlatformHealthState, { cls: string; Icon: typeof CheckCircle2 }> = {
  OK: { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icon: CheckCircle2 },
  DEGRADED: { cls: 'bg-amber-50 text-amber-700 border-amber-200', Icon: AlertTriangle },
  FAIL: { cls: 'bg-rose-50 text-rose-700 border-rose-200', Icon: XCircle },
  DISABLED: { cls: 'bg-slate-100 text-slate-600 border-slate-200', Icon: CircleSlash },
  NOT_CONFIGURED: { cls: 'bg-amber-50 text-amber-700 border-amber-200', Icon: AlertTriangle },
  NOT_VERIFIED: { cls: 'bg-slate-50 text-slate-500 border-slate-200', Icon: HelpCircle },
};

export function PlatformHealthPanel() {
  const [report, setReport] = useState<PlatformHealthReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setReport(await callBackend<PlatformHealthReport>('adminGetPlatformHealth'));
    } catch (err) {
      setReport(null);
      setError(describeBackendError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4 animate-in fade-in" data-testid="platform-health">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-teal-600" /> Platform Health
          </h3>
          <p className="text-xs text-slate-500">
            {report
              ? `Measured by the backend at ${new Date(report.generatedAt).toLocaleString()} · ${report.environment} · ${report.projectId} / ${report.databaseId}`
              : 'Measured by the backend on request; nothing here is assumed.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Re-check
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold" data-testid="platform-health-error">
          Health could not be measured: {error}. Treat every component as unverified.
        </div>
      )}

      {report && (
        <div
          className={`p-3 rounded-2xl border text-xs font-bold ${STYLE[report.overall === 'OK' ? 'OK' : report.overall === 'FAIL' ? 'FAIL' : 'DEGRADED'].cls}`}
          data-testid="platform-health-overall"
        >
          Overall: {report.overall}
          {report.overall !== 'OK' && ' (not deployment-ready until every check is OK or intentionally disabled)'}
        </div>
      )}

      {report && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {report.checks.map((c) => {
            const { cls, Icon } = STYLE[c.state] ?? STYLE.NOT_VERIFIED;
            return (
              <div key={c.id} className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs" data-testid={`health-${c.id}`}>
                <div className="flex items-start justify-between gap-3">
                  <h4 className="text-xs font-bold text-slate-900 font-mono">{c.id}</h4>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${cls}`}>
                    <Icon className="w-3 h-3 mr-1" />
                    {c.state}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 mt-2">{c.detail}</p>
                {c.source && <p className="text-[10px] text-slate-400 mt-1">Source: {c.source}</p>}
                {c.latencyMs !== undefined && <p className="text-[10px] font-mono text-slate-400 mt-1">measured in {c.latencyMs} ms</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
