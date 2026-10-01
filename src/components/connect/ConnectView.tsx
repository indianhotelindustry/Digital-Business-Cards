import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Connection,
  Contact,
  FollowUp,
  ConnectionStatus,
  FollowUpStatus,
} from '../../types';
import {
  getConnectionsForUser,
  getContactsForUser,
  getFollowUpsForUser,
  updateConnectionStatus,
  updateFollowUpStatus,
  archiveContact,
} from '../../services/connectService';
import { RelationshipProfileModal } from './RelationshipProfileModal';
import { AddContactModal } from './AddContactModal';
import { AddFollowUpModal } from './AddFollowUpModal';
import { ConvertToLeadModal } from '../leads/ConvertToLeadModal';
import {
  UserPlus,
  Users2,
  BookOpen,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  Plus,
  ArrowRight,
  Shield,
  Phone,
  Mail,
  Building,
  Check,
  RotateCcw,
  Sparkles,
  ExternalLink,
  Lock,
} from 'lucide-react';
import { sanitizePhoneHref, sanitizeMailtoHref } from '../../lib/securityUtils';

export const ConnectView: React.FC = () => {
  const { userProfile, activeCompany } = useAuth();
  const currentUserId = userProfile?.id || 'user_demo';
  const currentUserName = userProfile?.displayName || 'User';
  const currentEmployeeId = userProfile?.employeeId || null;

  const [activeTab, setActiveTab] = useState<'connections' | 'contacts' | 'followups'>('connections');
  const [connections, setConnections] = useState<Connection[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'accepted' | 'pending' | 'blocked'>('all');

  // Modals state
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);
  const [isAddContactOpen, setIsAddContactOpen] = useState(false);
  const [isAddFollowUpOpen, setIsAddFollowUpOpen] = useState(false);
  const [isConvertToLeadOpen, setIsConvertToLeadOpen] = useState(false);
  const [connectionToConvert, setConnectionToConvert] = useState<Connection | null>(null);
  const [followUpTarget, setFollowUpTarget] = useState<{ connectionId?: string; name?: string }>({});

  useEffect(() => {
    loadAllData();
  }, [currentUserId, currentEmployeeId]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [fetchedConnections, fetchedContacts, fetchedFollowUps] = await Promise.all([
        getConnectionsForUser(currentUserId, currentEmployeeId),
        getContactsForUser(currentUserId),
        getFollowUpsForUser(currentUserId),
      ]);
      setConnections(fetchedConnections);
      setContacts(fetchedContacts);
      setFollowUps(fetchedFollowUps);
    } catch (err) {
      console.error('Error loading Connect data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptConnection = async (conn: Connection, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await updateConnectionStatus(conn.id, 'accepted', currentUserId, currentUserName);
      await loadAllData();
    } catch (err) {
      console.error('Error accepting connection:', err);
    }
  };

  const handleDeclineConnection = async (conn: Connection, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await updateConnectionStatus(conn.id, 'declined', currentUserId, currentUserName);
      await loadAllData();
    } catch (err) {
      console.error('Error declining connection:', err);
    }
  };

  const handleToggleFollowUp = async (fu: FollowUp) => {
    const nextStatus: FollowUpStatus = fu.status === 'completed' ? 'pending' : 'completed';
    try {
      await updateFollowUpStatus(fu.id, nextStatus);
      setFollowUps(
        followUps.map((item) => (item.id === fu.id ? { ...item, status: nextStatus } : item))
      );
    } catch (err) {
      console.error('Error toggling follow-up:', err);
    }
  };

  // Filtered connections
  const filteredConnections = connections.filter((conn) => {
    const matchesSearch =
      (conn.requesterName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (conn.requesterCompany || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (conn.requesterTitle || '').toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (statusFilter === 'all') return true;
    return conn.status === statusFilter;
  });

  // Filtered contacts
  const filteredContacts = contacts.filter((c) => {
    return (
      (c.displayName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.companyName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.jobTitle || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const pendingRequestsCount = connections.filter(
    (c) => c.status === 'pending' && c.initiatedBy !== currentUserId
  ).length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/10 text-teal-700 flex items-center justify-center font-bold">
              <Users2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">DSBC Connect</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Two-way professional identity exchange, verified relationships & follow-ups
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsAddContactOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition flex items-center space-x-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Contact</span>
          </button>
          <button
            onClick={() => {
              setFollowUpTarget({});
              setIsAddFollowUpOpen(true);
            }}
            className="px-3.5 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold shadow-sm transition flex items-center space-x-1.5"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>New Follow-up</span>
          </button>
        </div>
      </div>

      {/* Main Tab Bar */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 rounded-2xl shadow-2xs">
        <div className="flex space-x-8">
          <button
            onClick={() => setActiveTab('connections')}
            className={`py-4 text-xs font-bold border-b-2 flex items-center space-x-2 transition ${
              activeTab === 'connections'
                ? 'border-teal-600 text-teal-700'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Users2 className="w-4 h-4" />
            <span>Connections ({connections.length})</span>
            {pendingRequestsCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-500 text-white font-bold">
                {pendingRequestsCount} new
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('contacts')}
            className={`py-4 text-xs font-bold border-b-2 flex items-center space-x-2 transition ${
              activeTab === 'contacts'
                ? 'border-teal-600 text-teal-700'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Address Book ({contacts.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('followups')}
            className={`py-4 text-xs font-bold border-b-2 flex items-center space-x-2 transition ${
              activeTab === 'followups'
                ? 'border-teal-600 text-teal-700'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Follow-ups ({followUps.filter((f) => f.status === 'pending').length})</span>
          </button>
        </div>

        {/* Global Search Bar */}
        <div className="relative w-64 my-2 hidden sm:block">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Connect..."
            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-teal-500 focus:bg-white transition"
          />
        </div>
      </div>

      {/* Tab 1: CONNECTIONS */}
      {activeTab === 'connections' && (
        <div className="space-y-4">
          {/* Sub-Filters */}
          <div className="flex items-center space-x-2">
            {(['all', 'accepted', 'pending', 'blocked'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition ${
                  statusFilter === filter
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400">
              <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              Loading connections...
            </div>
          ) : filteredConnections.length === 0 ? (
            <div className="p-12 bg-white rounded-3xl border border-slate-200 text-center">
              <Users2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-900">No connections found</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Exchange your digital business card or share your QR code to establish verified professional connections.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredConnections.map((conn) => {
                const isIncoming = conn.status === 'pending' && conn.initiatedBy !== currentUserId;
                return (
                  <div
                    key={conn.id}
                    onClick={() => setSelectedConnection(conn)}
                    className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs hover:shadow-md transition cursor-pointer flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 font-bold flex items-center justify-center border border-teal-100">
                            {conn.requesterName ? conn.requesterName.charAt(0) : 'C'}
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-slate-900 group-hover:text-teal-700 transition">
                              {conn.requesterName}
                            </h4>
                            <p className="text-[11px] text-slate-500">{conn.requesterTitle || 'Professional'}</p>
                          </div>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            conn.status === 'accepted'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : conn.status === 'pending'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : conn.status === 'blocked'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {conn.status}
                        </span>
                      </div>

                      {conn.requesterCompany && (
                        <div className="flex items-center text-[11px] text-slate-600 mb-2">
                          <Building className="w-3.5 h-3.5 mr-1 text-slate-400" />
                          <span>{conn.requesterCompany}</span>
                        </div>
                      )}

                      {conn.initialNote && (
                        <p className="text-[11px] text-slate-500 line-clamp-2 bg-slate-50 p-2 rounded-lg border border-slate-100 italic mb-3">
                          &quot;{conn.initialNote}&quot;
                        </p>
                      )}
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                      {isIncoming ? (
                        <div className="flex items-center space-x-2 w-full">
                          <button
                            onClick={(e) => handleAcceptConnection(conn, e)}
                            className="flex-1 py-1.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-[11px] font-semibold transition flex items-center justify-center"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Accept
                          </button>
                          <button
                            onClick={(e) => handleDeclineConnection(conn, e)}
                            className="flex-1 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold transition flex items-center justify-center"
                          >
                            Decline
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="text-[10px] text-slate-400">
                            {conn.exchangeMethod ? `Via ${conn.exchangeMethod.replace('_', ' ')}` : 'Direct'}
                          </span>
                          <span className="text-teal-700 font-semibold text-[11px] flex items-center group-hover:translate-x-0.5 transition">
                            View Profile <ArrowRight className="w-3 h-3 ml-1" />
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: CONTACTS (ADDRESS BOOK) */}
      {activeTab === 'contacts' && (
        <div className="space-y-4">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400">Loading contacts...</div>
          ) : filteredContacts.length === 0 ? (
            <div className="p-12 bg-white rounded-3xl border border-slate-200 text-center">
              <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-900">Your address book is empty</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Save manual contacts or accept connection requests to build your personal professional directory.
              </p>
              <button
                onClick={() => setIsAddContactOpen(true)}
                className="mt-4 px-4 py-2 rounded-xl bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 transition"
              >
                Add First Contact
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredContacts.map((contact) => (
                <div
                  key={contact.id}
                  className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 font-bold flex items-center justify-center">
                        {contact.displayName ? contact.displayName.charAt(0) : 'C'}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">{contact.displayName}</h4>
                        <p className="text-[11px] text-slate-500">{contact.jobTitle || 'Contact'}</p>
                      </div>
                    </div>

                    {contact.companyName && (
                      <div className="flex items-center text-[11px] text-slate-600 mb-2">
                        <Building className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                        <span>{contact.companyName}</span>
                      </div>
                    )}

                    {contact.email && (
                      <div className="flex items-center text-[11px] text-slate-600 mb-1.5">
                        <Mail className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                        <a
                          href={sanitizeMailtoHref(contact.email) || '#'}
                          className="text-teal-700 hover:underline truncate"
                        >
                          {contact.email}
                        </a>
                      </div>
                    )}

                    {contact.phone && (
                      <div className="flex items-center text-[11px] text-slate-600 mb-1.5">
                        <Phone className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                        <a
                          href={sanitizePhoneHref(contact.phone) || '#'}
                          className="text-teal-700 hover:underline"
                        >
                          {contact.phone}
                        </a>
                      </div>
                    )}

                    {contact.notesSummary && (
                      <p className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100 mt-2">
                        {contact.notesSummary}
                      </p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-100 mt-3 flex items-center justify-between text-xs">
                    <span className="text-[10px] text-slate-400 capitalize">
                      Source: {contact.sourceType.replace('_', ' ')}
                    </span>
                    <button
                      onClick={() => {
                        setFollowUpTarget({ name: contact.displayName });
                        setIsAddFollowUpOpen(true);
                      }}
                      className="text-teal-700 font-semibold text-[11px] hover:underline flex items-center"
                    >
                      <Calendar className="w-3 h-3 mr-1" /> Follow-up
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: FOLLOW-UPS */}
      {activeTab === 'followups' && (
        <div className="space-y-4">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400">Loading follow-ups...</div>
          ) : followUps.length === 0 ? (
            <div className="p-12 bg-white rounded-3xl border border-slate-200 text-center">
              <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-900">No scheduled follow-ups</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Set reminders and action items after exchanging cards or meeting new connections.
              </p>
              <button
                onClick={() => {
                  setFollowUpTarget({});
                  setIsAddFollowUpOpen(true);
                }}
                className="mt-4 px-4 py-2 rounded-xl bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 transition"
              >
                Schedule First Follow-Up
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {followUps.map((fu) => {
                const isCompleted = fu.status === 'completed';
                const isOverdue =
                  !isCompleted &&
                  new Date(fu.dueAt).getTime() < new Date().setHours(0, 0, 0, 0);

                return (
                  <div
                    key={fu.id}
                    className={`bg-white p-4 rounded-2xl border transition flex items-center justify-between ${
                      isCompleted
                        ? 'border-slate-200 bg-slate-50/60 opacity-75'
                        : isOverdue
                        ? 'border-rose-200 bg-rose-50/20'
                        : 'border-slate-200/80 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <button
                        onClick={() => handleToggleFollowUp(fu)}
                        className={`mt-0.5 w-5 h-5 rounded-lg border flex items-center justify-center transition ${
                          isCompleted
                            ? 'bg-teal-600 border-teal-600 text-white'
                            : 'border-slate-300 hover:border-teal-600 bg-white'
                        }`}
                      >
                        {isCompleted && <Check className="w-3.5 h-3.5" />}
                      </button>

                      <div>
                        <div className="flex items-center space-x-2">
                          <h4
                            className={`text-xs font-bold ${
                              isCompleted ? 'text-slate-400 line-through' : 'text-slate-900'
                            }`}
                          >
                            {fu.title}
                          </h4>
                          {isOverdue && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              Overdue
                            </span>
                          )}
                        </div>

                        <div className="flex items-center space-x-3 text-[11px] text-slate-500 mt-1">
                          <span className="font-semibold text-slate-700">With: {fu.targetName}</span>
                          <span>•</span>
                          <span className="flex items-center">
                            <Clock className="w-3 h-3 mr-1 text-slate-400" />
                            Due {new Date(fu.dueAt).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                        </div>

                        {fu.notes && (
                          <p className="text-[11px] text-slate-600 mt-1 italic">{fu.notes}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleToggleFollowUp(fu)}
                        className="text-xs font-semibold text-teal-700 hover:text-teal-900 transition"
                      >
                        {isCompleted ? 'Re-open' : 'Mark Done'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Relationship Profile Modal */}
      {selectedConnection && (
        <RelationshipProfileModal
          isOpen={Boolean(selectedConnection)}
          onClose={() => setSelectedConnection(null)}
          connection={selectedConnection}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          onConnectionUpdated={loadAllData}
          onOpenFollowUpModal={(connId, targetName) => {
            setFollowUpTarget({ connectionId: connId, name: targetName });
            setIsAddFollowUpOpen(true);
          }}
          onOpenConvertToLeadModal={(conn) => {
            setConnectionToConvert(conn);
            setIsConvertToLeadOpen(true);
          }}
        />
      )}

      {/* Convert to Lead Modal */}
      {connectionToConvert && (
        <ConvertToLeadModal
          isOpen={isConvertToLeadOpen}
          onClose={() => {
            setIsConvertToLeadOpen(false);
            setConnectionToConvert(null);
          }}
          connection={connectionToConvert}
          onSuccess={() => {
            loadAllData();
          }}
        />
      )}

      {/* Add Contact Modal */}
      <AddContactModal
        isOpen={isAddContactOpen}
        onClose={() => setIsAddContactOpen(false)}
        ownerUserId={currentUserId}
        onContactCreated={(newC) => {
          setContacts([newC, ...contacts]);
        }}
      />

      {/* Add Follow-Up Modal */}
      <AddFollowUpModal
        isOpen={isAddFollowUpOpen}
        onClose={() => setIsAddFollowUpOpen(false)}
        ownerUserId={currentUserId}
        connectionId={followUpTarget.connectionId}
        defaultTargetName={followUpTarget.name || ''}
        onFollowUpCreated={(newFu) => {
          setFollowUps([newFu, ...followUps]);
        }}
      />
    </div>
  );
};
