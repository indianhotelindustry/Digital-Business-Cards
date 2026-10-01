import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Employee, Department, Card } from '../../types';
import { getEmployeesByCompany } from '../../services/employeeService';
import { getDepartmentsByCompany } from '../../services/departmentService';
import {
  Users,
  FolderTree,
  CreditCard,
  Plus,
  BookOpen,
  ArrowRight,
  TrendingUp,
  Share2,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { ShareCardModal } from '../ShareCardModal';

interface CompanyDashboardProps {
  setActiveView: (view: string) => void;
  onNavigateToCard?: (slug: string) => void;
}

export const CompanyDashboard: React.FC<CompanyDashboardProps> = ({
  setActiveView,
  onNavigateToCard,
}) => {
  const { activeCompany } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  // Quick share card modal for quick preview
  const [selectedShareEmp, setSelectedShareEmp] = useState<Employee | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadCompanyData() {
      if (!activeCompany) return;
      setLoading(true);
      try {
        const [empList, deptList] = await Promise.all([
          getEmployeesByCompany(activeCompany.id),
          getDepartmentsByCompany(activeCompany.id),
        ]);
        if (isMounted) {
          setEmployees(empList);
          setDepartments(deptList);
          setLoading(false);
        }
      } catch (err) {
        console.error('Error loading company dashboard data:', err);
        if (isMounted) setLoading(false);
      }
    }

    loadCompanyData();
    return () => {
      isMounted = false;
    };
  }, [activeCompany?.id]);

  if (!activeCompany) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
        <p className="text-xs text-slate-500">No active company tenant selected.</p>
      </div>
    );
  }

  const activeEmployees = employees.filter((e) => e.status === 'active');
  const activeDepartments = departments.filter((d) => d.status === 'active');

  return (
    <div className="space-y-6">
      {/* Warning banner if suspended */}
      {activeCompany.status === 'suspended' && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-start space-x-3 text-amber-900">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs">
            <h4 className="font-bold">Company Account Suspended</h4>
            <p className="mt-0.5 text-amber-700 leading-normal">
              This tenant has been suspended by the SaaS platform administrator. Public cards and
              administrative actions are restricted.
            </p>
          </div>
        </div>
      )}

      {/* Header Profile Card */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center space-x-4">
          {activeCompany.logoUrl ? (
            <img
              src={activeCompany.logoUrl}
              alt={activeCompany.name}
              className="w-16 h-16 rounded-2xl object-contain bg-slate-50 border border-slate-200 p-1.5 shadow-2xs"
            />
          ) : (
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-2xs"
              style={{ backgroundColor: activeCompany.branding.primaryColor || '#0f766e' }}
            >
              {activeCompany.name.charAt(0)}
            </div>
          )}

          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold text-slate-900">{activeCompany.name}</h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-50 text-teal-700 border border-teal-200">
                <ShieldCheck className="w-3 h-3 mr-1" /> Verified Tenant
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-xl line-clamp-1">
              {activeCompany.description || 'Enterprise Digital Business Cards Suite'}
            </p>
            <div className="flex items-center space-x-3 text-[11px] text-slate-400 mt-1.5 font-mono">
              <span>Tenant ID: {activeCompany.id}</span>
              <span>•</span>
              <span>Plan: {activeCompany.planId.toUpperCase()}</span>
            </div>
          </div>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setActiveView('company-employees')}
            className="inline-flex items-center px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Employee
          </button>
          <button
            onClick={() => setActiveView('company-departments')}
            className="inline-flex items-center px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition"
          >
            <FolderTree className="w-3.5 h-3.5 mr-1.5" /> Add Department
          </button>
          <button
            onClick={() => setActiveView('company-directory')}
            className="inline-flex items-center px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition"
          >
            <BookOpen className="w-3.5 h-3.5 mr-1.5" /> Directory
          </button>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => setActiveView('company-employees')}
          className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs cursor-pointer hover:border-slate-300 transition"
        >
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Total Employees
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900">{employees.length}</span>
            <Users className="w-5 h-5 text-teal-600" />
          </div>
          <span className="text-[10px] text-slate-500 mt-2 block">
            {activeEmployees.length} active in directory
          </span>
        </div>

        <div
          onClick={() => setActiveView('company-departments')}
          className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs cursor-pointer hover:border-slate-300 transition"
        >
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Departments
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900">{departments.length}</span>
            <FolderTree className="w-5 h-5 text-blue-600" />
          </div>
          <span className="text-[10px] text-slate-500 mt-2 block">
            {activeDepartments.length} operational units
          </span>
        </div>

        <div
          onClick={() => setActiveView('company-employees')}
          className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs cursor-pointer hover:border-slate-300 transition"
        >
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Active Digital Cards
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900">{activeEmployees.length}</span>
            <CreditCard className="w-5 h-5 text-indigo-600" />
          </div>
          <span className="text-[10px] text-emerald-600 mt-2 block font-medium">
            100% Mobile & QR Ready
          </span>
        </div>

        <div
          onClick={() => setActiveView('company-profile')}
          className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs cursor-pointer hover:border-slate-300 transition"
        >
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Brand Identity
          </span>
          <div className="mt-2 flex items-center space-x-2">
            <div
              className="w-5 h-5 rounded-full border border-slate-200 shadow-2xs"
              style={{ backgroundColor: activeCompany.branding.primaryColor || '#0f766e' }}
            ></div>
            <span className="text-xs font-semibold text-slate-800 capitalize">
              {activeCompany.branding.cardThemePreference || 'Classic'} Theme
            </span>
          </div>
          <span className="text-[10px] text-slate-400 mt-2 block font-mono">
            {activeCompany.branding.primaryColor}
          </span>
        </div>
      </div>

      {/* Recent Employees & Cards Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Recent Employee Business Cards</h2>
            <p className="text-xs text-slate-500">Live cards assigned to members of {activeCompany.name}</p>
          </div>
          <button
            onClick={() => setActiveView('company-employees')}
            className="text-xs font-semibold text-teal-700 hover:text-teal-800 inline-flex items-center"
          >
            View All Employees <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-xs text-slate-400 mt-2">Loading employee roster...</p>
          </div>
        ) : employees.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-slate-800">No employees yet</h3>
            <p className="text-xs text-slate-500 mt-1">
              Add your first employee to create their persistent digital business card and QR code.
            </p>
            <button
              onClick={() => setActiveView('company-employees')}
              className="mt-4 inline-flex items-center px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Employee
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-100">
                <tr>
                  <th className="px-5 py-3">Employee</th>
                  <th className="px-4 py-3">Designation</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Card Status</th>
                  <th className="px-5 py-3 text-right">Quick Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {employees.slice(0, 5).map((emp) => {
                  const dept = departments.find((d) => d.id === emp.departmentId);
                  return (
                    <tr key={emp.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center space-x-3">
                          {emp.profilePhotoUrl ? (
                            <img
                              src={emp.profilePhotoUrl}
                              alt={emp.displayName}
                              className="w-8 h-8 rounded-full object-cover border border-slate-200"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-xs">
                              {emp.firstName?.[0] || 'U'}
                            </div>
                          )}
                          <div>
                            <div className="font-semibold text-slate-900">{emp.displayName}</div>
                            <div className="text-[10px] text-slate-400">{emp.email}</div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-slate-700 font-medium">
                        {emp.designation || 'Staff'}
                      </td>

                      <td className="px-4 py-3.5 text-slate-600">
                        {dept?.name || <span className="text-slate-400 italic">Unassigned</span>}
                      </td>

                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            emp.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {emp.status === 'active' ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      <td className="px-5 py-3.5 text-right space-x-1.5">
                        <button
                          onClick={() => setSelectedShareEmp(emp)}
                          className="px-2 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-medium transition inline-flex items-center"
                          title="Share / QR"
                        >
                          <Share2 className="w-3 h-3 mr-1" /> QR
                        </button>
                        {onNavigateToCard && (
                          <button
                            onClick={() => onNavigateToCard(emp.displayName.toLowerCase().replace(/\s+/g, '-'))}
                            className="px-2 py-1 rounded-lg bg-teal-50 text-teal-700 hover:bg-teal-100 text-xs font-semibold transition inline-flex items-center"
                          >
                            <ExternalLink className="w-3 h-3 mr-1" /> Preview
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Share / QR Modal */}
      {selectedShareEmp && (
        <ShareCardModal
          isOpen={!!selectedShareEmp}
          onClose={() => setSelectedShareEmp(null)}
          publicSlug={selectedShareEmp.displayName.toLowerCase().replace(/[^a-z0-9]/g, '-')}
          employee={selectedShareEmp}
          company={activeCompany}
        />
      )}
    </div>
  );
};
