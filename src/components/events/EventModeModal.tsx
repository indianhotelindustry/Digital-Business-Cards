import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Event, Campaign, Lead } from '../../types';
import { getEventsForCompany, getCampaignsForCompany } from '../../services/eventService';
import { getLeadsForCompany } from '../../services/leadService';
import {
  Sparkles,
  X,
  Target,
  QrCode,
  UserPlus,
  Building2,
  Calendar,
  Layers,
  ArrowRight,
  CheckCircle2,
  Lock,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onOpenQuickLead: (eventId: string, campaignId?: string) => void;
  onOpenCardShare: () => void;
}

export const EventModeModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onOpenQuickLead,
  onOpenCardShare,
}) => {
  const { userProfile, activeCompany } = useAuth();
  const companyId = activeCompany?.id || 'company_acme';

  const [events, setEvents] = useState<Event[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
  const [recentLeads, setRecentLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && companyId) {
      loadEventModeContext();
    }
  }, [isOpen, companyId]);

  const loadEventModeContext = async () => {
    setLoading(true);
    try {
      const [evts, camps] = await Promise.all([
        getEventsForCompany(companyId),
        getCampaignsForCompany(companyId),
      ]);
      const activeEvts = evts.filter((e) => e.status === 'active');
      setEvents(activeEvts);
      if (activeEvts.length > 0 && !selectedEventId) {
        setSelectedEventId(activeEvts[0].id);
      }
      setCampaigns(camps.filter((c) => c.status === 'active'));
    } catch (err) {
      console.error('Error loading event mode data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedEventId) {
      getLeadsForCompany(companyId, { eventId: selectedEventId }).then((res) => {
        setRecentLeads(res.slice(0, 5));
      });
    }
  }, [selectedEventId, companyId]);

  if (!isOpen) return null;

  const currentEvent = events.find((e) => e.id === selectedEventId);
  const currentCampaign = campaigns.find((c) => c.id === selectedCampaignId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-lg bg-slate-900 text-white rounded-3xl shadow-2xl border border-slate-700 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-5 bg-teal-950/60 border-b border-teal-800/40 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/20 text-teal-400 flex items-center justify-center border border-teal-500/30 font-bold">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-white tracking-tight">Event Mode</h3>
                <span className="px-2 py-0.2 rounded-full text-[9px] font-bold uppercase tracking-wider bg-teal-500/20 text-teal-300 border border-teal-500/30">
                  LIVE CONTEXT
                </span>
              </div>
              <p className="text-xs text-slate-400">
                High-speed networking & lead capture for {activeCompany?.name || 'Company'}
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

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs">
          {/* Active Event Selector */}
          <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-3">
            <label className="text-[11px] font-bold text-teal-400 uppercase tracking-wider block">
              Active Event Context
            </label>
            {events.length === 0 ? (
              <p className="text-slate-400 text-xs italic">
                No active company events found. You can still capture general leads.
              </p>
            ) : (
              <select
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-semibold text-xs focus:ring-2 focus:ring-teal-500/30 outline-none"
              >
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.name} ({ev.location || 'Active Event'})
                  </option>
                ))}
              </select>
            )}

            {/* Campaign Selector */}
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Booth / Campaign Channel (Optional)
              </label>
              <select
                value={selectedCampaignId}
                onChange={(e) => setSelectedCampaignId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-xs focus:ring-2 focus:ring-teal-500/30 outline-none"
              >
                <option value="">No Campaign (General Booth Interaction)</option>
                {campaigns.map((camp) => (
                  <option key={camp.id} value={camp.id}>
                    {camp.name} ({camp.campaignType})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* High-Speed Action Grid */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => {
                onClose();
                onOpenCardShare();
              }}
              className="p-4 rounded-2xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-left transition space-y-2 group shadow-sm hover:border-teal-500/50"
            >
              <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-300 flex items-center justify-center font-bold">
                <QrCode className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-white block text-xs group-hover:text-teal-300 transition">
                  Show My Card QR
                </span>
                <span className="text-[10px] text-slate-400">
                  Instant exchange with visitors
                </span>
              </div>
            </button>

            <button
              onClick={() => {
                onClose();
                onOpenQuickLead(selectedEventId, selectedCampaignId || undefined);
              }}
              className="p-4 rounded-2xl bg-teal-900/60 hover:bg-teal-900/80 border border-teal-700/80 text-left transition space-y-2 group shadow-sm hover:border-teal-400"
            >
              <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-300 flex items-center justify-center font-bold">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-white block text-xs group-hover:text-teal-200 transition">
                  Fast Lead Capture
                </span>
                <span className="text-[10px] text-teal-200/70">
                  Qualify in under 10s
                </span>
              </div>
            </button>
          </div>

          {/* Live Recent Leads Summary */}
          {selectedEventId && (
            <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-slate-400 uppercase tracking-wider">
                  Recent Event Leads
                </span>
                <span className="text-teal-400 font-semibold">{recentLeads.length} total</span>
              </div>

              {recentLeads.length === 0 ? (
                <p className="text-slate-500 italic text-[11px] py-2">
                  No leads recorded for this event yet. Tap &quot;Fast Lead Capture&quot; above to log your first interaction!
                </p>
              ) : (
                <div className="divide-y divide-slate-700/50">
                  {recentLeads.map((l) => (
                    <div key={l.id} className="py-2 flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-white block">{l.name}</span>
                        <span className="text-[10px] text-slate-400">
                          {l.jobTitle || 'Lead'} {l.companyName ? `• ${l.companyName}` : ''}
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-teal-500/20 text-teal-300 border border-teal-500/30">
                        {l.qualificationStatus}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
