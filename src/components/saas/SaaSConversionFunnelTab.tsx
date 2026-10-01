// ============================================================================
// DSBC SAAS CONVERSION FUNNEL TAB (Directive 21 Section 13)
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Users2,
  UserCheck,
  Sparkles,
  Eye,
  CheckCircle2,
  CreditCard,
  ArrowDown,
  RefreshCw,
  Activity,
  Layers,
} from 'lucide-react';
import { conversionFunnelService, FunnelStageMetric, FunnelEventRecord } from '../../services/conversionFunnelService';

export const SaaSConversionFunnelTab: React.FC = () => {
  const [metrics, setMetrics] = useState(conversionFunnelService.getFunnelMetrics());

  const handleRefresh = () => {
    setMetrics(conversionFunnelService.getFunnelMetrics());
  };

  useEffect(() => {
    const unsub = conversionFunnelService.subscribe(() => {
      setMetrics(conversionFunnelService.getFunnelMetrics());
    });
    return unsub;
  }, []);

  const getStageIcon = (stage: string) => {
    switch (stage) {
      case 'LANDING_VIEWED':
        return <Eye className="w-4 h-4 text-slate-600" />;
      case 'REGISTRATION_STARTED':
      case 'REGISTRATION_COMPLETED':
        return <Users2 className="w-4 h-4 text-teal-600" />;
      case 'ONBOARDING_STARTED':
      case 'PROFILE_COMPLETED':
        return <UserCheck className="w-4 h-4 text-blue-600" />;
      case 'PREVIEW_VIEWED':
        return <Sparkles className="w-4 h-4 text-purple-600" />;
      case 'PUBLISHED':
        return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
      case 'UPGRADE_STARTED':
      case 'PAYMENT_COMPLETED':
        return <CreditCard className="w-4 h-4 text-amber-600" />;
      default:
        return <Activity className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Metric Header */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-1.5 rounded-lg bg-teal-50 text-teal-700 border border-teal-200">
              <TrendingUp className="w-4 h-4" />
            </span>
            <h2 className="text-base font-bold text-slate-900">
              Product Onboarding & Commercial Conversion Funnel
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Privacy-preserving aggregate metrics: Visitor → Register → Onboard → Publish → Monetize. No unnecessary PII collection.
          </p>
        </div>

        <button
          onClick={handleRefresh}
          className="inline-flex items-center px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition self-start md:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1.5 text-teal-600" />
          Refresh Funnel
        </button>
      </div>

      {/* Aggregate Funnel Visualization */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {metrics.stages.map((stage, idx) => {
          const isFirst = idx === 0;
          return (
            <div
              key={stage.stage}
              className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs relative flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                      {getStageIcon(stage.stage)}
                    </div>
                    <span className="text-xs font-bold text-slate-900">{stage.label}</span>
                  </div>
                  <span className="text-lg font-black text-slate-900 font-mono">
                    {stage.count.toLocaleString()}
                  </span>
                </div>

                {/* Conversion Bar */}
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mb-2">
                  <div
                    className="bg-teal-700 h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, Math.max(5, (stage.count / (metrics.stages[0]?.count || 1)) * 100))}%`,
                    }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-100 text-slate-500">
                <span>
                  {isFirst ? (
                    <strong className="text-slate-700">Top of Funnel</strong>
                  ) : (
                    <>
                      Step Conv:{' '}
                      <strong className="text-teal-700 font-mono font-bold">
                        {stage.conversionRate}%
                      </strong>
                    </>
                  )}
                </span>
                {!isFirst && (
                  <span className="text-slate-400">
                    Dropoff: {stage.dropoffRate}%
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent Aggregate Product Events */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center space-x-2">
          <Activity className="w-4 h-4 text-teal-600" />
          <span>Real-Time Product Telemetry (Recent Aggregate Events)</span>
        </h3>

        <div className="divide-y divide-slate-100 overflow-x-auto">
          {metrics.recentEvents.slice(0, 8).map((evt) => (
            <div key={evt.id} className="py-2.5 flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2.5">
                <span className="w-2 h-2 rounded-full bg-teal-500"></span>
                <span className="font-semibold text-slate-800 font-mono">
                  {evt.eventType.replace('_', ' ')}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">
                  {evt.customerType || 'visitor'}
                </span>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                {new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
