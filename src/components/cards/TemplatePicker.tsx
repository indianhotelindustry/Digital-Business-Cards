import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { Card, Company, Employee } from '../../types';
import { TEMPLATE_REGISTRY } from '../../types/cardProfile';
import { PublicCardView } from './PublicCardView';

// ============================================================================
// Card design picker (Directive 31)
// ============================================================================
// Step 1 of card creation: the customer sees the three real DSBC templates
// (rendered by the unchanged PublicCardView) and must pick one explicitly.
// Preview data lives only in memory: nothing is read from or written to
// Firestore (profileOverride=null skips the profile fetch, interactive=false
// skips analytics).

export type CardTemplateId = Card['templateId'];
export const CARD_TEMPLATE_IDS: CardTemplateId[] = ['classic', 'modern', 'minimal'];

const PREVIEW_WIDTH = 448; // PublicCardView's max-w-md
const PREVIEW_SCALE = 0.62;

function previewEmployee(companyId: string): Employee {
  const now = new Date().toISOString();
  return {
    id: 'template_preview_employee',
    companyId,
    departmentId: null,
    firstName: 'Your',
    lastName: 'Name',
    displayName: 'Your Name',
    designation: 'Job Title',
    email: 'name@company.com',
    phone: '+91 90000 00000',
    whatsapp: '+91 90000 00000',
    bio: 'A short professional introduction appears here.',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };
}

function previewCard(templateId: CardTemplateId, companyId: string): Card {
  const now = new Date().toISOString();
  return {
    id: `template_preview_${templateId}`,
    companyId,
    employeeId: 'template_preview_employee',
    templateId,
    publicSlug: 'your-name',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };
}

interface TemplatePickerProps {
  company?: Company | null;
  selected: CardTemplateId | null;
  onSelect: (id: CardTemplateId) => void;
}

export const TemplatePicker: React.FC<TemplatePickerProps> = ({ company, selected, onSelect }) => {
  const companyId = company?.id || 'template_preview_company';
  const employee = previewEmployee(companyId);
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4" role="radiogroup" aria-label="Card design">
      {CARD_TEMPLATE_IDS.map((id) => {
        const isSelected = selected === id;
        return (
          <div
            key={id}
            role="radio"
            tabIndex={0}
            aria-checked={isSelected}
            aria-label={`${id} card design`}
            data-testid={`template-option-${id}`}
            onClick={() => onSelect(id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(id);
              }
            }}
            className={`cursor-pointer text-left rounded-2xl border-2 p-3 transition bg-white ${
              isSelected ? 'border-teal-600 ring-4 ring-teal-500/20' : 'border-slate-200 hover:border-slate-400'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-slate-900 capitalize">{id}</span>
              {isSelected ? (
                <span className="inline-flex items-center text-[10px] font-bold text-teal-700">
                  <CheckCircle2 className="w-4 h-4 mr-1" /> Selected
                </span>
              ) : (
                <span className="text-[10px] font-semibold text-slate-500">Select</span>
              )}
            </div>
            <div className="text-[10px] text-slate-500 mb-2">{TEMPLATE_REGISTRY[id]?.name}</div>
            <div
              className="relative mx-auto overflow-hidden rounded-xl bg-slate-100 pointer-events-none"
              style={{ width: PREVIEW_WIDTH * PREVIEW_SCALE, height: 360 }}
              aria-hidden="true"
            >
              <div style={{ width: PREVIEW_WIDTH, transform: `scale(${PREVIEW_SCALE})`, transformOrigin: 'top left' }}>
                <PublicCardView
                  card={previewCard(id, companyId)}
                  employee={employee}
                  company={company || undefined}
                  department={null}
                  profileOverride={null}
                  interactive={false}
                />
              </div>
            </div>
            <div className="text-[10px] text-slate-400 mt-2 text-center">Sample preview, not saved</div>
          </div>
        );
      })}
    </div>
  );
};
