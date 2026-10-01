import React, { useState } from 'react';
import { Employee, Company, SharedInfoCategory, ExchangeMethod } from '../../types';
import { createConnectionRequest } from '../../services/connectService';
import { X, UserPlus, CheckCircle, Shield, Sparkles } from 'lucide-react';

interface ExchangeContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee;
  company?: Company;
}

export const ExchangeContactModal: React.FC<ExchangeContactModalProps> = ({
  isOpen,
  onClose,
  employee,
  company,
}) => {
  const [name, setName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [myCompany, setMyCompany] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [sharedCategories, setSharedCategories] = useState<SharedInfoCategory[]>([
    'profile',
    'company',
    'job_title',
    'phone',
    'email',
  ]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const toggleCategory = (cat: SharedInfoCategory) => {
    if (sharedCategories.includes(cat)) {
      setSharedCategories(sharedCategories.filter((c) => c !== cat));
    } else {
      setSharedCategories([...sharedCategories, cat]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please provide your name');
      return;
    }
    if (!email.trim() && !phone.trim()) {
      setError('Please provide at least an email address or phone number');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const visitorUserId = `visitor_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      await createConnectionRequest({
        requesterUserId: visitorUserId,
        recipientUserId: null, // Will match employeeId on recipient side
        requesterIdentityId: visitorUserId,
        recipientIdentityId: employee.id,
        requesterName: name.trim(),
        requesterTitle: jobTitle.trim() || undefined,
        requesterCompany: myCompany.trim() || undefined,
        requesterEmail: email.trim() || undefined,
        requesterPhone: phone.trim() || undefined,
        requesterCompanyId: null,
        recipientCompanyId: employee.companyId,
        status: 'pending',
        initiatedBy: visitorUserId,
        exchangeMethod: 'card_exchange' as ExchangeMethod,
        consentState: 'requested',
        sharedCategories,
        initialNote: note.trim() || undefined,
      });

      setSuccess(true);
    } catch (err: any) {
      console.error('Error submitting connection request:', err);
      setError(err.message || 'Failed to submit connection request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-300 flex items-center justify-center font-bold">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Connect with {employee.displayName}</h3>
              <p className="text-[11px] text-slate-300">
                {employee.designation} {company?.name ? `• ${company.name}` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto">
          {success ? (
            <div className="text-center py-6">
              <div className="w-14 h-14 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8" />
              </div>
              <h4 className="text-base font-bold text-slate-900">Connection Request Sent!</h4>
              <p className="text-xs text-slate-600 mt-2 max-w-sm mx-auto leading-relaxed">
                Your professional contact details and intentional connection request have been shared with{' '}
                <span className="font-semibold text-slate-800">{employee.displayName}</span>. They will be notified in their DSBC Connect inbox.
              </p>
              <button
                onClick={onClose}
                className="mt-6 px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition shadow-sm"
              >
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="p-3 bg-teal-50/70 border border-teal-200/80 rounded-2xl flex items-start space-x-2.5 text-teal-900 text-xs">
                <Shield className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <span className="font-bold">Two-Way Professional Identity Exchange</span>: Share your contact details to establish an authenticated relationship.
                </div>
              </div>

              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Your Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Sarah Jenkins"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-teal-500 focus:bg-white transition"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Your Company
                  </label>
                  <input
                    type="text"
                    value={myCompany}
                    onChange={(e) => setMyCompany(e.target.value)}
                    placeholder="e.g. Vertex Ventures"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-teal-500 focus:bg-white transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Your Designation
                  </label>
                  <input
                    type="text"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="e.g. Head of Partnerships"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-teal-500 focus:bg-white transition"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Work Email *
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="sarah@vertex.io"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-teal-500 focus:bg-white transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Phone / WhatsApp
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 234-5678"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-teal-500 focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Introduction Note (Optional)
                </label>
                <textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Great meeting you at the Fintech Summit today! Looking forward to discussing procurement."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-teal-500 focus:bg-white transition resize-none"
                />
              </div>

              {/* Consent & Granular Sharing */}
              <div className="pt-2 border-t border-slate-200">
                <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Granular Information Consent
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(['profile', 'company', 'job_title', 'phone', 'email', 'website'] as SharedInfoCategory[]).map(
                    (cat) => (
                      <label
                        key={cat}
                        className="flex items-center space-x-2 text-xs text-slate-600 bg-slate-50 p-2 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-100 transition"
                      >
                        <input
                          type="checkbox"
                          checked={sharedCategories.includes(cat)}
                          onChange={() => toggleCategory(cat)}
                          className="rounded text-teal-600 focus:ring-teal-500"
                        />
                        <span className="capitalize">{cat.replace('_', ' ')}</span>
                      </label>
                    )
                  )}
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold shadow-sm transition flex items-center space-x-1.5 disabled:opacity-50"
                >
                  {loading ? (
                    <span>Sending Request...</span>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4 mr-1" />
                      <span>Send Connection Request</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
