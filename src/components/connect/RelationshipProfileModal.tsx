import React, { useState, useEffect } from 'react';
import {
  Connection,
  Contact,
  RelationshipNote,
  FollowUp,
  ConnectionEvent,
  ConnectionStatus,
  RelationshipStatus,
  RelationshipPriority,
} from '../../types';
import {
  getRelationshipNotes,
  createRelationshipNote,
  deleteRelationshipNote,
  getConnectionTimeline,
  updateConnectionStatus,
} from '../../services/connectService';
import {
  X,
  User,
  Building,
  Mail,
  Phone,
  Calendar,
  Clock,
  MessageSquare,
  Shield,
  CheckCircle2,
  XCircle,
  Ban,
  RotateCcw,
  Sparkles,
  Plus,
  Trash2,
  Check,
  Send,
  Lock,
  Target,
} from 'lucide-react';
import { sanitizePhoneHref, sanitizeMailtoHref } from '../../lib/securityUtils';

interface RelationshipProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  connection: Connection;
  currentUserId: string;
  currentUserName: string;
  onConnectionUpdated: () => void;
  onOpenFollowUpModal: (connectionId: string, targetName: string) => void;
  onOpenConvertToLeadModal?: (connection: Connection) => void;
}

export const RelationshipProfileModal: React.FC<RelationshipProfileModalProps> = ({
  isOpen,
  onClose,
  connection,
  currentUserId,
  currentUserName,
  onConnectionUpdated,
  onOpenFollowUpModal,
  onOpenConvertToLeadModal,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'notes' | 'timeline'>('overview');
  const [notes, setNotes] = useState<RelationshipNote[]>([]);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [timeline, setTimeline] = useState<ConnectionEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [submittingNote, setSubmittingNote] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isIncomingPending =
    connection.status === 'pending' &&
    (connection.recipientUserId === currentUserId || connection.initiatedBy !== currentUserId);

  const isOutgoingPending =
    connection.status === 'pending' && connection.initiatedBy === currentUserId;

  const isAccepted = connection.status === 'accepted';
  const isBlocked = connection.status === 'blocked';

  useEffect(() => {
    if (isOpen && connection) {
      loadNotesAndTimeline();
    }
  }, [isOpen, connection.id]);

  const loadNotesAndTimeline = async () => {
    setLoading(true);
    try {
      const [fetchedNotes, fetchedTimeline] = await Promise.all([
        getRelationshipNotes(currentUserId, connection.id),
        getConnectionTimeline(connection.id, currentUserId),
      ]);
      setNotes(fetchedNotes);
      setTimeline(fetchedTimeline);
    } catch (err) {
      console.error('Error loading relationship details:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleStatusChange = async (newStatus: ConnectionStatus) => {
    setStatusUpdating(true);
    setError(null);
    try {
      await updateConnectionStatus(connection.id, newStatus, currentUserId, currentUserName);
      onConnectionUpdated();
      await loadNotesAndTimeline();
    } catch (err: any) {
      console.error('Error updating status:', err);
      setError(err.message || 'Failed to update connection status');
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteContent.trim()) return;

    setSubmittingNote(true);
    try {
      const created = await createRelationshipNote({
        ownerUserId: currentUserId,
        connectionId: connection.id,
        content: newNoteContent.trim(),
        authorName: currentUserName,
      });
      setNotes([created, ...notes]);
      setNewNoteContent('');
      await loadNotesAndTimeline();
    } catch (err: any) {
      console.error('Error adding note:', err);
      setError(err.message || 'Failed to add note');
    } finally {
      setSubmittingNote(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      await deleteRelationshipNote(noteId);
      setNotes(notes.filter((n) => n.id !== noteId));
    } catch (err: any) {
      console.error('Error deleting note:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Banner */}
        <div className="px-6 py-5 bg-slate-900 text-white flex items-start justify-between">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-teal-500/20 text-teal-300 flex items-center justify-center font-bold text-lg border border-teal-500/30">
              {connection.requesterName ? connection.requesterName.charAt(0) : 'C'}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-white tracking-tight">
                  {connection.requesterName}
                </h3>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    connection.status === 'accepted'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : connection.status === 'pending'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : connection.status === 'blocked'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  {connection.status}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                {connection.requesterTitle || 'Professional'}
                {connection.requesterCompany ? ` • ${connection.requesterCompany}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Action Bar (Accept/Decline/Follow-up/Block) */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center space-x-2">
            {isIncomingPending && (
              <>
                <button
                  disabled={statusUpdating}
                  onClick={() => handleStatusChange('accepted')}
                  className="px-3 py-1.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-semibold flex items-center space-x-1 transition shadow-2xs"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Accept Connection
                </button>
                <button
                  disabled={statusUpdating}
                  onClick={() => handleStatusChange('declined')}
                  className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold flex items-center space-x-1 transition"
                >
                  <XCircle className="w-3.5 h-3.5 mr-1 text-rose-500" /> Decline
                </button>
              </>
            )}

            {isOutgoingPending && (
              <span className="text-slate-500 italic flex items-center">
                <Clock className="w-3.5 h-3.5 mr-1 text-amber-500" /> Waiting for recipient acceptance
              </span>
            )}

            {isAccepted && (
              <>
                <button
                  onClick={() => {
                    onClose();
                    onOpenFollowUpModal(connection.id, connection.requesterName);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-semibold flex items-center space-x-1 transition shadow-2xs"
                >
                  <Calendar className="w-3.5 h-3.5 mr-1" /> Schedule Follow-up
                </button>

                {onOpenConvertToLeadModal && (
                  <button
                    onClick={() => {
                      onClose();
                      onOpenConvertToLeadModal(connection);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-teal-300 font-semibold flex items-center space-x-1 transition shadow-2xs border border-slate-700"
                  >
                    <Target className="w-3.5 h-3.5 mr-1 text-teal-400" /> Convert to Company Lead
                  </button>
                )}
              </>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {isAccepted && (
              <button
                disabled={statusUpdating}
                onClick={() => handleStatusChange('revoked')}
                className="px-2.5 py-1 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition text-[11px]"
              >
                Revoke
              </button>
            )}

            {!isBlocked && (
              <button
                disabled={statusUpdating}
                onClick={() => handleStatusChange('blocked')}
                className="px-2.5 py-1 rounded-lg text-rose-600 hover:text-rose-800 hover:bg-rose-50 transition text-[11px] font-semibold"
              >
                Block
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 px-6 bg-white text-xs font-semibold">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3 px-4 border-b-2 transition ${
              activeTab === 'overview'
                ? 'border-teal-600 text-teal-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Overview & Details
          </button>
          <button
            onClick={() => setActiveTab('notes')}
            className={`py-3 px-4 border-b-2 transition flex items-center space-x-1.5 ${
              activeTab === 'notes'
                ? 'border-teal-600 text-teal-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Lock className="w-3 h-3 text-amber-500" />
            <span>Private Notes ({notes.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('timeline')}
            className={`py-3 px-4 border-b-2 transition ${
              activeTab === 'timeline'
                ? 'border-teal-600 text-teal-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Timeline & History ({timeline.length})
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50">
          {error && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium">
              {error}
            </div>
          )}

          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* Contact Information Card */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center">
                  <User className="w-3.5 h-3.5 mr-1.5 text-teal-600" /> Shared Contact Info
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">
                      Email Address
                    </span>
                    {connection.requesterEmail ? (
                      <a
                        href={sanitizeMailtoHref(connection.requesterEmail) || '#'}
                        className="text-teal-700 hover:underline font-medium break-all"
                      >
                        {connection.requesterEmail}
                      </a>
                    ) : (
                      <span className="text-slate-400 italic">Not shared</span>
                    )}
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">
                      Phone Number
                    </span>
                    {connection.requesterPhone ? (
                      <a
                        href={sanitizePhoneHref(connection.requesterPhone) || '#'}
                        className="text-teal-700 hover:underline font-medium"
                      >
                        {connection.requesterPhone}
                      </a>
                    ) : (
                      <span className="text-slate-400 italic">Not shared</span>
                    )}
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">
                      Exchange Method
                    </span>
                    <span className="font-semibold text-slate-800 capitalize">
                      {connection.exchangeMethod ? connection.exchangeMethod.replace('_', ' ') : 'Direct Link'}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">
                      Connection Established
                    </span>
                    <span className="font-medium text-slate-700">
                      {new Date(connection.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                </div>

                {connection.initialNote && (
                  <div className="mt-3 p-3 bg-teal-50/60 border border-teal-100 rounded-xl text-xs">
                    <span className="text-[10px] font-bold text-teal-800 uppercase block mb-1">
                      Initial Request Message
                    </span>
                    <p className="text-slate-700 italic">{connection.initialNote}</p>
                  </div>
                )}
              </div>

              {/* Consent & Permissions Card */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
                <div className="flex items-center space-x-2 text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                  <Shield className="w-3.5 h-3.5 text-teal-600" />
                  <span>Authorized Information Fields</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(connection.sharedCategories || ['profile', 'company', 'email', 'phone']).map(
                    (cat) => (
                      <span
                        key={cat}
                        className="px-2.5 py-1 rounded-lg bg-teal-50 text-teal-800 border border-teal-200 text-[11px] font-semibold capitalize"
                      >
                        ✓ {cat.replace('_', ' ')}
                      </span>
                    )
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notes' && (
            <div className="space-y-4">
              <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-2xl flex items-start space-x-2.5 text-amber-900 text-xs">
                <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <span className="font-bold">Private Relationship Notes</span>: Strictly personal to your account. Connected parties cannot view your internal notes.
                </div>
              </div>

              {/* New Note Form */}
              <form onSubmit={handleAddNote} className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
                <textarea
                  rows={2}
                  value={newNoteContent}
                  onChange={(e) => setNewNoteContent(e.target.value)}
                  placeholder="Record an interaction note, personal reminder, or key relationship context..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-teal-500 focus:bg-white transition resize-none"
                />
                <div className="mt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={submittingNote || !newNoteContent.trim()}
                    className="px-3 py-1.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold shadow-2xs transition flex items-center space-x-1 disabled:opacity-50"
                  >
                    <Send className="w-3 h-3 mr-1" />
                    <span>Save Note</span>
                  </button>
                </div>
              </form>

              {/* Notes List */}
              <div className="space-y-2.5">
                {notes.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-xs">
                    No notes recorded yet. Add your first private note above.
                  </div>
                ) : (
                  notes.map((note) => (
                    <div
                      key={note.id}
                      className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs relative group"
                    >
                      <p className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                        {note.content}
                      </p>
                      <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                        <span>
                          {new Date(note.createdAt).toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        <button
                          onClick={() => handleDeleteNote(note.id)}
                          className="opacity-0 group-hover:opacity-100 text-rose-500 hover:text-rose-700 transition"
                          title="Delete note"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'timeline' && (
            <div className="space-y-3">
              {timeline.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  No timeline events recorded yet.
                </div>
              ) : (
                <div className="relative pl-4 border-l-2 border-slate-200 space-y-4 my-2">
                  {timeline.map((evt) => (
                    <div key={evt.id} className="relative">
                      <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-teal-600 border-2 border-white shadow-xs"></div>
                      <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs text-xs">
                        <div className="flex items-center justify-between text-[11px] font-bold text-slate-900">
                          <span>{evt.eventType.replace(/_/g, ' ')}</span>
                          <span className="text-[10px] text-slate-400 font-normal">
                            {new Date(evt.timestamp).toLocaleString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <p className="text-slate-600 mt-1 text-[11px]">{evt.description}</p>
                        <span className="text-[10px] text-slate-400 mt-1 block">
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
