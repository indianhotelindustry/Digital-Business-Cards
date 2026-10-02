import React, { useState } from 'react';
import {
  EntitlementOverride,
  EntitlementStatus,
  LimitUnit,
  OverrideGrantType,
} from '../../types/entitlement';
import { FEATURE_CATALOGUE, FEATURE_MAP, entitlementService } from '../../services/entitlementService';
import { runBackendAction } from '../../lib/backend';
import { X, Save, Sparkles, Shield, Clock } from 'lucide-react';

interface OverrideModalProps {
  override?: EntitlementOverride | null;
  defaultTargetType?: 'individual' | 'company';
  defaultTargetId?: string;
  defaultTargetName?: string;
  defaultFeatureId?: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  actorInfo?: { id: string; name: string };
}

export const OverrideModal: React.FC<OverrideModalProps> = ({
  override,
  defaultTargetType = 'company',
  defaultTargetId = '',
  defaultTargetName = '',
  defaultFeatureId = 'company.ai_assistance',
  isOpen,
  onClose,
  onSave,
  actorInfo,
}) => {
  if (!isOpen) return null;

  const isEditing = !!override;

  const [targetType, setTargetType] = useState<'individual' | 'company'>(
    override?.targetType || defaultTargetType
  );
  const [targetId, setTargetId] = useState(override?.targetId || defaultTargetId);
  const [targetName, setTargetName] = useState(override?.targetName || defaultTargetName);
  const [featureId, setFeatureId] = useState(override?.featureId || defaultFeatureId);
  const [status, setStatus] = useState<EntitlementStatus>(
    override?.rule.status || 'ENABLED'
  );
  const [limit, setLimit] = useState<number>(override?.rule.limit ?? 5);
  const [limitUnit, setLimitUnit] = useState<LimitUnit>(
    override?.rule.limitUnit || 'COUNT'
  );
  const [grantType, setGrantType] = useState<OverrideGrantType>(
    override?.grantType || 'permanent'
  );
  const [expiresAt, setExpiresAt] = useState<string>(
    override?.expiresAt ? override.expiresAt.split('T')[0] : ''
  );
  const [reason, setReason] = useState<string>(
    override?.reason || 'Strategic customer satisfaction exception'
  );

  const targetFeature = FEATURE_MAP.get(featureId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetId.trim() || !featureId) return;

    let finalExpiresAt: string | null = null;
    if (grantType === 'until_date' && expiresAt) {
      finalExpiresAt = new Date(`${expiresAt}T23:59:59.000Z`).toISOString();
    } else if (grantType === 'trial') {
      const d = new Date();
      d.setDate(d.getDate() + 14);
      finalExpiresAt = d.toISOString();
    }

    const saved = await runBackendAction(() => entitlementService.saveOverride(
      {
        id: override?.id,
        targetType,
        targetId: targetId.trim(),
        targetName: targetName.trim() || targetId.trim(),
        featureId,
        rule: {
          status,
          limit: status === 'LIMITED' ? Number(limit) : undefined,
          limitUnit: status === 'LIMITED' ? limitUnit : undefined,
        },
        grantType,
        validFrom: override?.validFrom || new Date().toISOString(),
        expiresAt: finalExpiresAt,
        reason: reason.trim(),
        createdBy: actorInfo?.id || 'app_owner',
      },
      actorInfo
    ));
    if (!saved) return;

    onSave();
    onClose();
  };

  const relevantFeatures = FEATURE_CATALOGUE.filter(
    (f) => f.scope === 'both' || f.scope === targetType
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 relative max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              {isEditing ? 'Modify Entitlement Override' : 'Grant Entitlement Override'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Specific exception rule taking highest priority above plan policy.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto py-4 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Target Entity Type
              </label>
              <select
                value={targetType}
                onChange={(e) => setTargetType(e.target.value as 'individual' | 'company')}
                disabled={isEditing}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 disabled:bg-slate-100"
              >
                <option value="company">Company</option>
                <option value="individual">Individual User / Employee</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Target Entity ID
              </label>
              <input
                type="text"
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                placeholder="e.g. company_acme or emp_123"
                required
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Display Name (For Audit & Logs)
              </label>
              <input
                type="text"
                value={targetName}
                onChange={(e) => setTargetName(e.target.value)}
                placeholder="e.g. Acme Global Corp or John Doe"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Select Feature to Override
              </label>
              <select
                value={featureId}
                onChange={(e) => {
                  setFeatureId(e.target.value);
                  const f = FEATURE_MAP.get(e.target.value);
                  if (f?.limitUnit) setLimitUnit(f.limitUnit);
                }}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500"
              >
                {relevantFeatures.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.id})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Override Entitlement State
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as EntitlementStatus)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500"
              >
                <option value="ENABLED">ENABLED</option>
                <option value="DISABLED">DISABLED</option>
                <option value="LIMITED">LIMITED</option>
                <option value="UNLIMITED">UNLIMITED</option>
              </select>
            </div>

            {status === 'LIMITED' && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Quota Limit
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={limit}
                    onChange={(e) => setLimit(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Unit
                  </label>
                  <select
                    value={limitUnit}
                    onChange={(e) => setLimitUnit(e.target.value as LimitUnit)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="COUNT">COUNT</option>
                    <option value="EMPLOYEES">EMPLOYEES</option>
                    <option value="STORAGE_MB">STORAGE (MB)</option>
                    <option value="REQUESTS">REQUESTS</option>
                    <option value="AI_USAGE">AI TOKENS</option>
                  </select>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Grant / Access Type
              </label>
              <select
                value={grantType}
                onChange={(e) => setGrantType(e.target.value as OverrideGrantType)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500"
              >
                <option value="permanent">Permanent Exception</option>
                <option value="until_date">Until Specific Date</option>
                <option value="trial">14-Day Free Trial</option>
                <option value="complimentary">Complimentary VIP Pass</option>
              </select>
            </div>

            {grantType === 'until_date' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Expiry Date
                </label>
                <input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500"
                />
              </div>
            )}

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Audit Reason & Business Justification
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                placeholder="e.g. Complimentary onboarding pass for VIP client"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-xs transition flex items-center space-x-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isEditing ? 'Update Override' : 'Apply Override'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
