import React from 'react';
import { Lock, Sparkles, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { EntitlementStatus, LimitUnit } from '../../types/entitlement';

interface EntitlementBadgeProps {
  status: EntitlementStatus;
  limit?: number;
  limitUnit?: LimitUnit;
  used?: number;
  remaining?: number;
  isExpired?: boolean;
  className?: string;
  onClick?: () => void;
}

export const EntitlementBadge: React.FC<EntitlementBadgeProps> = ({
  status,
  limit,
  limitUnit,
  used,
  remaining,
  isExpired,
  className = '',
  onClick,
}) => {
  if (isExpired) {
    return (
      <span
        onClick={onClick}
        className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 cursor-pointer ${className}`}
        title="Entitlement has expired"
      >
        <Clock className="w-3 h-3 mr-1" /> Expired
      </span>
    );
  }

  switch (status) {
    case 'ENABLED':
      return (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 ${className}`}
        >
          <CheckCircle className="w-3 h-3 mr-1" /> Enabled
        </span>
      );

    case 'UNLIMITED':
      return (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 ${className}`}
        >
          <Sparkles className="w-3 h-3 mr-1 text-indigo-500" /> Unlimited
        </span>
      );

    case 'LIMITED':
      const isExhausted = remaining !== undefined && remaining <= 0;
      return (
        <span
          onClick={onClick}
          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold ${
            isExhausted
              ? 'bg-amber-50 text-amber-700 border border-amber-200 cursor-pointer'
              : 'bg-blue-50 text-blue-700 border border-blue-200'
          } ${className}`}
          title={limit !== undefined ? `Limit: ${limit} ${limitUnit || ''}` : 'Limited'}
        >
          {isExhausted ? (
            <>
              <AlertCircle className="w-3 h-3 mr-1 text-amber-600" />
              Limit Reached ({limit})
            </>
          ) : (
            <>
              Quota: {used !== undefined ? `${used}/` : ''}
              {limit} {limitUnit ? limitUnit.toLowerCase().replace('_', ' ') : ''}
            </>
          )}
        </span>
      );

    case 'DISABLED':
    default:
      return (
        <span
          onClick={onClick}
          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200 ${
            onClick ? 'cursor-pointer hover:bg-slate-200' : ''
          } ${className}`}
        >
          <Lock className="w-3 h-3 mr-1 text-slate-400" /> Locked
        </span>
      );
  }
};
