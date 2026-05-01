import React, { useEffect, useRef, useState } from 'react';
import { Calendar as CalendarIcon, ChevronDown } from 'lucide-react';
import {
  RANGE_PRESET_OPTIONS,
  type RangePreset,
  type DateRange,
  presetToRange,
  toDateInputValue,
  fromDateInputValue,
  endOfDay,
  startOfDay,
} from '@/lib/timeRanges';

export interface TimeRangeValue {
  preset: RangePreset;
  range: DateRange;
}

interface Props {
  value: TimeRangeValue;
  onChange: (next: TimeRangeValue) => void;
  /** Compact variant fits inside chart card headers. */
  size?: 'sm' | 'md';
  className?: string;
}

/** Reusable time-range filter: preset <select> + custom date range picker. */
export function TimeRangeFilter({ value, onChange, size = 'sm', className = '' }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const popRef = useRef<HTMLDivElement | null>(null);
  const isCustom = value.preset === 'custom';

  // Close popover on outside click.
  useEffect(() => {
    if (!pickerOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) setPickerOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [pickerOpen]);

  const handlePreset = (preset: RangePreset) => {
    if (preset === 'custom') {
      // Seed custom with last-month window if empty.
      const seed = value.range.start && value.range.end
        ? value.range
        : presetToRange('last-month');
      onChange({ preset, range: { start: seed.start, end: seed.end } });
      setPickerOpen(true);
      return;
    }
    onChange({ preset, range: presetToRange(preset) });
  };

  const handleStart = (s: string) => {
    const d = fromDateInputValue(s);
    onChange({
      preset: 'custom',
      range: { start: d ? startOfDay(d) : null, end: value.range.end },
    });
  };
  const handleEnd = (s: string) => {
    const d = fromDateInputValue(s);
    onChange({
      preset: 'custom',
      range: { start: value.range.start, end: d ? endOfDay(d) : null },
    });
  };

  const sizeCls =
    size === 'sm'
      ? 'text-xs py-1.5 px-3'
      : 'text-sm py-2 px-4';

  const customLabel =
    value.range.start && value.range.end
      ? `${toDateInputValue(value.range.start)} → ${toDateInputValue(value.range.end)}`
      : 'Pick range';

  return (
    <div className={`relative inline-flex items-center gap-2 ${className}`}>
      {/* Preset select */}
      <div className="relative">
        <select
          value={value.preset}
          onChange={(e) => handlePreset(e.target.value as RangePreset)}
          className={`appearance-none bg-base-50 border border-base-200 rounded-xl pr-8 font-bold text-text-muted focus:ring-2 focus:ring-primary-100 outline-none ${sizeCls}`}
        >
          {RANGE_PRESET_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <ChevronDown className="w-3.5 h-3.5 text-text-light absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>

      {/* Custom date range trigger */}
      {isCustom && (
        <div className="relative" ref={popRef}>
          <button
            type="button"
            onClick={() => setPickerOpen((o) => !o)}
            className={`inline-flex items-center gap-2 bg-base-50 border border-base-200 rounded-xl font-bold text-text-muted hover:text-text-main focus:ring-2 focus:ring-primary-100 outline-none ${sizeCls}`}
          >
            <CalendarIcon className="w-3.5 h-3.5 text-primary-500" />
            <span className="whitespace-nowrap">{customLabel}</span>
          </button>

          {pickerOpen && (
            <div className="absolute right-0 z-50 mt-2 w-72 bg-base-100 border border-base-200 rounded-2xl shadow-xl p-4 space-y-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-text-light">Start date</label>
                <input
                  type="date"
                  value={toDateInputValue(value.range.start)}
                  max={toDateInputValue(value.range.end) || undefined}
                  onChange={(e) => handleStart(e.target.value)}
                  className="bg-base-50 border border-base-200 rounded-xl px-3 py-2 text-sm font-bold text-text-main focus:ring-2 focus:ring-primary-100 outline-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-text-light">End date</label>
                <input
                  type="date"
                  value={toDateInputValue(value.range.end)}
                  min={toDateInputValue(value.range.start) || undefined}
                  onChange={(e) => handleEnd(e.target.value)}
                  className="bg-base-50 border border-base-200 rounded-xl px-3 py-2 text-sm font-bold text-text-main focus:ring-2 focus:ring-primary-100 outline-none"
                />
              </div>
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setPickerOpen(false)}
                  className="text-xs font-black uppercase tracking-widest text-primary-600 hover:text-primary-700"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Convenience: build the initial state for the filter (defaults to all-time). */
export function createDefaultTimeRangeValue(preset: RangePreset = 'all-time'): TimeRangeValue {
  return { preset, range: presetToRange(preset) };
}
