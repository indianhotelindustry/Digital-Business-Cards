import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Event,
  Campaign,
  LeadQualificationStatus,
  LeadPriority,
  LeadSourceType,
} from '../../types';
import { createLead } from '../../services/leadService';
import { getEventsForCompany, getCampaignsForCompany } from '../../services/eventService';
import {
  Target,
  X,
  UserPlus,
  Building2,
  Phone,
  Mail,
  Calendar,
  Layers,
  Sparkles,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  defaultEventId?: string;
  defaultCampaignId?: string;
  onSuccess?: () => void;
}

export const AddLeadModal: React.FC<Props> = ({
  isOpen,
  onClose,
  defaultEventId,
  defaultCampaignId,
  onSuccess,
}) => {
  const { userProfile, activeCompany } = useAuth();
  const currentUserId = userProfile?.id || 'user_demo';
  const currentUserName = userProfile?.displayName || 'User';
  const currentEmployeeId = userProfile?.employeeId || 'emp_demo';
  const companyId = activeCompany?.id || 'company_acme';

  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedEventId, setSelectedEventId] = useState(defaultEventId || '');
  const [selectedCampaignId, setSelectedCampaignId] = useState(defaultCampaignId || '');
  const [sourceType, setSourceType] = useState<LeadSourceType>('MANUAL');
  const [qualificationStatus, setQualificationStatus] = useState<LeadQualificationStatus>('qualifying');
  const [priority, setPriority] = useState<LeadPriority>('medium');
  const [qualificationNotes, setQualificationNotes] = useState('');

  const [events, setEvents] = useState<Event[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && companyId) {
      loadEventsAndCampaigns();
    }
  }, [isOpen, companyId]);

  useEffect(() => {
    if (defaultEventId) {
      setSelectedEventId(defaultEventId);
      setSourceType('EVENT');
    }
    if (defaultCampaignId) {
      setSelectedCampaignId(defaultCampaignId);
      setSourceType('CAMPAIGN');
    }
  }, [defaultEventId, defaultCampaignId]);

  const loadEventsAndCampaigns = async () => {
    try {
      const [evts, camps] = await Promise.all([
        getEventsForCompany(companyId),
        getCampaignsForCompany(companyId),
      ]);
      setEvents(evts.filter((e) => e.status !== 'archived'));
      setCampaigns(camps.filter((c) => c.status !== 'archived'));
    } catch (err) {
      console.error('Error loading events/campaigns:', err);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Lead name is required.');
      return;
    }
    setSaving(true);
    setError(null);

    try {
      await createLead(
        {
          companyId,
          ownerEmployeeId: currentEmployeeId,
          ownerUserId: currentUserId,
          ownerName: currentUserName,
          name: name.trim(),
          companyName: companyName.trim() || undefined,
          jobTitle: jobTitle.trim() || undefined,
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          eventId: selectedEventId || null,
          campaignId: selectedCampaignId || null,
          sourceType: selectedEventId ? 'EVENT' : selectedCampaignId ? 'CAMPAIGN' : sourceType,
          sourceReference: selectedEventId
            ? `Event: ${events.find((e) => e.id === selectedEventId)?.name || selectedEventId}`
            : selectedCampaignId
            ? `Campaign: ${campaigns.find((c) => c.id === selectedCampaignId)?.name || selectedCampaignId}`
            : 'Manual In-person Entry',
          qualificationStatus,
          leadStatus: qualificationStatus === 'qualified' ? 'qualified' : 'qualifying',
          priority,
          qualificationNotes: qualificationNotes.trim() || undefined,
        },
        currentUserId,
        currentUserName
      );

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error creating lead:', err);
      setError(err.message || 'Failed to save lead.');
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
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Quick Lead Capture
              </h3>
              <p className="text-xs text-slate-300">
                Log a direct business lead for {activeCompany?.name || 'Company'}
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
              {error}
            </div>
          )}

          {/* Name & Company */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. John Doe"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Company / Organization
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Global Tech Ltd"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 outline-none"
              />
            </div>
          </div>

          {/* Title, Email, Phone */}
          <div className="space-y-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Job Title</label>
              <input
                type="text"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="e.g. VP of Procurement"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Event & Campaign Attribution */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Event Attribution</label>
              <select
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs"
              >
                <option value="">No Event</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Campaign Channel</label>
              <select
                value={selectedCampaignId}
                onChange={(e) => setSelectedCampaignId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs"
              >
                <option value="">No Campaign</option>
                {campaigns.map((camp) => (
                  <option key={camp.id} value={camp.id}>
                    {camp.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Qualification & Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Qualification
              </label>
              <select
                value={qualificationStatus}
                onChange={(e) => setQualificationStatus(e.target.value as LeadQualificationStatus)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold"
              >
                <option value="unqualified">Unqualified</option>
                <option value="qualifying">Qualifying</option>
                <option value="qualified">Qualified</option>
                <option value="disqualified">Disqualified</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as LeadPriority)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Lead Notes</label>
            <textarea
              rows={2}
              value={qualificationNotes}
              onChange={(e) => setQualificationNotes(e.target.value)}
              placeholder="Requirement, discussion summary..."
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs resize-none"
            />
          </div>

          {/* Buttons */}
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
              className="px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-semibold shadow-xs disabled:opacity-50 transition"
            >
              {saving ? 'Saving...' : 'Save Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
