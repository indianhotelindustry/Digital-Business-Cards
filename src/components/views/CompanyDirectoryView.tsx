import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Employee, Department } from '../../types';
import { getEmployeesByCompany } from '../../services/employeeService';
import { getDepartmentsByCompany } from '../../services/departmentService';
import {
  BookOpen,
  Search,
  Filter,
  Phone,
  Mail,
  ExternalLink,
  Share2,
  Building,
  Users,
} from 'lucide-react';
import { ShareCardModal } from '../ShareCardModal';

interface CompanyDirectoryViewProps {
  onNavigateToCard?: (slug: string) => void;
}

export const CompanyDirectoryView: React.FC<CompanyDirectoryViewProps> = ({
  onNavigateToCard,
}) => {
  const { activeCompany } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [shareEmp, setShareEmp] = useState<Employee | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadDirectory() {
      if (!activeCompany) return;
      setLoading(true);
      try {
        const [empList, deptList] = await Promise.all([
          getEmployeesByCompany(activeCompany.id),
          getDepartmentsByCompany(activeCompany.id),
        ]);
        if (isMounted) {
          // In directory, only show active employees
          setEmployees(empList.filter((e) => e.status === 'active'));
          setDepartments(deptList);
          setLoading(false);
        }
      } catch (err) {
        console.error('Error loading directory:', err);
        if (isMounted) setLoading(false);
      }
    }
    loadDirectory();
    return () => {
      isMounted = false;
    };
  }, [activeCompany?.id]);

  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      emp.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.designation?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesDept = selectedDept === 'all' || emp.departmentId === selectedDept;

    return matchesSearch && matchesDept;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Company Directory
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Verified colleague roster, contact coordinates, and public digital cards for {activeCompany?.name}.
          </p>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search colleagues by name, role, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50/50"
          />
        </div>

        <div className="flex items-center space-x-1.5 text-xs">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-700 bg-white"
          >
            <option value="all">All Departments ({employees.length})</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Cards Grid */}
      {loading ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
          <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs text-slate-400 mt-2">Loading verified directory...</p>
        </div>
      ) : filteredEmployees.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-slate-800">No members found</h3>
          <p className="text-xs text-slate-500 mt-1">Try refining your search keyword or department.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEmployees.map((emp) => {
            const dept = departments.find((d) => d.id === emp.departmentId);
            const slug = emp.displayName.toLowerCase().replace(/[^a-z0-9]/g, '-');

            return (
              <div
                key={emp.id}
                className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between hover:border-slate-300 transition"
              >
                <div>
                  <div className="flex items-start space-x-3.5">
                    {emp.profilePhotoUrl ? (
                      <img
                        src={emp.profilePhotoUrl}
                        alt={emp.displayName}
                        className="w-12 h-12 rounded-2xl object-cover border border-slate-200 shadow-2xs shrink-0"
                      />
                    ) : (
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-base shadow-2xs shrink-0"
                        style={{
                          backgroundColor: activeCompany?.branding.primaryColor || '#0f766e',
                        }}
                      >
                        {emp.firstName?.[0] || 'U'}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-bold text-slate-900 truncate">
                        {emp.displayName}
                      </h3>
                      <p className="text-xs font-semibold text-teal-700 truncate mt-0.5">
                        {emp.designation}
                      </p>
                      {dept && (
                        <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                          {dept.name}
                        </p>
                      )}
                    </div>
                  </div>

                  {emp.bio && (
                    <p className="text-xs text-slate-600 mt-3 line-clamp-2 leading-relaxed bg-slate-50/60 p-2 rounded-xl border border-slate-100">
                      {emp.bio}
                    </p>
                  )}

                  {/* Direct Contacts */}
                  <div className="mt-3.5 space-y-1.5 text-xs text-slate-600">
                    {emp.email && (
                      <div className="flex items-center space-x-2 truncate">
                        <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <a
                          href={`mailto:${emp.email}`}
                          className="hover:text-teal-700 truncate text-[11px]"
                        >
                          {emp.email}
                        </a>
                      </div>
                    )}
                    {emp.phone && (
                      <div className="flex items-center space-x-2">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <a
                          href={`tel:${emp.phone}`}
                          className="hover:text-teal-700 font-mono text-[11px]"
                        >
                          {emp.phone}
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Action Bar */}
                <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between">
                  <button
                    onClick={() => setShareEmp(emp)}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition inline-flex items-center text-xs font-medium"
                    title="View QR Code & Share"
                  >
                    <Share2 className="w-3.5 h-3.5 mr-1" /> QR
                  </button>

                  {onNavigateToCard && (
                    <button
                      onClick={() => onNavigateToCard(slug)}
                      className="px-3 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-semibold transition inline-flex items-center"
                    >
                      Digital Card <ExternalLink className="w-3 h-3 ml-1" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Share Modal */}
      {shareEmp && (
        <ShareCardModal
          isOpen={!!shareEmp}
          onClose={() => setShareEmp(null)}
          publicSlug={shareEmp.displayName.toLowerCase().replace(/[^a-z0-9]/g, '-')}
          employee={shareEmp}
          company={activeCompany}
        />
      )}
    </div>
  );
};
