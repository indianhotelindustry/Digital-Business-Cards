import React, { useState } from 'react';
import { FollowUp, FollowUpStatus } from '../../types';
import { createFollowUp } from '../../services/connectService';
import { X, Calendar, Clock, Sparkles } from 'lucide-react';

interface AddFollowUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  ownerUserId: string;
  connectionId?: string | null;
  contactId?: string | null;
  defaultTargetName?: string;
  onFollowUpCreated: (followUp: FollowUp) => void;
}

export const AddFollowUpModal: React.FC<AddFollowUpModalProps> = ({
  isOpen,
  onClose,
  ownerUserId,
  connectionId,
  contactId,
  defaultTargetName = '',
  onFollowUpCreated,
}) => {
  const [targetName, setTargetName] = useState(defaultTargetName);
  const [title, setTitle] = useState('');
  const [dueAt, setDueAt] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().split('T')[0];
  });
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Follow-up title is required');
      return;
    }
    if (!dueAt) {
      setError('Due date is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const created = await createFollowUp({
        ownerUserId,
        connectionId: connectionId || null,
        contactId: contactId || null,
        targetName: targetName.trim() || 'Connection',
        title: title.trim(),
        dueAt,
        status: 'pending' as FollowUpStatus,
        notes: notes.trim() || undefined,
      });

      onFollowUpCreated(created);
      onClose();
    } catch (err: any) {
      console.error('Error creating follow-up:', err);
      setError(err.message || 'Failed to create follow-up');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-300 flex items-center justify-center font-bold">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Schedule Follow-Up</h3>
              <p className="text-[11px] text-slate-300">Action reminder for your relationship</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-3.5 overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium">
              {error}
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Contact / Connection Name
            </label>
            <input
              type="text"
              required
              value={targetName}
              onChange={(e) => setTargetName(e.target.value)}
              placeholder="e.g. Marcus Vance"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-teal-500 focus:bg-white transition"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Follow-Up Objective *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Send enterprise proposal & schedule demo"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-teal-500 focus:bg-white transition"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Target Due Date *
            </label>
            <input
              type="date"
              required
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-teal-500 focus:bg-white transition"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Action Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Context or preparation points..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-teal-500 focus:bg-white transition resize-none"
            />
          </div>

          <div className="pt-3 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold shadow-sm transition disabled:opacity-50"
            >
              {loading ? 'Scheduling...' : 'Set Follow-Up'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
