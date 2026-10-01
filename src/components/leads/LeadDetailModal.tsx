import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Lead,
  LeadStatus,
  LeadQualificationStatus,
  LeadPriority,
  CompanyLeadNote,
  LeadEvent,
  Employee,
} from '../../types';
import {
  updateLeadStatus,
  updateLeadQualification,
  reassignLead,
  getLeadNotes,
  addLeadNote,
  getLeadEvents,
} from '../../services/leadService';
import {
  getEventsForCompany,
  getCampaignsForCompany,
} from '../../services/eventService';
import { getEmployeesByCompany } from '../../services/employeeService';
import {
  Target,
  X,
  Building2,
  Phone,
  Mail,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  UserCheck,
  Shield,
  Layers,
  Sparkles,
  AlertCircle,
  FileText,
  History,
  Send,
  Plus,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import { sanitizePhoneHref, sanitizeMailtoHref } from '../../lib/securityUtils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  lead: Lead;
  onLeadUpdated?: () => void;
  onOpenFollowUpModal?: (connectionId?: string, name?: string) => void;
}

export const LeadDetailModal: React.FC<Props> = ({
  isOpen,
  onClose,
  lead: initialLead,
  onLeadUpdated,
  onOpenFollowUpModal,
}) => {
  const { userProfile, activeCompany } = useAuth();
  const currentUserId = userProfile?.id || 'user_demo';
  const currentUserName = userProfile?.displayName || 'User';
  const currentEmployeeId = userProfile?.employeeId || null;
  const companyId = activeCompany?.id || initialLead.companyId || 'company_acme';
  const isCompanyAdmin = userProfile?.role === 'company_admin' || userProfile?.role === 'app_owner';

  const [lead, setLead] = useState<Lead>(initialLead);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'notes' | 'timeline'>('overview');
  const [notes, setNotes] = useState<CompanyLeadNote[]>([]);
  const [events, setEvents] = useState<LeadEvent[]>([]);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [submittingNote, setSubmittingNote] = useState(false);
  const [updating, setUpdating] = useState(false);

  // Qualification state
  const [qualStatus, setQualStatus] = useState<LeadQualificationStatus>(initialLead.qualificationStatus);
  const [priority, setPriority] = useState<LeadPriority>(initialLead.priority);
  const [qualNotes, setQualNotes] = useState(initialLead.qualificationNotes || '');

  // Reassignment state
  const [selectedOwnerEmpId, setSelectedOwnerEmpId] = useState(initialLead.ownerEmployeeId);

  useEffect(() => {
    setLead(initialLead);
    setQualStatus(initialLead.qualificationStatus);
    setPriority(initialLead.priority);
    setQualNotes(initialLead.qualificationNotes || '');
    setSelectedOwnerEmpId(initialLead.ownerEmployeeId);
  }, [initialLead]);

  useEffect(() => {
    if (isOpen && companyId) {
      getEmployeesByCompany(companyId).then(setEmployees).catch(console.error);
    }
  }, [isOpen, companyId]);

  useEffect(() => {
    if (isOpen && lead.id) {
      loadNotesAndEvents();
    }
  }, [isOpen, lead.id]);

  const loadNotesAndEvents = async () => {
    try {
      const [fetchedNotes, fetchedEvents] = await Promise.all([
        getLeadNotes(lead.id),
        getLeadEvents(lead.id),
      ]);
      setNotes(fetchedNotes);
      setEvents(fetchedEvents);
    } catch (err) {
      console.error('Error loading lead notes/events:', err);
    }
  };

  if (!isOpen) return null;

  const handleStatusChange = async (newStatus: LeadStatus) => {
    setUpdating(true);
    try {
      await updateLeadStatus(lead.id, newStatus, currentUserId, currentUserName);
      setLead({ ...lead, leadStatus: newStatus });
      await loadNotesAndEvents();
      if (onLeadUpdated) onLeadUpdated();
    } catch (err) {
      console.error('Error updating status:', err);
    } finally {
      setUpdating(false);
    }
  };

  const handleSaveQualification = async () => {
    setUpdating(true);
    try {
      await updateLeadQualification(
        lead.id,
        qualStatus,
        priority,
        qualNotes,
        currentUserId,
        currentUserName
      );
      setLead({
        ...lead,
        qualificationStatus: qualStatus,
        priority,
        qualificationNotes: qualNotes,
      });
      await loadNotesAndEvents();
      if (onLeadUpdated) onLeadUpdated();
    } catch (err) {
      console.error('Error saving qualification:', err);
    } finally {
      setUpdating(false);
    }
  };

  const handleReassignOwner = async () => {
    if (selectedOwnerEmpId === lead.ownerEmployeeId) return;
    setUpdating(true);
    try {
      const targetEmp = employees.find((e) => e.id === selectedOwnerEmpId);
      const targetName = targetEmp ? targetEmp.displayName : selectedOwnerEmpId;
      const targetUserId = targetEmp?.id || 'user_reassigned';

      await reassignLead(
        lead.id,
        selectedOwnerEmpId,
        targetUserId,
        targetName,
        currentUserId,
        currentUserName
      );

      setLead({
        ...lead,
        ownerEmployeeId: selectedOwnerEmpId,
        ownerUserId: targetUserId,
        ownerName: targetName,
      });
      await loadNotesAndEvents();
      if (onLeadUpdated) onLeadUpdated();
    } catch (err) {
      console.error('Error reassigning lead:', err);
    } finally {
      setUpdating(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteContent.trim() || submittingNote) return;
    setSubmittingNote(true);
    try {
      const created = await addLeadNote(
        lead.id,
        lead.companyId,
        newNoteContent.trim(),
        currentUserId,
        currentEmployeeId,
        currentUserName
      );
      setNotes([created, ...notes]);
      setNewNoteContent('');
      await loadNotesAndEvents();
    } catch (err) {
      console.error('Error adding note:', err);
    } finally {
      setSubmittingNote(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-5 bg-slate-900 text-white flex items-start justify-between">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-teal-500/20 text-teal-300 flex items-center justify-center font-bold text-lg border border-teal-500/30">
              {lead.name ? lead.name.charAt(0) : 'L'}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-white tracking-tight">
                  {lead.name}
                </h3>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    lead.leadStatus === 'qualified'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : lead.leadStatus === 'converted'
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      : lead.leadStatus === 'disqualified'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : lead.leadStatus === 'archived'
                      ? 'bg-slate-700 text-slate-400'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}
                >
                  {lead.leadStatus}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    lead.priority === 'critical'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : lead.priority === 'high'
                      ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                      : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  {lead.priority} Priority
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                {lead.jobTitle || 'Business Lead'}
                {lead.companyName ? ` • ${lead.companyName}` : ''}
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

        {/* Status Lifecycle Bar */}
        <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center space-x-1.5">
            <span className="text-slate-500 text-[11px] font-medium mr-1">Status:</span>
            {(['new', 'qualifying', 'qualified', 'nurture', 'converted', 'disqualified'] as LeadStatus[]).map(
              (st) => (
                <button
                  key={st}
                  disabled={updating}
                  onClick={() => handleStatusChange(st)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition uppercase tracking-wider ${
                    lead.leadStatus === st
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {st}
                </button>
              )
            )}
          </div>

          {onOpenFollowUpModal && (
            <button
              onClick={() => {
                onClose();
                onOpenFollowUpModal(undefined, lead.name);
              }}
              className="px-3 py-1.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-semibold flex items-center text-xs shadow-2xs transition"
            >
              <Calendar className="w-3.5 h-3.5 mr-1" /> Schedule Follow-up
            </button>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="px-6 border-b border-slate-100 flex items-center space-x-6 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3 border-b-2 transition ${
              activeTab === 'overview'
                ? 'border-teal-600 text-teal-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Lead Overview
          </button>
          <button
            onClick={() => setActiveTab('notes')}
            className={`py-3 border-b-2 transition flex items-center space-x-1.5 ${
              activeTab === 'notes'
                ? 'border-teal-600 text-teal-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Company Notes</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 text-[10px]">
              {notes.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('timeline')}
            className={`py-3 border-b-2 transition flex items-center space-x-1.5 ${
              activeTab === 'timeline'
                ? 'border-teal-600 text-teal-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Audit History</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 text-[10px]">
              {events.length}
            </span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto flex-1 text-xs space-y-5">
          {activeTab === 'overview' && (
            <div className="space-y-5">
              {/* Attribution & Provenance Card */}
              <div className="p-4 rounded-2xl bg-teal-50/70 border border-teal-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Shield className="w-4 h-4 text-teal-700" />
                    <span className="font-bold text-teal-900 uppercase tracking-wider text-[11px]">
                      Source Attribution & Provenance
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-teal-200/60 text-teal-900 border border-teal-300">
                    {lead.sourceType}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] text-slate-700 pt-1">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Source Reference:</span>
                    <span className="font-semibold">{lead.sourceReference || 'Direct Entry'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Captured By:</span>
                    <span className="font-semibold">{lead.ownerName || lead.createdBy}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Captured On:</span>
                    <span className="font-semibold">
                      {new Date(lead.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-2.5">
                  <h4 className="font-bold text-slate-900 text-xs flex items-center">
                    <Building2 className="w-3.5 h-3.5 mr-1.5 text-teal-600" /> Organization & Contact
                  </h4>
                  <div className="space-y-1.5 text-slate-600 text-xs">
                    <div>
                      <span className="text-slate-400 text-[10px] block">Full Name</span>
                      <span className="font-semibold text-slate-900">{lead.name}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block">Company</span>
                      <span className="font-semibold text-slate-900">{lead.companyName || 'Not specified'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block">Job Title</span>
                      <span className="font-semibold text-slate-900">{lead.jobTitle || 'Not specified'}</span>
                    </div>
                    {lead.email && (
                      <div>
                        <span className="text-slate-400 text-[10px] block">Email</span>
                        <a
                          href={sanitizeMailtoHref(lead.email)}
                          className="text-teal-700 font-semibold hover:underline flex items-center"
                        >
                          <Mail className="w-3 h-3 mr-1" /> {lead.email}
                        </a>
                      </div>
                    )}
                    {lead.phone && (
                      <div>
                        <span className="text-slate-400 text-[10px] block">Phone</span>
                        <a
                          href={sanitizePhoneHref(lead.phone)}
                          className="text-teal-700 font-semibold hover:underline flex items-center"
                        >
                          <Phone className="w-3 h-3 mr-1" /> {lead.phone}
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Qualification & Ownership Config */}
                <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3">
                  <h4 className="font-bold text-slate-900 text-xs flex items-center">
                    <Target className="w-3.5 h-3.5 mr-1.5 text-teal-600" /> Qualification & Assignment
                  </h4>

                  <div className="space-y-2">
                    <div>
                      <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                        Qualification Stage
                      </label>
                      <select
                        value={qualStatus}
                        onChange={(e) => setQualStatus(e.target.value as LeadQualificationStatus)}
                        className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold"
                      >
                        <option value="unqualified">Unqualified</option>
                        <option value="qualifying">Qualifying</option>
                        <option value="qualified">Qualified</option>
                        <option value="disqualified">Disqualified</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                        Priority Level
                      </label>
                      <select
                        value={priority}
                        onChange={(e) => setPriority(e.target.value as LeadPriority)}
                        className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="critical">Critical</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                        Qualification Notes
                      </label>
                      <textarea
                        rows={2}
                        value={qualNotes}
                        onChange={(e) => setQualNotes(e.target.value)}
                        placeholder="Criteria, budget, timeframe..."
                        className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs resize-none"
                      />
                    </div>

                    <button
                      disabled={updating}
                      onClick={handleSaveQualification}
                      className="w-full py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition"
                    >
                      {updating ? 'Saving...' : 'Update Qualification'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Owner Reassignment (Admin/Manager controlled) */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Current Lead Owner
                  </span>
                  <span className="font-bold text-slate-900 text-xs">
                    {lead.ownerName || lead.ownerEmployeeId}
                  </span>
                </div>

                {isCompanyAdmin && (
                  <div className="flex items-center space-x-2">
                    <select
                      value={selectedOwnerEmpId}
                      onChange={(e) => setSelectedOwnerEmpId(e.target.value)}
                      className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-semibold"
                    >
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.displayName} ({emp.designation || 'Staff'})
                        </option>
                      ))}
                    </select>
                    <button
                      disabled={updating || selectedOwnerEmpId === lead.ownerEmployeeId}
                      onClick={handleReassignOwner}
                      className="px-3 py-1.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold disabled:opacity-40 transition"
                    >
                      Reassign
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'notes' && (
            <div className="space-y-4">
              {/* Add Company Note */}
              <form onSubmit={handleAddNote} className="space-y-2">
                <textarea
                  rows={3}
                  value={newNoteContent}
                  onChange={(e) => setNewNoteContent(e.target.value)}
                  placeholder="Add a company-wide lead note (visible to authorized team members)..."
                  className="w-full p-3 rounded-2xl border border-slate-200 text-xs focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 outline-none resize-none"
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={!newNoteContent.trim() || submittingNote}
                    className="px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-semibold flex items-center space-x-1.5 disabled:opacity-50 transition"
                  >
                    <Send className="w-3.5 h-3.5 mr-1" /> Add Company Note
                  </button>
                </div>
              </form>

              {/* Notes List */}
              <div className="space-y-2.5 pt-2">
                {notes.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 italic">
                    No company notes logged for this lead yet.
                  </div>
                ) : (
                  notes.map((n) => (
                    <div
                      key={n.id}
                      className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-slate-900">{n.authorName}</span>
                        <span className="text-slate-400">
                          {new Date(n.createdAt).toLocaleDateString()} at{' '}
                          {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-slate-700 text-xs whitespace-pre-wrap leading-relaxed">
                        {n.content}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'timeline' && (
            <div className="space-y-3">
              <div className="flex items-center space-x-2 text-[11px] text-slate-500 mb-2">
                <History className="w-4 h-4 text-slate-400" />
                <span>Immutable audit trail of all company business actions on this lead.</span>
              </div>

              {events.length === 0 ? (
                <div className="text-center py-8 text-slate-400 italic">
                  No audit history recorded.
                </div>
              ) : (
                <div className="space-y-3 relative before:absolute before:top-2 before:bottom-2 before:left-3.5 before:w-0.5 before:bg-slate-200">
                  {events.map((evt) => (
                    <div key={evt.id} className="relative flex items-start space-x-3 pl-1">
                      <div className="w-6 h-6 rounded-full bg-teal-100 border-2 border-white flex items-center justify-center shrink-0 z-10 text-[10px] font-bold text-teal-800 shadow-2xs">
                        ✓
                      </div>
                      <div className="flex-1 bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-slate-900">{evt.eventType}</span>
                          <span className="text-slate-400">
                            {new Date(evt.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-xs text-slate-700 mt-1">{evt.description}</p>
                        <span className="text-[10px] text-slate-400 block mt-1">
                          Actor: {evt.actorName}
                        </span>
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
