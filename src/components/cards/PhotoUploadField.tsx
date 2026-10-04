import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ImagePlus, Trash2, Upload } from 'lucide-react';
import { validateImageBytes } from '../../services/storageService';

// ============================================================================
// Profile photo picker (Directive 31)
// ============================================================================
// Replaces the "Profile Photo URL" text box. The chosen file is checked in the
// browser (size, type, magic bytes) and kept in memory; the caller uploads it
// through the uploadAsset callable once the employee exists, which stores it
// under companies/{companyId}/employees/{employeeId}/ (storage.rules deny
// direct client writes).

export interface PhotoValue {
  /** Photo already saved on the employee ('' = none). */
  url: string;
  /** Newly chosen file waiting to be uploaded. */
  file: File | null;
}

interface PhotoUploadFieldProps {
  value: PhotoValue;
  onChange: (next: PhotoValue) => void;
  disabled?: boolean;
}

export const PhotoUploadField: React.FC<PhotoUploadFieldProps> = ({ value, onChange, disabled }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const filePreview = useMemo(() => (value.file ? URL.createObjectURL(value.file) : null), [value.file]);
  useEffect(() => () => {
    if (filePreview) URL.revokeObjectURL(filePreview);
  }, [filePreview]);
  const preview = filePreview || value.url;

  const choose = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const check = await validateImageBytes(file);
    if (!check.valid) {
      setError(check.reason || 'This file cannot be used as a photo.');
      return;
    }
    setError(null);
    onChange({ url: value.url, file });
  };

  return (
    <div data-testid="photo-upload-field">
      <label className="block font-medium text-slate-700 mb-1">Profile Photo</label>
      <div className="flex items-center gap-3">
        {preview ? (
          <img src={preview} alt="Profile photo preview" data-testid="photo-preview" className="w-16 h-16 rounded-2xl object-cover border border-slate-200" />
        ) : (
          <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-dashed border-slate-300 flex items-center justify-center text-slate-400">
            <ImagePlus className="w-5 h-5" />
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            data-testid="photo-file-input"
            onChange={choose}
            disabled={disabled}
          />
          <button
            type="button"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold disabled:opacity-50"
          >
            <Upload className="w-3.5 h-3.5 mr-1.5" /> {preview ? 'Change Photo' : 'Upload Photo'}
          </button>
          {preview && (
            <button
              type="button"
              disabled={disabled}
              data-testid="photo-remove"
              onClick={() => {
                setError(null);
                onChange({ url: '', file: null });
              }}
              className="inline-flex items-center px-3 py-2 rounded-xl border border-slate-200 hover:bg-rose-50 text-rose-700 font-semibold disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Remove Photo
            </button>
          )}
        </div>
      </div>
      <span className="text-[10px] text-slate-400 mt-1 block">JPEG, PNG or WEBP, up to 5 MB.{value.file ? ' Uploads when you save.' : ''}</span>
      {error && <span className="text-[11px] text-rose-700 mt-1 block" role="alert">{error}</span>}
    </div>
  );
};
