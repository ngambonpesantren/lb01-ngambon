import React, { useEffect, useRef, useState } from 'react';
import { ArrowDownUp, ArrowDown, ArrowUp, Check } from 'lucide-react';

export type SortKey = 'points' | 'name' | 'newest' | 'oldest';

export interface SortOption {
  value: SortKey;
  label: string;
  /** Direction icon hint used in the trigger button. */
  direction?: 'asc' | 'desc';
}

export const DEFAULT_SORT_OPTIONS: SortOption[] = [
  { value: 'points', label: 'Points (high → low)', direction: 'desc' },
  { value: 'name', label: 'Name (A → Z)', direction: 'asc' },
  { value: 'newest', label: 'Newest first', direction: 'desc' },
  { value: 'oldest', label: 'Oldest first', direction: 'asc' },
];

interface Props {
  value: SortKey;
  onChange: (next: SortKey) => void;
  options?: SortOption[];
  variant?: 'light' | 'dark';
  className?: string;
}

export function StudentSortDropdown({
  value,
  onChange,
  options = DEFAULT_SORT_OPTIONS,
  variant = 'light',
  className = '',
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const current = options.find((o) => o.value === value) || options[0];
  const isDark = variant === 'dark';

  const btnCls = isDark
    ? 'w-full sm:w-auto min-h-11 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border border-base-50/20 bg-base-900/30 text-base-50 hover:bg-base-900/50 backdrop-blur-md text-sm font-bold transition-all whitespace-nowrap'
    : 'w-full sm:w-auto min-h-11 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border border-base-200 bg-base-100 text-text-main hover:border-primary-300 text-sm font-bold transition-all whitespace-nowrap';

  const DirIcon = current.direction === 'asc' ? ArrowUp : current.direction === 'desc' ? ArrowDown : ArrowDownUp;

  return (
    <div className={`relative min-w-0 ${className}`} ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)} className={btnCls}>
        <ArrowDownUp className="h-4 w-4 opacity-70 shrink-0" />
        <span className="hidden sm:inline">Sort:</span>
        <span className="truncate">{current.label.split(' (')[0]}</span>
        <DirIcon className="h-3.5 w-3.5 opacity-70 shrink-0" />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-[min(15rem,calc(100vw-2rem))] bg-base-100 border border-base-200 rounded-2xl shadow-2xl z-50 p-2">
          <div className="text-[10px] font-black uppercase tracking-widest text-text-light px-3 pt-1 pb-2">
            Sort by
          </div>
          {options.map((opt) => {
            const active = opt.value === value;
            const Icon = opt.direction === 'asc' ? ArrowUp : opt.direction === 'desc' ? ArrowDown : ArrowDownUp;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-left text-sm transition-colors ${
                  active
                    ? 'bg-primary-50 text-primary-700 font-bold'
                    : 'hover:bg-base-200/50 text-text-main'
                }`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <Icon className="h-3.5 w-3.5 opacity-60 shrink-0" />
                  <span className="truncate">{opt.label}</span>
                </span>
                {active && <Check className="h-4 w-4 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Sort a list of students using the given key. Mutates a copy, never the original.
 * - points: by `totalPoints` desc (must be precomputed by caller, fallback 0).
 * - name: alphabetical asc.
 * - newest/oldest: by `createdAt` (desc/asc). Falls back to `id` order if missing.
 */
export function sortStudents<
  T extends { name?: string; totalPoints?: number; createdAt?: string; created_at?: string }
>(list: T[], key: SortKey): T[] {
  const copy = [...list];
  switch (key) {
    case 'points':
      copy.sort((a, b) => (b.totalPoints || 0) - (a.totalPoints || 0));
      break;
    case 'name':
      copy.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      break;
    case 'newest':
      copy.sort(
        (a, b) =>
          new Date(b.createdAt || b.created_at || 0).getTime() -
          new Date(a.createdAt || a.created_at || 0).getTime()
      );
      break;
    case 'oldest':
      copy.sort(
        (a, b) =>
          new Date(a.createdAt || a.created_at || 0).getTime() -
          new Date(b.createdAt || b.created_at || 0).getTime()
      );
      break;
  }
  return copy;
}