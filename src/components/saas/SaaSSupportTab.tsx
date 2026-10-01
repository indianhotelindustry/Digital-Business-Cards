// ============================================================================
// DSBC SAAS SUPPORT INQUIRY TAB (Directive 21 Section 14)
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  HelpCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Filter,
  User,
  Building2,
  Mail,
  RefreshCw,
  Search,
  ExternalLink,
} from 'lucide-react';
import { supportService, SupportTicket, SupportStatus } from '../../services/supportService';

export const SaaSSupportTab: React.FC = () => {
  const [tickets, setTickets] = useState<SupportTicket[]>(supportService.getTickets());
  const [statusFilter, setStatusFilter] = useState<'ALL' | SupportStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);

  const handleRefresh = () => {
    setTickets(supportService.getTickets());
  };

  useEffect(() => {
    const unsub = supportService.subscribe(() => {
      setTickets(supportService.getTickets());
    });
    return unsub;
  }, []);

  const handleUpdateStatus = (id: string, status: SupportStatus) => {
    supportService.updateTicketStatus(id, status);
    if (selectedTicket && selectedTicket.id === id) {
      setSelectedTicket({ ...selectedTicket, status });
    }
  };

  const filteredTickets = tickets.filter((t) => {
    if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        t.ticketNumber.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q) ||
        t.email.toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const getStatusBadge = (status: SupportStatus) => {
    switch (status) {
      case 'OPEN':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
            <Clock className="w-3 h-3 mr-1 text-amber-600" />
            OPEN
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
            <Clock className="w-3 h-3 mr-1 text-blue-600" />
            IN PROGRESS
          </span>
        );
      case 'RESOLVED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
            RESOLVED
          </span>
        );
      case 'CLOSED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
            CLOSED
          </span>
        );
    }
  };

  const counts = {
    ALL: tickets.length,
    OPEN: tickets.filter((t) => t.status === 'OPEN').length,
    IN_PROGRESS: tickets.filter((t) => t.status === 'IN_PROGRESS').length,
    RESOLVED: tickets.filter((t) => t.status === 'RESOLVED').length,
    CLOSED: tickets.filter((t) => t.status === 'CLOSED').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-1.5 rounded-lg bg-teal-50 text-teal-700 border border-teal-200">
              <MessageSquare className="w-4 h-4" />
            </span>
            <h2 className="text-base font-bold text-slate-900">
              Customer Support & Technical Inquiries
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Centrally manage incoming inquiries, problem reports, and onboarding guidance requests across individual & company tenants.
          </p>
        </div>

        <button
          onClick={handleRefresh}
          className="inline-flex items-center px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition self-start md:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1.5 text-teal-600" />
          Refresh Tickets
        </button>
      </div>

      {/* Filter Tabs & Search */}
      <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0">
          {(['ALL', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
                statusFilter === st
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <span>{st.replace('_', ' ')}</span>
              <span className="ml-1.5 font-mono text-[10px] opacity-80">
                ({counts[st]})
              </span>
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tickets..."
            className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 w-full sm:w-48"
          />
        </div>
      </div>

      {/* Ticket List and Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Ticket List */}
        <div className="lg:col-span-7 space-y-3">
          {filteredTickets.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center">
              <HelpCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-600">No support tickets found</p>
              <p className="text-[11px] text-slate-400 mt-0.5">All customer inquiries are current.</p>
            </div>
          ) : (
            filteredTickets.map((t) => {
              const isSelected = selectedTicket?.id === t.id;
              return (
                <div
                  key={t.id}
                  onClick={() => setSelectedTicket(t)}
                  className={`bg-white rounded-2xl p-4 border transition cursor-pointer ${
                    isSelected
                      ? 'border-teal-600 ring-2 ring-teal-500/10 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 hover:shadow-2xs'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs font-bold text-slate-900">
                        {t.ticketNumber}
                      </span>
                      {getStatusBadge(t.status)}
                      <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                        {t.category.replace('_', ' ')}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(t.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <h4 className="text-xs font-bold text-slate-900 mb-1">{t.subject}</h4>
                  <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                    {t.message}
                  </p>

                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                    <div className="flex items-center space-x-2">
                      {t.customerType === 'company' ? (
                        <Building2 className="w-3.5 h-3.5 text-teal-600" />
                      ) : (
                        <User className="w-3.5 h-3.5 text-blue-600" />
                      )}
                      <span className="font-medium text-slate-700">{t.name}</span>
                      <span className="text-slate-400 font-mono">({t.email})</span>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        t.priority === 'HIGH'
                          ? 'bg-rose-50 text-rose-700'
                          : t.priority === 'MEDIUM'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-slate-50 text-slate-600'
                      }`}
                    >
                      {t.priority}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Selected Ticket Action Drawer */}
        <div className="lg:col-span-5">
          {selectedTicket ? (
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs sticky top-20 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <span className="font-mono text-xs font-bold text-slate-900 block">
                    {selectedTicket.ticketNumber}
                  </span>
                  <span className="text-[11px] text-slate-500">Inquiry Details & Action</span>
                </div>
                {getStatusBadge(selectedTicket.status)}
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-2">
                  {selectedTicket.subject}
                </h3>
                <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-700 leading-relaxed border border-slate-100">
                  {selectedTicket.message}
                </div>
              </div>

              <div className="space-y-1.5 text-xs text-slate-600">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Customer:</span>
                  <strong className="text-slate-900">{selectedTicket.name}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Email:</span>
                  <strong className="font-mono text-slate-900">{selectedTicket.email}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Type:</span>
                  <span className="uppercase font-semibold text-slate-700">
                    {selectedTicket.customerType || 'individual'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Received:</span>
                  <span className="font-mono text-slate-700">
                    {new Date(selectedTicket.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Status Update Actions (Directive 21 Section 14) */}
              <div className="pt-3 border-t border-slate-100">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Update Ticket Lifecycle Status
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleUpdateStatus(selectedTicket.id, 'OPEN')}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition ${
                      selectedTicket.status === 'OPEN'
                        ? 'bg-amber-500 text-white border-amber-600 shadow-2xs'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    Set Open
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(selectedTicket.id, 'IN_PROGRESS')}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition ${
                      selectedTicket.status === 'IN_PROGRESS'
                        ? 'bg-blue-600 text-white border-blue-700 shadow-2xs'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    In Progress
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(selectedTicket.id, 'RESOLVED')}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition ${
                      selectedTicket.status === 'RESOLVED'
                        ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    Resolve
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(selectedTicket.id, 'CLOSED')}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition ${
                      selectedTicket.status === 'CLOSED'
                        ? 'bg-slate-800 text-white border-slate-900 shadow-2xs'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    Close Ticket
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 rounded-3xl p-8 border border-dashed border-slate-200 text-center">
              <MessageSquare className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-600">Select a ticket to view details</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Inspect customer message and update status lifecycle.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
