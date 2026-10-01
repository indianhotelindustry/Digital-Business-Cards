import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { AnalyticsEvent, Employee } from '../../types';
import { getAnalyticsByCompany } from '../../services/analyticsService';
import { getEmployeesByCompany } from '../../services/employeeService';
import {
  BarChart3,
  Eye,
  Bookmark,
  Phone,
  MessageSquare,
  Mail,
  Globe,
  TrendingUp,
  Users,
} from 'lucide-react';

export const CompanyAnalyticsView: React.FC = () => {
  const { activeCompany } = useAuth();
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      if (!activeCompany) return;
      setLoading(true);
      try {
        const [evts, emps] = await Promise.all([
          getAnalyticsByCompany(activeCompany.id),
          getEmployeesByCompany(activeCompany.id),
        ]);
        if (isMounted) {
          setEvents(evts);
          setEmployees(emps);
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to load analytics:', err);
        if (isMounted) setLoading(false);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, [activeCompany?.id]);

  const viewEvents = events.filter((e) => e.eventType === 'card_view');
  const saveEvents = events.filter((e) => e.eventType === 'save_contact');
  const phoneEvents = events.filter((e) => e.eventType === 'phone_click');
  const whatsappEvents = events.filter((e) => e.eventType === 'whatsapp_click');
  const emailEvents = events.filter((e) => e.eventType === 'email_click');

  // Employee breakdown
  const employeeStats = employees.map((emp) => {
    const empEvents = events.filter((e) => e.employeeId === emp.id);
    const views = empEvents.filter((e) => e.eventType === 'card_view').length;
    const saves = empEvents.filter((e) => e.eventType === 'save_contact').length;
    const interactions = empEvents.length - views;
    return {
      emp,
      views,
      saves,
      interactions,
      total: empEvents.length,
    };
  }).sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Card Telemetry & Engagement</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Real-time interaction telemetry recorded across public cards for {activeCompany?.name}.
        </p>
      </div>

      {/* Aggregate Metric Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Card Views</span>
            <Eye className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{viewEvents.length}</p>
          <span className="text-[10px] text-slate-400 mt-1 block">Total card displays</span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Contact Saves</span>
            <Bookmark className="w-4 h-4 text-teal-600" />
          </div>
          <p className="text-2xl font-bold text-teal-700 mt-2">{saveEvents.length}</p>
          <span className="text-[10px] text-slate-400 mt-1 block">vCard .vcf downloads</span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Phone Calls</span>
            <Phone className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{phoneEvents.length}</p>
          <span className="text-[10px] text-slate-400 mt-1 block">Direct dial actions</span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">WhatsApp</span>
            <MessageSquare className="w-4 h-4 text-green-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{whatsappEvents.length}</p>
          <span className="text-[10px] text-slate-400 mt-1 block">Direct chat triggers</span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Email Clicks</span>
            <Mail className="w-4 h-4 text-sky-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{emailEvents.length}</p>
          <span className="text-[10px] text-slate-400 mt-1 block">Mailto triggers</span>
        </div>
      </div>

      {/* Engagement per Employee Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Performance By Employee</h2>
            <p className="text-xs text-slate-500">Breakdown of impressions and conversions per cardholder</p>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-xs text-slate-400 mt-2">Computing telemetry aggregates...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-100">
                <tr>
                  <th className="px-5 py-3">Employee</th>
                  <th className="px-4 py-3">Designation</th>
                  <th className="px-4 py-3 text-center">Views</th>
                  <th className="px-4 py-3 text-center">Contact Saves</th>
                  <th className="px-4 py-3 text-center">Call / Chat Clicks</th>
                  <th className="px-5 py-3 text-right">Total Interactions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {employeeStats.map(({ emp, views, saves, interactions, total }) => (
                  <tr key={emp.id} className="hover:bg-slate-50/70 transition">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-xs">
                          {emp.firstName?.[0] || 'U'}
                        </div>
                        <span className="font-semibold text-slate-900">{emp.displayName}</span>
                      </div>
                    </td>

                    <td className="px-4 py-3.5 text-slate-600">{emp.designation}</td>

                    <td className="px-4 py-3.5 text-center font-semibold text-slate-800">
                      {views}
                    </td>

                    <td className="px-4 py-3.5 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-teal-50 text-teal-700">
                        {saves}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 text-center text-slate-600">
                      {interactions}
                    </td>

                    <td className="px-5 py-3.5 text-right font-mono font-bold text-slate-900">
                      {total}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
