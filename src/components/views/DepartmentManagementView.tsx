import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Department, Employee } from '../../types';
import {
  getDepartmentsByCompany,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} from '../../services/departmentService';
import { getEmployeesByCompany } from '../../services/employeeService';
import {
  FolderTree,
  Plus,
  Users,
  Edit2,
  Trash2,
  CheckCircle2,
  Ban,
  UserCheck,
  X,
} from 'lucide-react';

export const DepartmentManagementView: React.FC = () => {
  const { activeCompany } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);

  // Form
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [headEmployeeId, setHeadEmployeeId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    if (!activeCompany) return;
    setLoading(true);
    try {
      const [deptList, empList] = await Promise.all([
        getDepartmentsByCompany(activeCompany.id),
        getEmployeesByCompany(activeCompany.id),
      ]);
      setDepartments(deptList);
      setEmployees(empList);
    } catch (err) {
      console.error('Failed to load departments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeCompany?.id]);

  const handleOpenAddModal = () => {
    setName('');
    setDescription('');
    setHeadEmployeeId('');
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (dept: Department) => {
    setEditingDept(dept);
    setName(dept.name);
    setDescription(dept.description);
    setHeadEmployeeId(dept.departmentHeadEmployeeId || '');
  };

  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCompany || !name.trim()) return;

    setSubmitting(true);
    try {
      const newDept = await createDepartment({
        companyId: activeCompany.id,
        name: name.trim(),
        description: description.trim(),
        departmentHeadEmployeeId: headEmployeeId || null,
        status: 'active',
      });

      setDepartments((prev) => [...prev, newDept].sort((a, b) => a.name.localeCompare(b.name)));
      setIsAddModalOpen(false);
    } catch (err: any) {
      console.error('Failed to create department:', err);
      alert(err.message || 'Error creating department');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDept) return;

    setSubmitting(true);
    try {
      const updates = {
        name: name.trim(),
        description: description.trim(),
        departmentHeadEmployeeId: headEmployeeId || null,
      };
      await updateDepartment(editingDept.id, updates);

      setDepartments((prev) =>
        prev
          .map((d) => (d.id === editingDept.id ? { ...d, ...updates } : d))
          .sort((a, b) => a.name.localeCompare(b.name))
      );
      setEditingDept(null);
    } catch (err: any) {
      console.error('Failed to update department:', err);
      alert(err.message || 'Error updating department');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (dept: Department) => {
    const newStatus = dept.status === 'active' ? 'inactive' : 'active';
    try {
      await updateDepartment(dept.id, { status: newStatus });
      setDepartments((prev) =>
        prev.map((d) => (d.id === dept.id ? { ...d, status: newStatus } : d))
      );
    } catch (err) {
      console.error('Failed to toggle department status:', err);
    }
  };

  const handleDelete = async (dept: Department) => {
    const assignedCount = employees.filter((e) => e.departmentId === dept.id).length;
    if (assignedCount > 0) {
      alert(
        `Cannot remove department "${dept.name}" because ${assignedCount} employee(s) are currently assigned to it. Please reassign them first.`
      );
      return;
    }

    if (!confirm(`Are you sure you want to remove department "${dept.name}"?`)) return;

    try {
      await deleteDepartment(dept.id);
      setDepartments((prev) => prev.filter((d) => d.id !== dept.id));
    } catch (err) {
      console.error('Failed to delete department:', err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Departments</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Organize company structure, team divisions, and department leadership.
          </p>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="inline-flex items-center px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-sm transition self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 mr-1.5" /> Add Department
        </button>
      </div>

      {/* Department Cards Grid */}
      {loading ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
          <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs text-slate-400 mt-2">Loading departments...</p>
        </div>
      ) : departments.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
          <FolderTree className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-slate-800">No departments yet</h3>
          <p className="text-xs text-slate-500 mt-1">
            Create departments to organize your employees and directory.
          </p>
          <button
            onClick={handleOpenAddModal}
            className="mt-4 inline-flex items-center px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> Add Department
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {departments.map((dept) => {
            const assignedMembers = employees.filter((e) => e.departmentId === dept.id);
            const head = employees.find((e) => e.id === dept.departmentHeadEmployeeId);

            return (
              <div
                key={dept.id}
                className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between hover:border-slate-300 transition"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{dept.name}</h3>
                      <span className="text-[10px] text-slate-400 font-mono">ID: {dept.id}</span>
                    </div>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        dept.status === 'active'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {dept.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  {dept.description && (
                    <p className="text-xs text-slate-600 mt-2 line-clamp-2 leading-relaxed">
                      {dept.description}
                    </p>
                  )}

                  {head && (
                    <div className="mt-3.5 p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center space-x-2 text-xs">
                      <UserCheck className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                      <div className="truncate">
                        <span className="text-[10px] text-slate-400 block uppercase font-semibold">
                          Department Head
                        </span>
                        <span className="font-semibold text-slate-800">{head.displayName}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium inline-flex items-center">
                    <Users className="w-3.5 h-3.5 mr-1 text-slate-400" />
                    {assignedMembers.length} {assignedMembers.length === 1 ? 'member' : 'members'}
                  </span>

                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => handleOpenEditModal(dept)}
                      className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
                      title="Edit"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleToggleStatus(dept)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition ${
                        dept.status === 'active'
                          ? 'text-slate-500 hover:text-amber-700'
                          : 'text-emerald-700 bg-emerald-50'
                      }`}
                    >
                      {dept.status === 'active' ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={() => handleDelete(dept)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 transition"
                      title="Remove"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Department Modal */}
      {(isAddModalOpen || editingDept) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">
                {editingDept ? 'Edit Department' : 'Create New Department'}
              </h3>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingDept(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={editingDept ? handleUpdateDepartment : handleCreateDepartment}
              className="p-6 space-y-4 text-xs"
            >
              <div>
                <label className="block font-medium text-slate-700 mb-1">Department Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sales, Marketing, Customer Success"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Mission / Description</label>
                <textarea
                  rows={2}
                  placeholder="Mandate and organizational functions..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Department Head (Optional)
                </label>
                <select
                  value={headEmployeeId}
                  onChange={(e) => setHeadEmployeeId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">-- No Department Head Assigned --</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.displayName} ({e.designation})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingDept(null);
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
                  {submitting ? 'Saving...' : editingDept ? 'Update Department' : 'Create Department'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
