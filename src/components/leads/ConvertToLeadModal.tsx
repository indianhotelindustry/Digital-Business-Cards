import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Connection,
  Event,
  Campaign,
  LeadQualificationStatus,
  LeadPriority,
} from '../../types';
import { convertConnectionToLead } from '../../services/leadService';
import { getEventsForCompany, getCampaignsForCompany } from '../../services/eventService';
import {
  Building2,
  ShieldCheck,
  Sparkles,
  X,
  Target,
  UserCheck,
  Calendar,
  Layers,
  AlertCircle,
  CheckCircle2,
  Lock,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  connection: Connection;
  onSuccess?: () => void;
}

export const ConvertToLeadModal: React.FC<Props> = ({
  isOpen,
  onClose,
  connection,
  onSuccess,
}) => {
  const { userProfile, activeCompany } = useAuth();
  const currentUserId = userProfile?.id || 'user_demo';
  const currentUserName = userProfile?.displayName || 'User';
  const currentEmployeeId = userProfile?.employeeId || 'emp_demo';
  const companyId = activeCompany?.id || 'company_acme';
  const companyName = activeCompany?.name || 'Company';

  const [events, setEvents] = useState<Event[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
  const [qualificationStatus, setQualificationStatus] = useState<LeadQualificationStatus>('qualifying');
  const [priority, setPriority] = useState<LeadPriority>('medium');
  const [qualificationNotes, setQualificationNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && companyId) {
      loadEventsAndCampaigns();
    }
  }, [isOpen, companyId]);

  const loadEventsAndCampaigns = async () => {
    try {
      const [fetchedEvents, fetchedCampaigns] = await Promise.all([
        getEventsForCompany(companyId),
        getCampaignsForCompany(companyId),
      ]);
      setEvents(fetchedEvents.filter((e) => e.status !== 'archived'));
      setCampaigns(fetchedCampaigns.filter((c) => c.status !== 'archived'));
    } catch (err) {
      console.error('Error loading events/campaigns for conversion:', err);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      await convertConnectionToLead(
        connection,
        {
          companyId,
          ownerEmployeeId: currentEmployeeId,
          ownerUserId: currentUserId,
          ownerName: currentUserName,
          eventId: selectedEventId || null,
          campaignId: selectedCampaignId || null,
          qualificationStatus,
          priority,
          qualificationNotes: qualificationNotes.trim() || undefined,
          sharedName: connection.requesterName || 'Contact',
          sharedCompany: connection.requesterCompany,
          sharedTitle: connection.requesterTitle,
          sharedEmail: connection.requesterEmail,
          sharedPhone: connection.requesterPhone,
        },
        currentUserId,
        currentUserName
      );

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error converting connection to lead:', err);
      setError(err.message || 'Failed to create company lead.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/20 text-teal-400 flex items-center justify-center border border-teal-500/30 font-bold">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Convert to Company Lead
              </h3>
              <p className="text-xs text-slate-300">
                Qualify professional connection for {companyName}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Critical Privacy Notice Banner */}
        <div className="px-6 py-3.5 bg-amber-50/90 border-b border-amber-200/80 text-amber-900 text-xs">
          <div className="flex items-start space-x-2.5">
            <Lock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Privacy & Ownership Separation</p>
              <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                This action creates a <strong>company-owned business lead</strong> for {companyName}. Your original personal Connection and private relationship notes remain <strong>strictly private</strong> and will not be copied.
              </p>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
              {error}
            </div>
          )}

          {/* Target Info Summary */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-1">
            <div className="font-semibold text-slate-900 text-sm">{connection.requesterName}</div>
            <div className="text-slate-600">
              {connection.requesterTitle || 'Professional'}
              {connection.requesterCompany ? ` • ${connection.requesterCompany}` : ''}
            </div>
            {(connection.requesterEmail || connection.requesterPhone) && (
              <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-200/60 mt-1">
                Shared: {connection.requesterEmail || ''} {connection.requesterPhone ? `| ${connection.requesterPhone}` : ''}
              </div>
            )}
          </div>

          {/* Event Association */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Event Attribution (Optional)
            </label>
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-800 text-xs focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 outline-none"
            >
              <option value="">No Event (General Sourcing)</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name} ({ev.status.toUpperCase()})
                </option>
              ))}
            </select>
          </div>

          {/* Campaign Association */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Campaign / Channel (Optional)
            </label>
            <select
              value={selectedCampaignId}
              onChange={(e) => setSelectedCampaignId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-800 text-xs focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 outline-none"
            >
              <option value="">No Campaign (Direct Card Exchange)</option>
              {campaigns.map((camp) => (
                <option key={camp.id} value={camp.id}>
                  {camp.name} ({camp.campaignType})
                </option>
              ))}
            </select>
          </div>

          {/* Qualification & Priority Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Initial Qualification
              </label>
              <select
                value={qualificationStatus}
                onChange={(e) => setQualificationStatus(e.target.value as LeadQualificationStatus)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-800 text-xs focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 outline-none font-semibold"
              >
                <option value="unqualified">Unqualified</option>
                <option value="qualifying">Qualifying</option>
                <option value="qualified">Qualified</option>
                <option value="disqualified">Disqualified</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Lead Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as LeadPriority)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-800 text-xs focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 outline-none font-semibold"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>

          {/* Qualification Notes */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Company Qualification Notes
            </label>
            <textarea
              rows={3}
              value={qualificationNotes}
              onChange={(e) => setQualificationNotes(e.target.value)}
              placeholder="e.g. Met at booth, interested in Q3 bulk enterprise packaging trial..."
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-800 text-xs focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 outline-none resize-none"
            />
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white font-semibold shadow-xs disabled:opacity-50 transition"
            >
              {saving ? 'Creating Lead...' : 'Create Company Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
