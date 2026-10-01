import React, { useState } from 'react';
import { EntitlementAuditLog } from '../../types/entitlement';
import {
  Clock,
  Shield,
  Search,
  Filter,
  User,
  Building2,
  Layers,
  Globe,
  ArrowRight,
} from 'lucide-react';

interface SaaSAuditTrailTabProps {
  auditLogs: EntitlementAuditLog[];
}

export const SaaSAuditTrailTab: React.FC<SaaSAuditTrailTabProps> = ({ auditLogs }) => {
  const [search, setSearch] = useState('');
  const [targetFilter, setTargetFilter] = useState<string>('all');

  const filteredLogs = auditLogs.filter((log) => {
    const matchSearch =
      log.targetName.toLowerCase().includes(search.toLowerCase()) ||
      (log.featureName && log.featureName.toLowerCase().includes(search.toLowerCase())) ||
      log.reason.toLowerCase().includes(search.toLowerCase()) ||
      log.actorName.toLowerCase().includes(search.toLowerCase());

    const matchType = targetFilter === 'all' || log.targetType === targetFilter;

    return matchSearch && matchType;
  });

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Entitlement & Policy Audit Trail</h2>
          <p className="text-xs text-slate-500">
            Immutable log of every plan modification, override grant, exception removal, and actor justification.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search audit trail..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
            />
          </div>

          <select
            value={targetFilter}
            onChange={(e) => setTargetFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 font-medium"
          >
            <option value="all">All Targets ({auditLogs.length})</option>
            <option value="company">Company Targets</option>
            <option value="individual">Individual Targets</option>
            <option value="plan">Plan Modifications</option>
            <option value="global">Global Policies</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-500 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Target Entity</th>
                <th className="py-3 px-4">Feature / Setting</th>
                <th className="py-3 px-4">Entitlement Mutation</th>
                <th className="py-3 px-4">Reason / Business Case</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/70 transition">
                  <td className="py-3 px-4 font-mono text-slate-500 text-[11px] whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>

                  <td className="py-3 px-4 font-semibold text-slate-800">
                    {log.actorName}
                  </td>

                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-1.5">
                      <span className="font-bold text-slate-900">{log.targetName}</span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-mono">
                        {log.targetType}
                      </span>
                    </div>
                  </td>

                  <td className="py-3 px-4 text-slate-700 font-medium">
                    {log.featureName || log.featureId || 'Platform Setting'}
                  </td>

                  <td className="py-3 px-4 max-w-xs">
                    <div className="flex items-center space-x-1.5 truncate">
                      <span className="text-slate-500 truncate font-mono text-[11px]">
                        {log.previousValue.length > 25 ? `${log.previousValue.slice(0, 25)}...` : log.previousValue}
                      </span>
                      <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="text-teal-700 font-bold truncate font-mono text-[11px]">
                        {log.newValue.length > 25 ? `${log.newValue.slice(0, 25)}...` : log.newValue}
                      </span>
                    </div>
                  </td>

                  <td className="py-3 px-4 text-slate-600 italic max-w-xs">
                    "{log.reason}"
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
