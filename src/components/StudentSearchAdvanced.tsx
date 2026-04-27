import React, { useState } from 'react';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import {
  StudentSearchFilter,
  type StudentSearchFilterValue,
} from './StudentSearchFilter';
import { StudentSortDropdown, type SortKey } from './StudentSortDropdown';

interface Props {
  value: StudentSearchFilterValue;
  onChange: (next: StudentSearchFilterValue) => void;
  sortKey: SortKey;
  onSortChange: (next: SortKey) => void;
  availableTags: string[];
  studentTagSource?: string[][];
  placeholder?: string;
  variant?: 'light' | 'dark';
  className?: string;
  /** Whether the advanced section starts open. Defaults to false. */
  defaultOpen?: boolean;
}

/**
 * Composite control:
 *  - Always-visible BASIC search input.
 *  - Collapsible ADVANCED section that reveals Tag filter + Sort dropdown.
 * The "Advanced" toggle shows a badge with the number of active advanced
 * options (selected tags + non-default sort) so users see at a glance whether
 * any hidden filter is currently affecting results.
 */
export function StudentSearchAdvanced({
  value,
  onChange,
  sortKey,
  onSortChange,
  availableTags,
  studentTagSource,
  placeholder = 'Search by name...',
  variant = 'light',
  className = '',
  defaultOpen = false,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const isDark = variant === 'dark';

  const advancedActive =
    value.tags.length + (sortKey !== 'points' ? 1 : 0);

  const toggleCls = isDark
    ? 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-base-50/20 bg-base-900/30 text-base-50 hover:bg-base-900/50 backdrop-blur-md text-[11px] font-bold transition-all'
    : 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-base-200 bg-base-100 text-text-main hover:border-primary-300 text-[11px] font-bold transition-all';

  return (
    <div className={`flex flex-col gap-2 min-w-0 ${className}`}>
      {/* BASIC: search input always visible */}
      <StudentSearchFilter
        mode="search"
        value={value}
        onChange={onChange}
        availableTags={availableTags}
        placeholder={placeholder}
        variant={variant}
      />

      {/* Advanced toggle */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={toggleCls}
          aria-expanded={open}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span>Advanced</span>
          {advancedActive > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-primary-600 text-base-50 text-[9px] font-black leading-none">
              {advancedActive}
            </span>
          )}
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>
      </div>

      {/* ADVANCED: tag filter + sort dropdown, collapsed by default */}
      {open && (
        <div
          className={`flex flex-col sm:flex-row gap-2 items-stretch min-w-0 rounded-2xl p-2 ${
            isDark
              ? 'border border-base-50/15 bg-base-900/20'
              : 'border border-base-200 bg-base-200/30'
          }`}
        >
          <div className="flex-1 min-w-0">
            <StudentSearchFilter
              mode="tags"
              value={value}
              onChange={onChange}
              availableTags={availableTags}
              studentTagSource={studentTagSource}
              variant={variant}
            />
          </div>
          <div className="shrink-0 w-full sm:w-auto">
            <StudentSortDropdown
              value={sortKey}
              onChange={onSortChange}
              variant={variant}
            />
          </div>
        </div>
      )}
    </div>
  );
}