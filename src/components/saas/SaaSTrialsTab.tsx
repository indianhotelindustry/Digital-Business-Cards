import React, { useState } from 'react';
import { EntitlementOverride } from '../../types/entitlement';
import { FEATURE_MAP, entitlementService } from '../../services/entitlementService';
import {
  Clock,
  Sparkles,
  Plus,
  Trash2,
  CheckCircle,
  AlertCircle,
  Calendar,
  Shield,
} from 'lucide-react';
import { OverrideModal } from './OverrideModal';
import { EntitlementBadge } from '../entitlements/EntitlementBadge';

interface SaaSTrialsTabProps {
  overrides: EntitlementOverride[];
  onRefresh: () => void;
  actorInfo?: { id: string; name: string };
}

export const SaaSTrialsTab: React.FC<SaaSTrialsTabProps> = ({
  overrides,
  onRefresh,
  actorInfo,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [overrideToEdit, setOverrideToEdit] = useState<EntitlementOverride | null>(null);

  // Temporary & Complimentary overrides
  const tempOverrides = overrides.filter(
    (o) => o.grantType === 'trial' || o.grantType === 'until_date' || o.grantType === 'complimentary'
  );

  const now = new Date();

  const handleCreateTrial = () => {
    setOverrideToEdit(null);
    setIsModalOpen(true);
  };

  const handleEdit = (ov: EntitlementOverride) => {
    setOverrideToEdit(ov);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Revoke this temporary trial/complimentary pass immediately?')) {
      entitlementService.deleteOverride(id, actorInfo);
      onRefresh();
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Trials, Time-Bounded Passes & Complimentary Access
          </h2>
          <p className="text-xs text-slate-500">
            Issue auto-expiring trial periods and VIP complimentary feature licenses that gracefully fall back to base plan policies.
          </p>
        </div>

        <button
          onClick={handleCreateTrial}
          className="inline-flex items-center px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          <span>Issue Trial / Pass</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Active Time-Bounded Grants ({tempOverrides.length})
            </h3>
          </div>
          <span className="text-[11px] text-slate-400">Automatic fallback on expiry</span>
        </div>

        {tempOverrides.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No active temporary trials or complimentary passes currently issued.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-white text-slate-400 font-semibold uppercase text-[10px] border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">Target Entity</th>
                  <th className="py-3 px-4">Feature Granted</th>
                  <th className="py-3 px-4">Grant Type</th>
                  <th className="py-3 px-4">Valid Period & Expiration</th>
                  <th className="py-3 px-4">Business Reason</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tempOverrides.map((ov) => {
                  const def = FEATURE_MAP.get(ov.featureId);
                  const isExpired = ov.expiresAt && new Date(ov.expiresAt) < now;

                  return (
                    <tr key={ov.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900 block">{ov.targetName}</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {ov.targetType} • {ov.targetId}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-800 block">
                          {def?.name || ov.featureId}
                        </span>
                        <EntitlementBadge
                          status={ov.rule.status}
                          limit={ov.rule.limit}
                          limitUnit={ov.rule.limitUnit}
                        />
                      </td>

                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                          {ov.grantType}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        {isExpired ? (
                          <span className="text-[11px] font-bold text-rose-700 flex items-center">
                            <AlertCircle className="w-3.5 h-3.5 mr-1" /> Expired (Reverted to Plan)
                          </span>
                        ) : ov.expiresAt ? (
                          <span className="text-[11px] font-semibold text-amber-800 flex items-center">
                            <Clock className="w-3.5 h-3.5 mr-1 text-amber-600" />
                            Until {new Date(ov.expiresAt).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-slate-500 font-medium">Permanent Access</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-slate-600 italic max-w-xs">
                        "{ov.reason}"
                      </td>

                      <td className="py-3 px-4 text-right space-x-2">
                        <button
                          onClick={() => handleEdit(ov)}
                          className="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(ov.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 transition"
                          title="Revoke Pass"
                        >
                          <Trash2 className="w-3.5 h-3.5 inline" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <OverrideModal
        isOpen={isModalOpen}
        override={overrideToEdit}
        onClose={() => setIsModalOpen(false)}
        onSave={() => {
          setIsModalOpen(false);
          onRefresh();
        }}
        actorInfo={actorInfo}
      />
    </div>
  );
};
