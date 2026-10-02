import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useEntitlement } from '../../context/EntitlementContext';
import { Employee, Department, Card, CardTemplate } from '../../types';
import {
  getEmployeesByCompany,
  createEmployee,
  updateEmployee,
  setEmployeeStatus,
} from '../../services/employeeService';
import { getDepartmentsByCompany } from '../../services/departmentService';
import { getCardById, getCardTemplates, updateCard } from '../../services/cardService';
import { PublishingPanel } from '../publishing/PublishingPanel';
import {
  Users,
  Search,
  Plus,
  Edit2,
  Share2,
  ExternalLink,
  Ban,
  CheckCircle2,
  Filter,
  CreditCard,
  QrCode,
  UserCheck,
  X,
  Sparkles,
} from 'lucide-react';
import { ShareCardModal } from '../ShareCardModal';

interface EmployeeManagementViewProps {
  onNavigateToCard?: (slug: string) => void;
}

export const EmployeeManagementView: React.FC<EmployeeManagementViewProps> = ({
  onNavigateToCard,
}) => {
  const { activeCompany } = useAuth();
  const { checkLimit, getUsage, openUpgradeModal, plans } = useEntitlement();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [templates, setTemplates] = useState<CardTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  // Quota & Seat calculation
  const seatUsage = getUsage('company.team_members');
  const currentPlan = plans.find((p) => p.id === activeCompany?.planId);
  const seatLimit = seatUsage.limit ?? 3;
  const remainingSeats = Math.max(0, seatLimit - employees.length);
  const isAtSeatLimit = employees.length >= seatLimit;

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [shareModalEmp, setShareModalEmp] = useState<{ emp: Employee; slug: string } | null>(null);
  const [publishingEmp, setPublishingEmp] = useState<Employee | null>(null);

  // Form State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [designation, setDesignation] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [bio, setBio] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [website, setWebsite] = useState('');
  const [profilePhotoUrl, setProfilePhotoUrl] = useState('');
  const [cardTemplateId, setCardTemplateId] = useState<'classic' | 'modern' | 'minimal'>('classic');
  const [customSlug, setCustomSlug] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    if (!activeCompany) return;
    setLoading(true);
    try {
      const [empList, deptList, tplList] = await Promise.all([
        getEmployeesByCompany(activeCompany.id),
        getDepartmentsByCompany(activeCompany.id),
        getCardTemplates(),
      ]);
      setEmployees(empList);
      setDepartments(deptList);
      setTemplates(tplList);
    } catch (err) {
      console.error('Error loading employee directory:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeCompany?.id]);

  const handleOpenAddModal = () => {
    if (isAtSeatLimit && !checkLimit('company.team_members', 1)) {
      openUpgradeModal('company.team_members');
      return;
    }
    setFirstName('');
    setLastName('');
    setDesignation('');
    setEmail('');
    setPhone('');
    setWhatsapp('');
    setDepartmentId('');
    setBio('');
    setLinkedin('');
    setWebsite('');
    setProfilePhotoUrl('');
    setCardTemplateId('classic');
    setCustomSlug('');
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (emp: Employee) => {
    setEditingEmployee(emp);
    setFirstName(emp.firstName || '');
    setLastName(emp.lastName || '');
    setDesignation(emp.designation || '');
    setEmail(emp.email || '');
    setPhone(emp.phone || '');
    setWhatsapp(emp.whatsapp || '');
    setDepartmentId(emp.departmentId || '');
    setBio(emp.bio || '');
    setLinkedin(emp.linkedin || '');
    setWebsite(emp.website || '');
    setProfilePhotoUrl(emp.profilePhotoUrl || '');
    setCustomSlug('');
  };

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCompany || !firstName.trim() || !email.trim()) return;

    if (!checkLimit('company.team_members', 1)) {
      openUpgradeModal('company.team_members');
      setSubmitting(false);
      return;
    }

    setSubmitting(true);
    try {
      const displayName = `${firstName.trim()} ${lastName.trim()}`.trim();
      const result = await createEmployee(
        {
          companyId: activeCompany.id,
          departmentId: departmentId || null,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          displayName,
          designation: designation.trim() || 'Team Member',
          profilePhotoUrl: profilePhotoUrl.trim() || undefined,
          email: email.trim(),
          phone: phone.trim(),
          whatsapp: whatsapp.trim() || phone.trim(),
          bio: bio.trim(),
          linkedin: linkedin.trim(),
          website: website.trim(),
          status: 'active',
        },
        {
          cardTemplateId,
          customSlug: customSlug.trim() || undefined,
        }
      );

      setEmployees((prev) => [result.employee, ...prev]);
      setIsAddModalOpen(false);
    } catch (err: any) {
      console.error('Failed to create employee:', err);
      alert(`Error creating employee: ${err.message || 'Unknown error'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;

    setSubmitting(true);
    try {
      const displayName = `${firstName.trim()} ${lastName.trim()}`.trim();
      const updates: Partial<Employee> = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        displayName,
        designation: designation.trim(),
        email: email.trim(),
        phone: phone.trim(),
        whatsapp: whatsapp.trim() || phone.trim(),
        departmentId: departmentId || null,
        bio: bio.trim(),
        linkedin: linkedin.trim(),
        website: website.trim(),
        profilePhotoUrl: profilePhotoUrl.trim() || undefined,
      };

      await updateEmployee(editingEmployee.id, updates);

      // If template was selected, update card as well
      if (editingEmployee.cardId && cardTemplateId) {
        await updateCard(editingEmployee.cardId, { templateId: cardTemplateId });
      }

      setEmployees((prev) =>
        prev.map((emp) => (emp.id === editingEmployee.id ? { ...emp, ...updates } : emp))
      );
      setEditingEmployee(null);
    } catch (err: any) {
      console.error('Failed to update employee:', err);
      alert(`Error updating employee: ${err.message || 'Unknown error'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (emp: Employee) => {
    const newStatus = emp.status === 'active' ? 'inactive' : 'active';
    try {
      await setEmployeeStatus(emp.id, newStatus, emp.cardId);
      setEmployees((prev) =>
        prev.map((e) => (e.id === emp.id ? { ...e, status: newStatus } : e))
      );
    } catch (err) {
      console.error('Failed to toggle employee status:', err);
    }
  };

  const handleOpenShare = async (emp: Employee) => {
    let slug = emp.displayName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    if (emp.cardId) {
      try {
        const card = await getCardById(emp.cardId);
        if (card?.publicSlug) slug = card.publicSlug;
      } catch (e) {
        // fallback
      }
    }
    setShareModalEmp({ emp, slug });
  };

  // Filter logic
  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      emp.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.designation?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesDept = selectedDeptFilter === 'all' || emp.departmentId === selectedDeptFilter;
    const matchesStatus = selectedStatusFilter === 'all' || emp.status === selectedStatusFilter;

    return matchesSearch && matchesDept && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Employee Directory & Digital Cards
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage employee identities, department allocations, and persistent digital cards.
          </p>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="inline-flex items-center px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-sm transition self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 mr-1.5" /> Add Employee
        </button>
      </div>

      {/* Company Seat Management Banner (Requirement 18) */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold text-xs border border-teal-200">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-slate-900 text-xs">{currentPlan?.name || 'Company Plan'}</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                {employees.length} / {seatUsage.limit ?? '∞'} employees used
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {remainingSeats === 0
                ? 'Seat capacity reached. Upgrade plan to invite additional team members.'
                : `${remainingSeats} employee seat${remainingSeats === 1 ? '' : 's'} available on current tier.`}
            </p>
          </div>
        </div>

        <button
          onClick={() => openUpgradeModal('company.team_members')}
          className="px-3.5 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-xs font-bold transition flex items-center space-x-1.5 self-start sm:self-auto"
        >
          <Sparkles className="w-3.5 h-3.5 text-teal-600" />
          <span>{isAtSeatLimit ? 'Upgrade for More Seats' : 'Manage Seats'}</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, designation, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50/50"
          />
        </div>

        <div className="flex items-center space-x-2">
          {/* Department Filter */}
          <div className="flex items-center space-x-1 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedDeptFilter}
              onChange={(e) => setSelectedDeptFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-700 bg-white"
            >
              <option value="all">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <select
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value as any)}
            className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-700 bg-white"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>
      </div>

      {/* Employee Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-xs text-slate-400 mt-2">Loading employee profiles...</p>
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-slate-800">No employees match criteria</h3>
            <p className="text-xs text-slate-500 mt-1">
              Add a new employee or adjust your search filters above.
            </p>
            <button
              onClick={handleOpenAddModal}
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
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredEmployees.map((emp) => {
                  const dept = departments.find((d) => d.id === emp.departmentId);
                  return (
                    <tr key={emp.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center space-x-3">
                          {emp.profilePhotoUrl ? (
                            <img
                              src={emp.profilePhotoUrl}
                              alt={emp.displayName}
                              className="w-9 h-9 rounded-xl object-cover border border-slate-200"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-xs border border-slate-200">
                              {emp.firstName?.[0] || 'E'}
                            </div>
                          )}
                          <div>
                            <span className="font-semibold text-slate-900 block">
                              {emp.displayName}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              ID: {emp.id.slice(0, 10)}...
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3.5 font-medium text-slate-800">{emp.designation}</td>

                      <td className="px-4 py-3.5">
                        {dept ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                            {dept.name}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Unassigned</span>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="text-[11px]">
                          <div className="text-slate-700 truncate max-w-[160px]">{emp.email}</div>
                          {emp.phone && <div className="text-slate-400 font-mono">{emp.phone}</div>}
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            emp.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {emp.status === 'active' ? (
                            <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
                          ) : (
                            <Ban className="w-3 h-3 mr-1 text-slate-400" />
                          )}
                          {emp.status === 'active' ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      <td className="px-5 py-3.5 text-right space-x-1">
                        <button
                          onClick={() => handleOpenShare(emp)}
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition inline-flex items-center"
                          title="View QR Code & Share"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                        </button>

                        {emp.cardId && (
                          <button
                            onClick={() => setPublishingEmp(emp)}
                            className="px-2 py-1 rounded-lg bg-teal-50 text-teal-700 hover:bg-teal-100 transition inline-flex items-center text-[10px] font-semibold"
                            title="Publish Card"
                            data-testid={`publish-card-${emp.id}`}
                          >
                            <ExternalLink className="w-3.5 h-3.5 mr-1" /> Publish
                          </button>
                        )}

                        <button
                          onClick={() => handleOpenEditModal(emp)}
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition inline-flex items-center"
                          title="Edit Profile"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleToggleStatus(emp)}
                          className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition ${
                            emp.status === 'active'
                              ? 'text-slate-500 hover:text-amber-700 hover:bg-amber-50'
                              : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                          }`}
                        >
                          {emp.status === 'active' ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Directive 26: publish an employee card through the backend */}
      {publishingEmp && publishingEmp.cardId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">Publish card: {publishingEmp.displayName}</h3>
              <button onClick={() => setPublishingEmp(null)} className="p-1.5 rounded-lg hover:bg-slate-200" aria-label="Close publishing">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4">
              <PublishingPanel
                entityType="card"
                entityId={publishingEmp.cardId}
                defaultSlug={publishingEmp.cardSlug || publishingEmp.displayName}
                title="Employee Card"
              />
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Employee Modal */}
      {(isAddModalOpen || editingEmployee) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">
                {editingEmployee ? 'Edit Employee Credentials' : 'Add New Employee'}
              </h3>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingEmployee(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={editingEmployee ? handleUpdateEmployee : handleCreateEmployee}
              className="p-6 overflow-y-auto space-y-4 text-xs"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Last Name</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Job Designation *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sales Manager"
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Department</label>
                  <select
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="">-- None / Unassigned --</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    placeholder="+1 (555) 000-0000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">WhatsApp</label>
                  <input
                    type="tel"
                    placeholder="+14150000000"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Profile Photo URL</label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={profilePhotoUrl}
                    onChange={(e) => setProfilePhotoUrl(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Short Bio</label>
                <textarea
                  rows={2}
                  placeholder="Professional brief, responsibilities, or tagline..."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">LinkedIn Profile</label>
                  <input
                    type="text"
                    placeholder="https://linkedin.com/in/..."
                    value={linkedin}
                    onChange={(e) => setLinkedin(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Website / Portfolio</label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              {/* Template Selection */}
              <div>
                <label className="block font-medium text-slate-700 mb-1.5">
                  Card Design Template
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['classic', 'modern', 'minimal'] as const).map((tpl) => (
                    <button
                      key={tpl}
                      type="button"
                      onClick={() => setCardTemplateId(tpl)}
                      className={`p-2.5 rounded-xl border text-center transition capitalize font-semibold ${
                        cardTemplateId === tpl
                          ? 'border-teal-600 bg-teal-50 text-teal-800 ring-2 ring-teal-500/20'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      {tpl}
                    </button>
                  ))}
                </div>
              </div>

              {!editingEmployee && (
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Custom Card Slug (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. rahul-sharma"
                    value={customSlug}
                    onChange={(e) => setCustomSlug(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono text-[11px]"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Public URL: /card/{customSlug || 'auto-generated'}
                  </span>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingEmployee(null);
                  }}
                  className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold shadow-sm disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : editingEmployee ? 'Update Employee' : 'Create & Generate Card'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Share & QR Modal */}
      {shareModalEmp && (
        <ShareCardModal
          isOpen={!!shareModalEmp}
          onClose={() => setShareModalEmp(null)}
          publicSlug={shareModalEmp.slug}
          employee={shareModalEmp.emp}
          company={activeCompany}
        />
      )}
    </div>
  );
};
