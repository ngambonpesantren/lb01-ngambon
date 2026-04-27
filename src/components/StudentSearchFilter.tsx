import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Search, X, Filter, Check, Sparkles } from 'lucide-react';

export interface StudentSearchFilterValue {
  query: string;
  tags: string[];
}

interface Props {
  value: StudentSearchFilterValue;
  onChange: (next: StudentSearchFilterValue) => void;
  availableTags: string[];
  placeholder?: string;
  className?: string;
  variant?: 'light' | 'dark';
  /**
   * Optional list of all student tag arrays used to compute popularity for the
   * quick-select chips. If omitted, every available tag is treated equally and
   * the chips fall back to alphabetical order.
   */
  studentTagSource?: string[][];
  /** Max number of quick-select chips to display. Defaults to 6. */
  maxQuickChips?: number;
  /**
   * Render mode:
   * - 'full' (default): search input + tags popover + selected-tag chips
   * - 'search': only the search input (basic mode)
   * - 'tags': only the tags popover + selected chips (advanced mode)
   */
  mode?: 'full' | 'search' | 'tags';
}

/**
 * Reusable search-by-name + filter-by-tags control.
 * Used in both the public Leaderboard and the Admin Student List.
 */
export function StudentSearchFilter({
  value,
  onChange,
  availableTags,
  placeholder = 'Search by name...',
  className = '',
  variant = 'light',
  studentTagSource,
  maxQuickChips = 6,
  mode = 'full',
}: Props) {
  const [open, setOpen] = useState(false);
  const [tagQuery, setTagQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const popRef = useRef<HTMLDivElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const sortedTags = useMemo(
    () => [...new Set(availableTags)].filter(Boolean).sort((a, b) => a.localeCompare(b)),
    [availableTags]
  );

  // Frequency map across all students (for quick-chip popularity ranking).
  const tagFrequency = useMemo(() => {
    const map = new Map<string, number>();
    if (studentTagSource) {
      studentTagSource.forEach((tags) =>
        (tags || []).forEach((t) => {
          if (!t) return;
          map.set(t, (map.get(t) || 0) + 1);
        })
      );
    }
    return map;
  }, [studentTagSource]);

  // Quick-select chips: most-used tags first, then alphabetical fallback.
  const quickChips = useMemo(() => {
    const ranked = [...sortedTags].sort((a, b) => {
      const fa = tagFrequency.get(a) || 0;
      const fb = tagFrequency.get(b) || 0;
      if (fb !== fa) return fb - fa;
      return a.localeCompare(b);
    });
    return ranked.slice(0, maxQuickChips);
  }, [sortedTags, tagFrequency, maxQuickChips]);

  // Typeahead matches inside the popover.
  const matchedTags = useMemo(() => {
    const q = tagQuery.trim().toLowerCase();
    if (!q) return sortedTags;
    return sortedTags.filter((t) => t.toLowerCase().includes(q));
  }, [sortedTags, tagQuery]);

  useEffect(() => {
    setHighlight(0);
  }, [tagQuery, open]);

  useEffect(() => {
    if (open) {
      // Slight delay so the popover is mounted before focusing.
      const t = setTimeout(() => tagInputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
    setTagQuery('');
  }, [open]);

  const toggleTag = (tag: string) => {
    const exists = value.tags.includes(tag);
    onChange({
      ...value,
      tags: exists ? value.tags.filter((t) => t !== tag) : [...value.tags, tag],
    });
  };

  const clearAll = () => onChange({ query: '', tags: [] });

  const isDark = variant === 'dark';
  const inputCls = isDark
    ? 'w-full min-h-11 pl-12 pr-10 py-3 rounded-2xl border border-base-50/20 bg-base-900/30 text-base-50 placeholder:text-base-50/60 focus:ring-4 focus:ring-base-50/10 focus:border-base-50/40 backdrop-blur-md outline-none text-sm transition-all'
    : 'w-full min-h-11 pl-12 pr-10 py-3 rounded-2xl border border-base-200 focus:ring-4 focus:ring-primary-50/50 focus:border-primary-500 transition-all text-sm outline-none bg-base-200/50 focus:bg-base-100';
  const iconCls = isDark ? 'text-base-50/70' : 'text-text-light';
  const btnCls = isDark
    ? 'w-full sm:w-auto min-h-11 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border border-base-50/20 bg-base-900/30 text-base-50 hover:bg-base-900/50 backdrop-blur-md text-sm font-bold transition-all'
    : 'w-full sm:w-auto min-h-11 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border border-base-200 bg-base-100 text-text-main hover:border-primary-300 text-sm font-bold transition-all';

  const hasFilters = value.query || value.tags.length > 0;

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, Math.max(matchedTags.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const tag = matchedTags[highlight];
      if (tag) {
        toggleTag(tag);
        setTagQuery('');
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === 'Backspace' && !tagQuery && value.tags.length > 0) {
      // Quick-remove last selected tag with backspace on empty input.
      onChange({ ...value, tags: value.tags.slice(0, -1) });
    }
  };

  return (
    <div className={`flex flex-col sm:flex-row gap-2 items-stretch min-w-0 ${className}`}>
      {mode !== 'tags' && (
      <div className="relative flex-1 min-w-0">
        <Search className={`absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 ${iconCls}`} />
        <input
          type="text"
          value={value.query}
          onChange={(e) => onChange({ ...value, query: e.target.value })}
          placeholder={placeholder}
          className={inputCls}
        />
        {value.query && (
          <button
            type="button"
            onClick={() => onChange({ ...value, query: '' })}
            className={`absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-base-50/10 ${iconCls}`}
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      )}

      {mode !== 'search' && (
      <div className="relative flex-1 sm:flex-none min-w-0" ref={popRef}>
        <button type="button" onClick={() => setOpen((o) => !o)} className={btnCls}>
          <Filter className="h-4 w-4 shrink-0" />
          <span>Tags</span>
          {value.tags.length > 0 && (
            <span className="ml-1 px-2 py-0.5 rounded-full bg-primary-600 text-base-50 text-[10px] font-black">
              {value.tags.length}
            </span>
          )}
        </button>

        {open && (
          <div className="absolute right-0 mt-2 w-[min(20rem,calc(100vw-2rem))] bg-base-100 border border-base-200 rounded-2xl shadow-2xl z-50 p-3">
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-text-light">
                Filter by tags
              </span>
              {hasFilters && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-[10px] font-bold text-primary-600 hover:underline"
                >
                  Clear all
                </button>
              )}
            </div>

            {sortedTags.length === 0 ? (
              <p className="text-xs text-text-light px-1 py-3 text-center">
                No tags available yet.
              </p>
            ) : (
              <>
                {/* Typeahead input */}
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-light" />
                  <input
                    ref={tagInputRef}
                    type="text"
                    value={tagQuery}
                    onChange={(e) => setTagQuery(e.target.value)}
                    onKeyDown={handleTagInputKeyDown}
                    placeholder="Type to find tags..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-base-200 focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none text-sm bg-base-200/40"
                  />
                </div>

                {/* Quick-select chips (popular tags) */}
                {!tagQuery && quickChips.length > 0 && (
                  <div className="mb-2">
                    <div className="flex items-center gap-1 px-1 mb-1.5">
                      <Sparkles className="h-3 w-3 text-accent-500" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-text-light">
                        Quick select
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {quickChips.map((tag) => {
                        const checked = value.tags.includes(tag);
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => toggleTag(tag)}
                            className={`text-[11px] font-bold px-2.5 py-1 rounded-full border transition-all ${
                              checked
                                ? 'bg-primary-600 text-base-50 border-primary-600'
                                : 'bg-base-100 text-text-main border-base-200 hover:border-primary-400 hover:bg-primary-50'
                            }`}
                          >
                            {tag}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Filtered list */}
                <div className="max-h-56 overflow-y-auto flex flex-col gap-1 border-t border-base-200 pt-2">
                  {matchedTags.length === 0 ? (
                    <p className="text-xs text-text-light px-1 py-3 text-center">
                      No tags match "{tagQuery}".
                    </p>
                  ) : (
                    matchedTags.map((tag, idx) => {
                      const checked = value.tags.includes(tag);
                      const isHi = idx === highlight;
                      return (
                        <button
                          key={tag}
                          type="button"
                          onMouseEnter={() => setHighlight(idx)}
                          onClick={() => toggleTag(tag)}
                          className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-left text-sm transition-colors ${
                            checked
                              ? 'bg-primary-50 text-primary-700 font-bold'
                              : isHi
                                ? 'bg-base-200/70 text-text-main'
                                : 'hover:bg-base-200/50 text-text-main'
                          }`}
                        >
                          <span className="truncate">{highlightMatch(tag, tagQuery)}</span>
                          {checked && <Check className="h-4 w-4 shrink-0" />}
                        </button>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
      )}

      {mode !== 'search' && value.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 items-center w-full sm:w-auto sm:max-w-[40%] basis-full sm:basis-auto">
          {value.tags.map((tag) => (
            <span
              key={tag}
              className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full ${
                isDark
                  ? 'bg-base-50/15 text-base-50 border border-base-50/20'
                  : 'bg-primary-100 text-primary-700'
              }`}
            >
              {tag}
              <button
                type="button"
                onClick={() => toggleTag(tag)}
                className="hover:opacity-70"
                aria-label={`Remove ${tag}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Helper to filter a list of students by a StudentSearchFilterValue.
 * Matches the name (case-insensitive) and requires ALL selected tags to be present.
 */
export function applyStudentSearchFilter<T extends { name?: string; tags?: string[] }>(
  list: T[],
  filter: StudentSearchFilterValue
): T[] {
  const q = filter.query.trim().toLowerCase();
  const tagSet = filter.tags;
  if (!q && tagSet.length === 0) return list;

  return list.filter((s) => {
    const nameMatch = !q || (s.name || '').toLowerCase().includes(q);
    const tagMatch =
      tagSet.length === 0 ||
      (Array.isArray(s.tags) && tagSet.every((t) => s.tags!.includes(t)));
    return nameMatch && tagMatch;
  });
}

export const emptyStudentSearchFilter: StudentSearchFilterValue = { query: '', tags: [] };

// --- Helpers ---
function highlightMatch(text: string, query: string): React.ReactNode {
  const q = query.trim();
  if (!q) return text;
  const lower = text.toLowerCase();
  const idx = lower.indexOf(q.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-accent-100 text-text-main rounded px-0.5">
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  );
}