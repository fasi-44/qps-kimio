'use client';

import { useState, useRef, useCallback } from 'react';
import { UploadCloud, FileText, X, Loader2, ExternalLink } from 'lucide-react';
import { api, ApiError, fileUrl, fileName } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const DEFAULT_ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.webp,.csv,.txt';
const DEFAULT_MAX_MB = 10;

interface UploadResult { url: string; name: string; size: number; mime: string }

/**
 * Drag-and-drop document uploader. Uploads each file to POST /uploads and
 * tracks the resulting URLs as a string[] (the value). Reused for agenda,
 * attendance, minutes and action-item evidence.
 */
export function FileUpload({
  value,
  onChange,
  multiple = true,
  accept = DEFAULT_ACCEPT,
  maxSizeMb = DEFAULT_MAX_MB,
  disabled = false,
}: {
  value: string[];
  onChange: (urls: string[]) => void;
  multiple?: boolean;
  accept?: string;
  maxSizeMb?: number;
  disabled?: boolean;
}) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0 || disabled) return;
    const list = multiple ? Array.from(files) : [files[0]];
    const uploaded: string[] = [];
    setUploading((n) => n + list.length);
    for (const file of list) {
      if (file.size > maxSizeMb * 1024 * 1024) {
        toast.error('File too large', `${file.name} exceeds ${maxSizeMb} MB`);
        setUploading((n) => n - 1);
        continue;
      }
      try {
        const form = new FormData();
        form.append('file', file);
        const res = await api.upload<UploadResult>('/uploads', form);
        uploaded.push(res.url);
      } catch (e) {
        toast.error('Upload failed', e instanceof ApiError ? e.message : file.name);
      } finally {
        setUploading((n) => n - 1);
      }
    }
    if (uploaded.length) onChange(multiple ? [...value, ...uploaded] : [uploaded[uploaded.length - 1]]);
  }, [value, onChange, multiple, maxSizeMb, disabled]);

  const remove = (url: string) => onChange(value.filter((u) => u !== url));

  return (
    <div className="space-y-2">
      <div
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
        onDragLeave={(e) => { e.preventDefault(); setDragging(false); }}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
        className={cn(
          'flex flex-col items-center justify-center gap-1.5 px-4 py-6 rounded-xl border border-dashed cursor-pointer transition-all text-center bg-brand-teal/[0.06]',
          disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-brand-teal/40 hover:bg-brand-teal/10',
          dragging ? 'border-brand-teal/60 bg-brand-teal/15' : 'border-brand-teal/20',
        )}
      >
        <UploadCloud className={cn('w-6 h-6', dragging ? 'text-brand-teal' : 'text-slate-500')} />
        <p className="text-sm font-medium" style={{ color: 'var(--text-base)' }}>
          <span className="text-brand-teal">Click to upload</span> or drag &amp; drop
        </p>
        <p className="text-[0.7rem] text-slate-500">PDF, Office docs or images · up to {maxSizeMb} MB</p>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          className="hidden"
          onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
        />
      </div>

      {uploading > 0 && (
        <p className="flex items-center gap-2 text-xs text-slate-500">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading {uploading} file{uploading === 1 ? '' : 's'}…
        </p>
      )}

      {value.length > 0 && (
        <ul className="space-y-1.5">
          {value.map((url) => (
            <li
              key={url}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-white/[0.04] border border-white/8"
            >
              <FileText className="w-4 h-4 shrink-0 text-brand-teal" />
              <a
                href={fileUrl(url)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex-1 min-w-0 truncate hover:underline"
                style={{ color: 'var(--text-base)' }}
                title={fileName(url)}
              >
                {fileName(url)}
              </a>
              <a
                href={fileUrl(url)}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 rounded text-slate-500 hover:text-brand-teal shrink-0"
                title="Open"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => remove(url)}
                  className="p-1 rounded text-slate-500 hover:text-red-400 shrink-0"
                  title="Remove"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
