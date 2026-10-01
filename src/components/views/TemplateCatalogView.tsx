import React, { useEffect, useState } from 'react';
import { CardTemplate } from '../../types';
import { TEMPLATE_REGISTRY, TemplateDefinition } from '../../types/cardProfile';
import { getCardTemplates } from '../../services/cardService';
import { PublicCardView } from '../cards/PublicCardView';
import { INITIAL_DEMO_EMPLOYEES, INITIAL_DEMO_COMPANIES, INITIAL_DEMO_DEPARTMENTS, INITIAL_DEMO_PROFILES } from '../../services/demoStore';
import { CreditCard, Check, Sparkles, Layout, Layers, ShieldCheck, Eye, Smartphone } from 'lucide-react';

export const TemplateCatalogView: React.FC = () => {
  const [templates, setTemplates] = useState<CardTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewTemplate, setPreviewTemplate] = useState<'classic' | 'modern' | 'minimal'>('classic');

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const list = await getCardTemplates();
        setTemplates(list);
      } catch (e) {
        console.error('Error fetching card templates:', e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const sampleEmployee = INITIAL_DEMO_EMPLOYEES[0];
  const sampleCompany = INITIAL_DEMO_COMPANIES[0];
  const sampleDepartment = INITIAL_DEMO_DEPARTMENTS[0];
  const sampleProfile = INITIAL_DEMO_PROFILES[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">
          Digital Identity Card & Template Registry
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Controlled presentation templates consuming the unified Digital Identity Profile & Section Resolver framework.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 7 Columns: Template Registry Cards */}
        <div className="lg:col-span-7 space-y-4">
          {loading ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-slate-200">
              <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-xs text-slate-400 mt-2">Loading template definitions...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.values(TEMPLATE_REGISTRY).map((tpl: TemplateDefinition) => {
                const isSelected = previewTemplate === tpl.templateId;
                return (
                  <div
                    key={tpl.templateId}
                    className={`bg-white rounded-3xl p-6 border transition shadow-xs ${
                      isSelected
                        ? 'border-teal-600 ring-2 ring-teal-600/10'
                        : 'border-slate-200/80 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-100 shrink-0">
                          <Layout className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <h3 className="text-sm font-bold text-slate-900">{tpl.name}</h3>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                              v{tpl.version} Certified
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                            {tpl.description}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => setPreviewTemplate(tpl.templateId)}
                        className={`inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-semibold transition shrink-0 ${
                          isSelected
                            ? 'bg-teal-600 text-white shadow-xs'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                      >
                        <Eye className="w-3.5 h-3.5 mr-1" />
                        {isSelected ? 'Active Preview' : 'Preview'}
                      </button>
                    </div>

                    {/* Supported Section Badges */}
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                        Supported Identity Sections
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {tpl.supportedSections.map((sec) => (
                          <span
                            key={sec}
                            className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-medium"
                          >
                            {sec.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Architecture Guarantee */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                      <div className="flex items-center text-teal-700 font-medium text-[11px]">
                        <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                        <span>Pure Layout Renderer (Data Decoupled)</span>
                      </div>
                      <span className="font-mono text-[10px]">ID: {tpl.templateId}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right 5 Columns: Real-Time Preview */}
        <div className="lg:col-span-5 sticky top-20">
          <div className="bg-slate-900/90 text-white px-4 py-2.5 rounded-t-3xl text-xs font-semibold flex items-center justify-between">
            <span className="flex items-center">
              <Smartphone className="w-4 h-4 mr-2 text-teal-400" />
              Interactive Template Preview
            </span>
            <span className="text-[10px] text-teal-400 uppercase font-mono font-bold">
              {previewTemplate.toUpperCase()}
            </span>
          </div>

          <div className="bg-slate-100 p-4 rounded-b-3xl border border-slate-200/80 shadow-md">
            <PublicCardView
              card={{
                id: 'demo_preview_card',
                companyId: sampleCompany.id,
                employeeId: sampleEmployee.id,
                templateId: previewTemplate,
                publicSlug: 'preview-slug',
                status: 'active',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              }}
              employee={sampleEmployee}
              company={sampleCompany}
              department={sampleDepartment}
              profileOverride={sampleProfile}
              interactive={false}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
