import React, { useState } from 'react';
import { FEATURE_CATALOGUE } from '../../services/entitlementService';
import { FeatureDefinition, FeatureCategory } from '../../types/entitlement';
import {
  Search,
  Filter,
  Layers,
  Sparkles,
  User,
  Building2,
  Lock,
  CheckCircle,
  Hash,
  Tag,
} from 'lucide-react';

export const SaaSFeatureCatalogueTab: React.FC = () => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const filteredFeatures = FEATURE_CATALOGUE.filter((f) => {
    const matchSearch =
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      f.id.toLowerCase().includes(search.toLowerCase()) ||
      f.description.toLowerCase().includes(search.toLowerCase());

    const matchCategory =
      selectedCategory === 'all' ||
      f.category === selectedCategory ||
      (selectedCategory === 'ai' && f.badge === 'AI');

    return matchSearch && matchCategory;
  });

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Header & Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Feature Registry Catalogue</h2>
          <p className="text-xs text-slate-500">
            Stable platform capability definitions, quota types, and scope boundaries.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search features by name or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
            />
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-hidden font-medium"
          >
            <option value="all">All Categories ({FEATURE_CATALOGUE.length})</option>
            <option value="individual">Individual Scope</option>
            <option value="company">Company Scope</option>
            <option value="ai">AI Features</option>
          </select>
        </div>
      </div>

      {/* Feature List Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-500 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Feature Name & Stable ID</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4">Scope</th>
                <th className="py-3 px-4">Default State</th>
                <th className="py-3 px-4">Limit Unit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredFeatures.map((feat) => (
                <tr key={feat.id} className="hover:bg-slate-50/70 transition">
                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
                        {feat.scope === 'individual' ? (
                          <User className="w-4 h-4 text-teal-600" />
                        ) : (
                          <Building2 className="w-4 h-4 text-indigo-600" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-slate-900">{feat.name}</span>
                          {feat.badge && (
                            <span className="px-1.5 py-0.2 bg-teal-50 text-teal-700 border border-teal-200 rounded text-[9px] font-bold">
                              {feat.badge}
                            </span>
                          )}
                        </div>
                        <span className="font-mono text-[10px] text-slate-400 block mt-0.5">
                          {feat.id}
                        </span>
                      </div>
                    </div>
                  </td>

                  <td className="py-3 px-4 text-slate-600 max-w-sm">
                    {feat.description}
                  </td>

                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                        feat.scope === 'individual'
                          ? 'bg-teal-50 text-teal-700 border border-teal-200'
                          : feat.scope === 'company'
                          ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                          : 'bg-purple-50 text-purple-700 border border-purple-200'
                      }`}
                    >
                      {feat.scope}
                    </span>
                  </td>

                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                        feat.defaultEntitlement === 'ENABLED'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : feat.defaultEntitlement === 'LIMITED'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      {feat.defaultEntitlement}
                      {feat.defaultLimit !== undefined && ` (${feat.defaultLimit})`}
                    </span>
                  </td>

                  <td className="py-3 px-4">
                    {feat.limitUnit ? (
                      <span className="font-mono text-[10px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                        {feat.limitUnit}
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
