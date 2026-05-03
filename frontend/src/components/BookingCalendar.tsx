"use client";

/**
 * Mock Calendly-style booking widget — visual + interaction port of
 * `docs/frontend-redesign/source/recommended-path.html` (lines 369-501).
 *
 * Pure client-side: clicking confirm shows an alert (the real Phase 6+ work
 * will hook this up to the scheduler API). Pre-mount renders nothing
 * date-dependent so React doesn't see an SSR/CSR hydration mismatch from
 * `new Date()`.
 */

import { useEffect, useMemo, useState } from "react";

const SLOTS = [
  "8:00 AM",
  "8:30 AM",
  "9:00 AM",
  "9:30 AM",
  "10:00 AM",
  "10:30 AM",
  "11:00 AM",
  "11:30 AM",
  "1:00 PM",
  "1:30 PM",
  "2:00 PM",
  "2:30 PM",
  "3:00 PM",
  "3:30 PM",
  "4:00 PM",
  "4:30 PM",
] as const;

const AVAIL_DAYS = new Set([1, 2, 3, 4]); // Mon-Thu

const BLOCKED_SLOTS: Record<string, ReadonlySet<string>> = {
  Mon: new Set(["9:00 AM", "10:30 AM", "2:00 PM"]),
  Tue: new Set(["8:30 AM", "1:00 PM", "3:30 PM"]),
  Wed: new Set(["9:30 AM", "11:00 AM", "2:30 PM"]),
  Thu: new Set(["8:00 AM", "10:00 AM", "4:00 PM"]),
};

const DOW_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const DOW_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export type BookingCalendarProps = {
  /** Subtitle under the selected date heading (defaults to legacy 30‑minute wording). */
  introductoryCallLabel?: string;
  /** Short badge next to each time slot (defaults to “30 min”). */
  slotDurationBadge?: string;
  /** First sentence fragment in the confirm alert before the scheduled time. */
  confirmAlertPhrase?: string;
  /** Footer line below the footer (timezone + blurbs); middle segment uses `introductoryCallLabel` unless overridden. */
  footerLine?: string;
};

export default function BookingCalendar(props: BookingCalendarProps = {}) {
  const introductoryCallLabel = props.introductoryCallLabel ?? "30-minute introductory call";
  const slotDurationBadge = props.slotDurationBadge ?? "30 min";
  const confirmAlertPhrase = props.confirmAlertPhrase ?? "Your 30-minute call has been requested";
  const footerLine =
    props.footerLine ??
    `All times shown in your local timezone · ${introductoryCallLabel} · Your survey responses will be shared with your PulseOne representative before the call so they arrive prepared.`;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const today = useMemo(() => (mounted ? startOfDay(new Date()) : null), [mounted]);

  const initial = useMemo(() => {
    if (!today) return { year: 2026, month: 4 };
    let y = today.getFullYear();
    let m = today.getMonth();
    if (today.getDate() > 15) {
      m += 1;
      if (m > 11) {
        m = 0;
        y += 1;
      }
    }
    return { year: y, month: m };
  }, [today]);

  const [view, setView] = useState(initial);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  useEffect(() => {
    if (mounted) setView(initial);
  }, [mounted, initial]);

  const monthCells = useMemo(() => {
    const first = new Date(view.year, view.month, 1).getDay();
    const total = new Date(view.year, view.month + 1, 0).getDate();
    const cells: Array<Date | null> = [];
    for (let i = 0; i < first; i++) cells.push(null);
    for (let d = 1; d <= total; d++) cells.push(new Date(view.year, view.month, d));
    return cells;
  }, [view]);

  const goPrev = () =>
    setView((v) =>
      v.month === 0 ? { year: v.year - 1, month: 11 } : { year: v.year, month: v.month - 1 },
    );
  const goNext = () =>
    setView((v) =>
      v.month === 11 ? { year: v.year + 1, month: 0 } : { year: v.year, month: v.month + 1 },
    );

  const handleSelectDate = (d: Date) => {
    setSelectedDate(d);
    setSelectedSlot(null);
  };

  const handleConfirm = () => {
    if (!selectedDate || !selectedSlot) return;
    const ds = selectedDate.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
    window.alert(`${confirmAlertPhrase} for ${ds} at ${selectedSlot}.\n\nA confirmation will be sent to your email.`);
  };

  const blockedForSelected =
    selectedDate !== null
      ? (BLOCKED_SLOTS[DOW_SHORT[selectedDate.getDay()]] ?? new Set<string>())
      : new Set<string>();

  const selectionLabel =
    selectedDate && selectedSlot
      ? `${selectedDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} · ${selectedSlot}`
      : null;

  const monthTitle = `${MONTHS[view.month]} ${view.year}`;

  return (
    <div className="mx-auto mt-11 max-w-[820px] overflow-hidden rounded-[14px] border border-white/10 bg-white/[0.04]">
      <div className="grid grid-cols-1 md:grid-cols-2">
        {/* Month grid */}
        <div className="border-b border-white/[0.08] px-7 pt-7 pb-5 md:border-r md:border-b-0">
          <div className="mb-4 flex items-center justify-between">
            <button
              type="button"
              onClick={goPrev}
              aria-label="Previous month"
              className="flex h-[30px] w-[30px] items-center justify-center rounded-md border border-white/15 bg-transparent text-sm text-white/60 transition-colors hover:border-pulse-teal hover:text-pulse-teal"
            >
              ‹
            </button>
            <span className="font-sans text-base font-bold text-white">{monthTitle}</span>
            <button
              type="button"
              onClick={goNext}
              aria-label="Next month"
              className="flex h-[30px] w-[30px] items-center justify-center rounded-md border border-white/15 bg-transparent text-sm text-white/60 transition-colors hover:border-pulse-teal hover:text-pulse-teal"
            >
              ›
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {DOW_LABELS.map((d) => (
              <div
                key={d}
                className="pb-2 text-center font-sans text-[10px] font-bold tracking-[1.5px] text-white/30 uppercase"
              >
                {d}
              </div>
            ))}
            {monthCells.map((cell, idx) => {
              if (cell === null) {
                return <div key={`empty-${idx}`} className="aspect-square" />;
              }
              const dow = cell.getDay();
              const isPastOrWeekend = (today !== null && cell < today) || dow === 0 || dow === 6;
              const isAvailable = !isPastOrWeekend && AVAIL_DAYS.has(dow);
              const isSelected =
                selectedDate !== null && cell.toDateString() === selectedDate.toDateString();
              const isToday = today !== null && cell.toDateString() === today.toDateString();

              const base =
                "aspect-square flex items-center justify-center rounded-md font-sans text-sm font-semibold cursor-default transition-colors";
              if (!mounted || !isAvailable) {
                return (
                  <div
                    key={cell.toISOString()}
                    className={`${base} text-white/10`}
                    aria-disabled="true"
                  >
                    {cell.getDate()}
                  </div>
                );
              }
              const cls = isSelected
                ? `${base} cursor-pointer bg-pulse-teal text-black`
                : `${base} cursor-pointer bg-white/[0.05] text-white hover:bg-pulse-teal/20 hover:text-pulse-teal`;
              return (
                <button
                  key={cell.toISOString()}
                  type="button"
                  onClick={() => handleSelectDate(cell)}
                  className={`${cls} ${isToday ? "outline outline-1 outline-white/20" : ""}`}
                >
                  {cell.getDate()}
                </button>
              );
            })}
          </div>
        </div>

        {/* Time slots */}
        <div className="px-6 pt-7 pb-5">
          <div className="mb-1 font-sans text-sm font-bold text-white">
            {selectedDate
              ? selectedDate.toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })
              : "Select a date to see times"}
          </div>
          <div className="mb-4 font-sans text-xs text-white/35">{introductoryCallLabel}</div>
          <div className="flex max-h-[260px] flex-col gap-2 overflow-y-auto pr-1">
            {selectedDate ? (
              SLOTS.map((t) => {
                const blocked = blockedForSelected.has(t);
                const isSelected = selectedSlot === t;
                if (blocked) {
                  return (
                    <div
                      key={t}
                      className="flex cursor-default items-center justify-between rounded-md border border-white/10 bg-white/[0.05] px-4 py-2.5 font-sans text-sm font-semibold text-white/20 opacity-25"
                      aria-disabled="true"
                    >
                      <span>{t}</span>
                      <span className="text-[11px] opacity-60">{slotDurationBadge}</span>
                    </div>
                  );
                }
                const cls = isSelected
                  ? "border-pulse-teal bg-pulse-teal text-black"
                  : "border-white/10 bg-white/[0.05] text-white/75 hover:border-pulse-teal hover:bg-pulse-teal/[0.08] hover:text-pulse-teal";
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setSelectedSlot(t)}
                    className={`flex items-center justify-between rounded-md border px-4 py-2.5 font-sans text-sm font-semibold transition-colors ${cls}`}
                  >
                    <span>{t}</span>
                    <span className="text-[11px] opacity-60">{slotDurationBadge}</span>
                  </button>
                );
              })
            ) : (
              <p className="font-sans text-sm text-white/35">
                Choose a weekday on the left to see available times.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.08] px-7 py-5">
        <span className="font-sans text-sm text-white/45">
          {selectionLabel ? (
            <>
              Selected: <strong className="font-bold text-pulse-teal">{selectionLabel}</strong>
            </>
          ) : selectedDate ? (
            "Choose a time on the right"
          ) : (
            "No time selected yet"
          )}
        </span>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!selectedDate || !selectedSlot}
          className="rounded-[5px] bg-pulse-red px-7 py-2.5 font-sans text-[13px] font-bold tracking-[1px] text-white uppercase transition-[background-color,opacity] hover:bg-[#b8121a] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Confirm &amp; Book
        </button>
      </div>

      <p className="px-7 pb-4 text-center font-sans text-xs text-white/25">{footerLine}</p>
    </div>
  );
}
