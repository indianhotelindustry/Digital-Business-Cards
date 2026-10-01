import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Event,
  Campaign,
  Lead,
  LeadStatus,
  LeadPriority,
  Employee,
  Card,
} from '../../types';
import {
  getEventsForCompany,
  getCampaignsForCompany,
} from '../../services/eventService';
import { getLeadsForCompany } from '../../services/leadService';
import { getEmployeesByCompany, getEmployeeById } from '../../services/employeeService';
import { getCardById } from '../../services/cardService';
import { AddEventModal } from '../events/AddEventModal';
import { AddCampaignModal } from '../events/AddCampaignModal';
import { EventDetailModal } from '../events/EventDetailModal';
import { EventModeModal } from '../events/EventModeModal';
import { AddLeadModal } from '../leads/AddLeadModal';
import { LeadDetailModal } from '../leads/LeadDetailModal';
import { AddFollowUpModal } from '../connect/AddFollowUpModal';
import { ShareCardModal } from '../ShareCardModal';
import {
  Calendar,
  Layers,
  Target,
  BarChart3,
  Plus,
  Search,
  Filter,
  Sparkles,
  MapPin,
  Clock,
  CheckCircle2,
  Users2,
  ArrowRight,
  TrendingUp,
  Shield,
  ExternalLink,
  QrCode,
  Building2,
  Flame,
} from 'lucide-react';

interface Props {
  initialTab?: 'events' | 'campaigns' | 'leads' | 'performance';
  onNavigateToCard?: (slug: string) => void;
}

export const EventsCampaignsLeadsView: React.FC<Props> = ({
  initialTab = 'events',
  onNavigateToCard,
}) => {
  const { userProfile, activeCompany } = useAuth();
  const companyId = activeCompany?.id || 'company_acme';
  const isCompanyAdmin = userProfile?.role === 'company_admin' || userProfile?.role === 'app_owner';

  const [activeTab, setActiveTab] = useState<'events' | 'campaigns' | 'leads' | 'performance'>(
    initialTab
  );

  const [events, setEvents] = useState<Event[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [currentCard, setCurrentCard] = useState<Card | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters for Leads
  const [leadStatusFilter, setLeadStatusFilter] = useState<LeadStatus | 'all'>('all');
  const [leadPriorityFilter, setLeadPriorityFilter] = useState<LeadPriority | 'all'>('all');
  const [leadEventFilter, setLeadEventFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isAddEventOpen, setIsAddEventOpen] = useState(false);
  const [isAddCampaignOpen, setIsAddCampaignOpen] = useState(false);
  const [selectedEventForCampaign, setSelectedEventForCampaign] = useState<string | undefined>();
  const [selectedEventForDetail, setSelectedEventForDetail] = useState<Event | null>(null);
  const [isEventModeOpen, setIsEventModeOpen] = useState(false);
  const [isAddLeadOpen, setIsAddLeadOpen] = useState(false);
  const [selectedEventForLead, setSelectedEventForLead] = useState<string | undefined>();
  const [selectedCampaignForLead, setSelectedCampaignForLead] = useState<string | undefined>();
  const [selectedLeadForDetail, setSelectedLeadForDetail] = useState<Lead | null>(null);
  const [isShareCardOpen, setIsShareCardOpen] = useState(false);
  const [isAddFollowUpOpen, setIsAddFollowUpOpen] = useState(false);
  const [followUpTarget, setFollowUpTarget] = useState<{ name?: string }>({});

  useEffect(() => {
    if (companyId) {
      loadAllData();
    }
  }, [companyId]);

  useEffect(() => {
    if (userProfile?.employeeId) {
      getEmployeeById(userProfile.employeeId).then(async (emp) => {
        if (emp) {
          setCurrentEmployee(emp);
          if (emp.cardId) {
            const c = await getCardById(emp.cardId);
            setCurrentCard(c);
          }
        }
      });
    }
  }, [userProfile?.employeeId]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [fetchedEvents, fetchedCampaigns, fetchedLeads, fetchedEmployees] = await Promise.all([
        getEventsForCompany(companyId),
        getCampaignsForCompany(companyId),
        getLeadsForCompany(companyId),
        getEmployeesByCompany(companyId),
      ]);
      setEvents(fetchedEvents);
      setCampaigns(fetchedCampaigns);
      setLeads(fetchedLeads);
      setEmployees(fetchedEmployees);
    } catch (err) {
      console.error('Error loading events & leads view:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddCampaign = (eventId?: string) => {
    setSelectedEventForCampaign(eventId);
    setIsAddCampaignOpen(true);
  };

  const handleOpenQuickLead = (eventId?: string, campaignId?: string) => {
    setSelectedEventForLead(eventId);
    setSelectedCampaignForLead(campaignId);
    setIsAddLeadOpen(true);
  };

  // Filtered Leads
  const filteredLeads = leads.filter((l) => {
    if (leadStatusFilter !== 'all' && l.leadStatus !== leadStatusFilter) return false;
    if (leadPriorityFilter !== 'all' && l.priority !== leadPriorityFilter) return false;
    if (leadEventFilter !== 'all' && l.eventId !== leadEventFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        (l.name || '').toLowerCase().includes(q) ||
        (l.companyName || '').toLowerCase().includes(q) ||
        (l.jobTitle || '').toLowerCase().includes(q) ||
        (l.email || '').toLowerCase().includes(q) ||
        (l.phone || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Calculate high-level metrics
  const totalLeads = leads.length;
  const qualifiedLeads = leads.filter((l) => l.qualificationStatus === 'qualified').length;
  const activeEventsCount = events.filter((e) => e.status === 'active').length;
  const activeCampaignsCount = campaigns.filter((c) => c.status === 'active').length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/10 text-teal-700 flex items-center justify-center font-bold">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                  Events, Campaigns & Leads
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-teal-50 text-teal-700 border border-teal-200">
                  DSBC V2.1
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Measurable business outcomes from networking interactions & event attribution
              </p>
            </div>
          </div>
        </div>

        {/* Quick Launch Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsEventModeOpen(true)}
            className="px-4 py-2.5 rounded-2xl bg-teal-900 hover:bg-teal-950 text-white font-semibold text-xs flex items-center space-x-1.5 shadow-sm transition hover:scale-102 active:scale-98"
          >
            <Sparkles className="w-4 h-4 text-teal-300" />
            <span>Launch Event Mode</span>
          </button>

          <button
            onClick={() => handleOpenQuickLead()}
            className="px-4 py-2.5 rounded-2xl bg-teal-700 hover:bg-teal-800 text-white font-semibold text-xs flex items-center space-x-1.5 shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>Quick Lead Capture</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-3xl bg-white border border-slate-200/80 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
            Active Events
          </span>
          <div className="text-2xl font-bold text-slate-900">{activeEventsCount}</div>
          <span className="text-[10px] text-slate-500 mt-0.5 block">{events.length} total events</span>
        </div>

        <div className="p-4 rounded-3xl bg-white border border-slate-200/80 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
            Active Campaigns
          </span>
          <div className="text-2xl font-bold text-slate-900">{activeCampaignsCount}</div>
          <span className="text-[10px] text-slate-500 mt-0.5 block">{campaigns.length} tracking channels</span>
        </div>

        <div className="p-4 rounded-3xl bg-teal-50/70 border border-teal-200/80 shadow-2xs">
          <span className="text-[10px] font-bold text-teal-600 uppercase tracking-wider block mb-1">
            Company Leads
          </span>
          <div className="text-2xl font-bold text-teal-900">{totalLeads}</div>
          <span className="text-[10px] text-teal-700 mt-0.5 block">Captured business records</span>
        </div>

        <div className="p-4 rounded-3xl bg-emerald-50/70 border border-emerald-200/80 shadow-2xs">
          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block mb-1">
            Qualified Leads
          </span>
          <div className="text-2xl font-bold text-emerald-900">{qualifiedLeads}</div>
          <span className="text-[10px] text-emerald-700 mt-0.5 block">
            {totalLeads > 0 ? `${Math.round((qualifiedLeads / totalLeads) * 100)}% qualification rate` : '0%'}
          </span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setActiveTab('events')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition ${
              activeTab === 'events'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Events ({events.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('campaigns')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition ${
              activeTab === 'campaigns'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Campaigns ({campaigns.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('leads')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition ${
              activeTab === 'leads'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Target className="w-3.5 h-3.5" />
            <span>Leads & Pipeline ({leads.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('performance')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition ${
              activeTab === 'performance'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Team Performance</span>
          </button>
        </div>

        {/* Tab-specific creation actions */}
        <div>
          {activeTab === 'events' && isCompanyAdmin && (
            <button
              onClick={() => setIsAddEventOpen(true)}
              className="px-3.5 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-semibold flex items-center space-x-1 transition shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Event</span>
            </button>
          )}

          {activeTab === 'campaigns' && isCompanyAdmin && (
            <button
              onClick={() => handleOpenAddCampaign()}
              className="px-3.5 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-semibold flex items-center space-x-1 transition shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Campaign</span>
            </button>
          )}
        </div>
      </div>

      {/* TAB CONTENT: EVENTS */}
      {activeTab === 'events' && (
        <div className="space-y-4">
          {events.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-3xl border border-slate-200/80 p-8 shadow-sm">
              <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-800">No Events Configured Yet</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Create real-world trade shows, conferences, and meetups to track leads and team performance.
              </p>
              {isCompanyAdmin && (
                <button
                  onClick={() => setIsAddEventOpen(true)}
                  className="mt-4 px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-semibold transition"
                >
                  Create Your First Event
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {events.map((ev) => (
                <div
                  key={ev.id}
                  onClick={() => setSelectedEventForDetail(ev)}
                  className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-2xs hover:border-teal-500/50 hover:shadow-md cursor-pointer transition flex flex-col justify-between group space-y-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          ev.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : ev.status === 'completed'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {ev.status}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                        {ev.eventType}
                      </span>
                    </div>

                    <h3 className="font-bold text-slate-900 text-sm group-hover:text-teal-700 transition">
                      {ev.name}
                    </h3>

                    {ev.location && (
                      <p className="text-xs text-slate-500 flex items-center">
                        <MapPin className="w-3 h-3 mr-1 text-teal-600 shrink-0" />
                        <span className="truncate">{ev.location}</span>
                      </p>
                    )}

                    <p className="text-[11px] text-slate-400 flex items-center">
                      <Clock className="w-3 h-3 mr-1 text-slate-400 shrink-0" />
                      <span>
                        {ev.startAt} to {ev.endAt}
                      </span>
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                    <span className="font-semibold text-teal-800">
                      {leads.filter((l) => l.eventId === ev.id).length} Leads Captured
                    </span>
                    <span className="text-slate-400 group-hover:text-slate-900 group-hover:translate-x-0.5 transition flex items-center">
                      View Event <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: CAMPAIGNS */}
      {activeTab === 'campaigns' && (
        <div className="space-y-4">
          {campaigns.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-3xl border border-slate-200/80 p-8 shadow-sm">
              <Layers className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-800">No Campaigns Configured</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Set up booth QR codes, flyers, and campaign channels to measure source attribution.
              </p>
              {isCompanyAdmin && (
                <button
                  onClick={() => handleOpenAddCampaign()}
                  className="mt-4 px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-semibold transition"
                >
                  Create Your First Campaign
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {campaigns.map((camp) => {
                const campaignLeads = leads.filter((l) => l.campaignId === camp.id);
                const eventName = events.find((e) => e.id === camp.eventId)?.name;

                return (
                  <div
                    key={camp.id}
                    className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-2xs hover:border-teal-500/50 transition flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            camp.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {camp.status}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                          {camp.campaignType}
                        </span>
                      </div>

                      <h3 className="font-bold text-slate-900 text-sm">{camp.name}</h3>

                      {eventName && (
                        <p className="text-xs text-teal-700 font-semibold flex items-center">
                          <Calendar className="w-3 h-3 mr-1 shrink-0" />
                          <span className="truncate">Event: {eventName}</span>
                        </p>
                      )}

                      {camp.description && (
                        <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                          {camp.description}
                        </p>
                      )}
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-slate-900">{campaignLeads.length}</span>
                        <span className="text-slate-400 ml-1 text-[11px]">leads attributed</span>
                      </div>

                      <button
                        onClick={() => handleOpenQuickLead(camp.eventId || undefined, camp.id)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold transition"
                      >
                        + Add Lead
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: LEADS & PIPELINE */}
      {activeTab === 'leads' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-2xs space-y-3">
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search leads by name, company, title, email..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 outline-none"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <select
                  value={leadStatusFilter}
                  onChange={(e) => setLeadStatusFilter(e.target.value as any)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700"
                >
                  <option value="all">All Statuses</option>
                  <option value="new">New</option>
                  <option value="qualifying">Qualifying</option>
                  <option value="qualified">Qualified</option>
                  <option value="nurture">Nurture</option>
                  <option value="converted">Converted</option>
                  <option value="disqualified">Disqualified</option>
                  <option value="archived">Archived</option>
                </select>

                <select
                  value={leadPriorityFilter}
                  onChange={(e) => setLeadPriorityFilter(e.target.value as any)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700"
                >
                  <option value="all">All Priorities</option>
                  <option value="low">Low Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="high">High Priority</option>
                  <option value="critical">Critical Priority</option>
                </select>

                <select
                  value={leadEventFilter}
                  onChange={(e) => setLeadEventFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700"
                >
                  <option value="all">All Events</option>
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Leads Table / List */}
          {filteredLeads.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-3xl border border-slate-200/80 p-8 shadow-sm">
              <Target className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-800">No Leads Found</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                No company leads match the selected filters. Capture a new lead or convert a personal connection.
              </p>
              <button
                onClick={() => handleOpenQuickLead()}
                className="mt-4 px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-semibold transition"
              >
                + Quick Lead Capture
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-5 py-3.5">Lead Contact</th>
                      <th className="px-5 py-3.5">Attribution / Source</th>
                      <th className="px-5 py-3.5">Stage</th>
                      <th className="px-5 py-3.5">Priority</th>
                      <th className="px-5 py-3.5">Owner</th>
                      <th className="px-5 py-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredLeads.map((lead) => {
                      const eventName = events.find((e) => e.id === lead.eventId)?.name;

                      return (
                        <tr
                          key={lead.id}
                          onClick={() => setSelectedLeadForDetail(lead)}
                          className="hover:bg-slate-50/70 cursor-pointer transition"
                        >
                          <td className="px-5 py-3.5">
                            <div className="font-bold text-slate-900">{lead.name}</div>
                            <div className="text-[11px] text-slate-500">
                              {lead.jobTitle || 'Lead'} {lead.companyName ? `• ${lead.companyName}` : ''}
                            </div>
                          </td>

                          <td className="px-5 py-3.5">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                              {lead.sourceType}
                            </span>
                            {eventName && (
                              <div className="text-[10px] text-teal-700 font-semibold truncate max-w-[150px] mt-0.5">
                                {eventName}
                              </div>
                            )}
                          </td>

                          <td className="px-5 py-3.5">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                lead.leadStatus === 'qualified'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : lead.leadStatus === 'converted'
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                  : lead.leadStatus === 'disqualified'
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                            >
                              {lead.leadStatus}
                            </span>
                          </td>

                          <td className="px-5 py-3.5">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                lead.priority === 'critical'
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : lead.priority === 'high'
                                  ? 'bg-orange-50 text-orange-700 border border-orange-200'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {lead.priority}
                            </span>
                          </td>

                          <td className="px-5 py-3.5 text-slate-600">
                            {lead.ownerName || lead.ownerEmployeeId}
                          </td>

                          <td className="px-5 py-3.5 text-right">
                            <span className="text-teal-700 font-semibold hover:underline">
                              Inspect →
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: PERFORMANCE */}
      {activeTab === 'performance' && (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs overflow-hidden p-6">
            <h3 className="text-sm font-bold text-slate-900 mb-1">
              Employee Business Event Performance
            </h3>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Transparent reporting of company-owned leads and qualification outcomes generated by team members.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Employee</th>
                    <th className="px-4 py-3">Role / Title</th>
                    <th className="px-4 py-3">Total Leads Captured</th>
                    <th className="px-4 py-3">Qualified Leads</th>
                    <th className="px-4 py-3">Qualification Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {employees.map((emp) => {
                    const empLeads = leads.filter((l) => l.ownerEmployeeId === emp.id);
                    const empQualified = empLeads.filter(
                      (l) => l.qualificationStatus === 'qualified'
                    ).length;
                    const rate =
                      empLeads.length > 0 ? Math.round((empQualified / empLeads.length) * 100) : 0;

                    return (
                      <tr key={emp.id} className="hover:bg-slate-50/50 transition">
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {emp.displayName}
                        </td>
                        <td className="px-4 py-3 text-slate-500">{emp.designation || 'Staff'}</td>
                        <td className="px-4 py-3 font-bold text-slate-900">{empLeads.length}</td>
                        <td className="px-4 py-3 font-bold text-emerald-700">{empQualified}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              rate >= 50
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {rate}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <AddEventModal
        isOpen={isAddEventOpen}
        onClose={() => setIsAddEventOpen(false)}
        onSuccess={loadAllData}
      />

      <AddCampaignModal
        isOpen={isAddCampaignOpen}
        onClose={() => setIsAddCampaignOpen(false)}
        events={events}
        defaultEventId={selectedEventForCampaign}
        onSuccess={loadAllData}
      />

      {selectedEventForDetail && (
        <EventDetailModal
          isOpen={!!selectedEventForDetail}
          onClose={() => setSelectedEventForDetail(null)}
          event={selectedEventForDetail}
          onOpenAddCampaign={(evtId) => {
            setSelectedEventForDetail(null);
            handleOpenAddCampaign(evtId);
          }}
          onOpenLeadDetail={(ld) => {
            setSelectedEventForDetail(null);
            setSelectedLeadForDetail(ld);
          }}
          onOpenQuickLeadModal={(evtId) => {
            setSelectedEventForDetail(null);
            handleOpenQuickLead(evtId);
          }}
        />
      )}

      <EventModeModal
        isOpen={isEventModeOpen}
        onClose={() => setIsEventModeOpen(false)}
        onOpenQuickLead={(evtId, campId) => handleOpenQuickLead(evtId, campId)}
        onOpenCardShare={() => setIsShareCardOpen(true)}
      />

      <AddLeadModal
        isOpen={isAddLeadOpen}
        onClose={() => setIsAddLeadOpen(false)}
        defaultEventId={selectedEventForLead}
        defaultCampaignId={selectedCampaignForLead}
        onSuccess={loadAllData}
      />

      {selectedLeadForDetail && (
        <LeadDetailModal
          isOpen={!!selectedLeadForDetail}
          onClose={() => setSelectedLeadForDetail(null)}
          lead={selectedLeadForDetail}
          onLeadUpdated={loadAllData}
          onOpenFollowUpModal={(_, name) => {
            setFollowUpTarget({ name });
            setIsAddFollowUpOpen(true);
          }}
        />
      )}

      {currentCard && currentEmployee && (
        <ShareCardModal
          isOpen={isShareCardOpen}
          onClose={() => setIsShareCardOpen(false)}
          publicSlug={currentCard.publicSlug}
          employee={currentEmployee}
          company={activeCompany || undefined}
        />
      )}

      <AddFollowUpModal
        isOpen={isAddFollowUpOpen}
        onClose={() => setIsAddFollowUpOpen(false)}
        ownerUserId={userProfile?.id || 'user_demo'}
        defaultTargetName={followUpTarget.name}
        onFollowUpCreated={() => loadAllData()}
      />
    </div>
  );
};
