import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Event,
  EventMember,
  Campaign,
  Lead,
  EventAnalyticsSummary,
  Employee,
} from '../../types';
import {
  getEventMembers,
  addEventMember,
  removeEventMember,
  getCampaignsForCompany,
  getEventAnalytics,
} from '../../services/eventService';
import { getLeadsForCompany } from '../../services/leadService';
import { getEmployeesByCompany } from '../../services/employeeService';
import {
  Calendar,
  X,
  Building2,
  Users2,
  Layers,
  Target,
  BarChart3,
  MapPin,
  Clock,
  CheckCircle2,
  Plus,
  UserPlus,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  event: Event;
  onOpenAddCampaign: (eventId: string) => void;
  onOpenLeadDetail: (lead: Lead) => void;
  onOpenQuickLeadModal: (eventId: string) => void;
}

export const EventDetailModal: React.FC<Props> = ({
  isOpen,
  onClose,
  event,
  onOpenAddCampaign,
  onOpenLeadDetail,
  onOpenQuickLeadModal,
}) => {
  const { userProfile, activeCompany } = useAuth();
  const currentUserId = userProfile?.id || 'user_demo';
  const companyId = activeCompany?.id || 'company_acme';

  const [activeTab, setActiveTab] = useState<'analytics' | 'campaigns' | 'team' | 'leads'>('analytics');
  const [members, setMembers] = useState<EventMember[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [analytics, setAnalytics] = useState<EventAnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  // Add member form
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [addingMember, setAddingMember] = useState(false);

  useEffect(() => {
    if (isOpen && event.id) {
      loadEventDetails();
    }
  }, [isOpen, event.id]);

  const loadEventDetails = async () => {
    setLoading(true);
    try {
      const [fetchedMembers, fetchedEmployees, fetchedCampaigns, fetchedLeads, fetchedAnalytics] =
        await Promise.all([
          getEventMembers(event.id),
          getEmployeesByCompany(companyId),
          getCampaignsForCompany(companyId, event.id),
          getLeadsForCompany(companyId, { eventId: event.id }),
          getEventAnalytics(companyId, event.id),
        ]);

      setMembers(fetchedMembers);
      setEmployees(fetchedEmployees);
      setCampaigns(fetchedCampaigns);
      setLeads(fetchedLeads);
      setAnalytics(fetchedAnalytics);
    } catch (err) {
      console.error('Error loading event detail:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleAddMember = async () => {
    if (!selectedEmpId || addingMember) return;
    setAddingMember(true);
    try {
      const emp = employees.find((e) => e.id === selectedEmpId);
      if (!emp) return;

      const newMember = await addEventMember(
        event.id,
        companyId,
        emp.id,
        emp.id,
        emp.displayName,
        'member'
      );
      setMembers([...members, newMember]);
      setSelectedEmpId('');
    } catch (err) {
      console.error('Error adding event member:', err);
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      await removeEventMember(memberId);
      setMembers(members.filter((m) => m.id !== memberId));
    } catch (err) {
      console.error('Error removing event member:', err);
    }
  };

  const isCompanyAdmin = userProfile?.role === 'company_admin' || userProfile?.role === 'app_owner';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-5 bg-slate-900 text-white flex items-start justify-between">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-teal-500/20 text-teal-300 flex items-center justify-center font-bold text-lg border border-teal-500/30">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-white tracking-tight">{event.name}</h3>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    event.status === 'active'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : event.status === 'completed'
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  {event.status}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-300">
                  {event.eventType}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5 flex items-center space-x-3">
                {event.location && (
                  <span className="flex items-center">
                    <MapPin className="w-3 h-3 mr-1 text-teal-400" /> {event.location}
                  </span>
                )}
                <span>
                  {event.startAt} to {event.endAt}
                </span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation & Action Bar */}
        <div className="px-6 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between text-xs font-semibold">
          <div className="flex items-center space-x-6">
            <button
              onClick={() => setActiveTab('analytics')}
              className={`py-3 border-b-2 transition flex items-center space-x-1.5 ${
                activeTab === 'analytics'
                  ? 'border-teal-600 text-teal-800'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Event Analytics</span>
            </button>
            <button
              onClick={() => setActiveTab('campaigns')}
              className={`py-3 border-b-2 transition flex items-center space-x-1.5 ${
                activeTab === 'campaigns'
                  ? 'border-teal-600 text-teal-800'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Campaigns ({campaigns.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('team')}
              className={`py-3 border-b-2 transition flex items-center space-x-1.5 ${
                activeTab === 'team'
                  ? 'border-teal-600 text-teal-800'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Users2 className="w-3.5 h-3.5" />
              <span>Attending Team ({members.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('leads')}
              className={`py-3 border-b-2 transition flex items-center space-x-1.5 ${
                activeTab === 'leads'
                  ? 'border-teal-600 text-teal-800'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Target className="w-3.5 h-3.5" />
              <span>Captured Leads ({leads.length})</span>
            </button>
          </div>

          <div className="py-2 flex items-center space-x-2">
            <button
              onClick={() => onOpenQuickLeadModal(event.id)}
              className="px-3 py-1.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-semibold flex items-center text-xs shadow-2xs transition"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Quick Lead
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto flex-1 text-xs">
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              {/* Key Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Interactions
                  </span>
                  <div className="text-xl font-bold text-slate-900">
                    {analytics?.interactionsCount || 0}
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Card views & touchpoints
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-teal-50/70 border border-teal-200/80">
                  <span className="text-[10px] font-bold text-teal-600 uppercase tracking-wider block mb-1">
                    Leads Captured
                  </span>
                  <div className="text-xl font-bold text-teal-900">
                    {analytics?.leadsCount || 0}
                  </div>
                  <span className="text-[10px] text-teal-700 mt-1 block">
                    Company-owned records
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/80">
                  <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block mb-1">
                    Qualified Leads
                  </span>
                  <div className="text-xl font-bold text-emerald-900">
                    {analytics?.qualifiedLeadsCount || 0}
                  </div>
                  <span className="text-[10px] text-emerald-700 mt-1 block">
                    {analytics && analytics.leadsCount > 0
                      ? `${Math.round((analytics.qualifiedLeadsCount / analytics.leadsCount) * 100)}% qualification rate`
                      : '0% rate'}
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Follow-ups
                  </span>
                  <div className="text-xl font-bold text-slate-900">
                    {analytics?.followUpsCount || 0}
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    {analytics?.followUpsCompletedCount || 0} completed
                  </span>
                </div>
              </div>

              {/* Event Description Card */}
              {event.description && (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
                  <h4 className="font-bold text-slate-900 mb-1">Event Objectives & Notes</h4>
                  <p className="text-slate-600 leading-relaxed">{event.description}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'campaigns' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  QR channels and acquisition sources under this event.
                </span>
                {isCompanyAdmin && (
                  <button
                    onClick={() => onOpenAddCampaign(event.id)}
                    className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold flex items-center text-xs transition"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Campaign
                  </button>
                )}
              </div>

              {campaigns.length === 0 ? (
                <div className="text-center py-10 text-slate-400 italic bg-slate-50 rounded-2xl border border-slate-200/60">
                  No campaigns configured for this event yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {campaigns.map((camp) => (
                    <div
                      key={camp.id}
                      className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs hover:border-teal-500/40 transition space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 text-xs">{camp.name}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            camp.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {camp.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">{camp.description || camp.campaignType}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'team' && (
            <div className="space-y-4">
              {/* Add Member Bar */}
              {isCompanyAdmin && (
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between gap-3">
                  <div className="flex items-center space-x-2 flex-1">
                    <UserPlus className="w-4 h-4 text-slate-400" />
                    <select
                      value={selectedEmpId}
                      onChange={(e) => setSelectedEmpId(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-semibold"
                    >
                      <option value="">Select Employee to Enroll...</option>
                      {employees
                        .filter((emp) => !members.some((m) => m.employeeId === emp.id))
                        .map((emp) => (
                          <option key={emp.id} value={emp.id}>
                            {emp.displayName} ({emp.designation || 'Employee'})
                          </option>
                        ))}
                    </select>
                  </div>
                  <button
                    disabled={!selectedEmpId || addingMember}
                    onClick={handleAddMember}
                    className="px-3 py-1.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-semibold text-xs disabled:opacity-40 transition"
                  >
                    Enroll Member
                  </button>
                </div>
              )}

              {/* Members List */}
              {members.length === 0 ? (
                <div className="text-center py-10 text-slate-400 italic bg-slate-50 rounded-2xl border border-slate-200/60">
                  No registered participating employees yet.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white">
                  {members.map((m) => (
                    <div
                      key={m.id}
                      className="p-3.5 flex items-center justify-between hover:bg-slate-50/50 transition"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs">
                          {m.employeeName.charAt(0)}
                        </div>
                        <div>
                          <span className="font-bold text-slate-900 text-xs block">
                            {m.employeeName}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Joined {new Date(m.joinedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      {isCompanyAdmin && (
                        <button
                          onClick={() => handleRemoveMember(m.id)}
                          className="text-[11px] text-rose-600 hover:underline font-semibold"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'leads' && (
            <div className="space-y-3">
              {leads.length === 0 ? (
                <div className="text-center py-10 text-slate-400 italic bg-slate-50 rounded-2xl border border-slate-200/60">
                  No leads captured at this event yet.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white">
                  {leads.map((lead) => (
                    <div
                      key={lead.id}
                      onClick={() => onOpenLeadDetail(lead)}
                      className="p-3.5 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition"
                    >
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-slate-900 text-xs">{lead.name}</span>
                          <span
                            className={`px-2 py-0.2 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                              lead.qualificationStatus === 'qualified'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {lead.qualificationStatus}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {lead.jobTitle || 'Lead'} • {lead.companyName || 'Organization'}
                        </p>
                      </div>

                      <div className="flex items-center space-x-2 text-[11px] text-slate-500">
                        <span>{lead.ownerName || 'Staff'}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                      </div>
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
