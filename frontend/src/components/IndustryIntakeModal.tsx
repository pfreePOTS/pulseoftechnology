"use client";

import { useEffect, useRef } from "react";

import ExecutiveIntakeForm from "@/components/ExecutiveIntakeForm";

/**
 * Modal wrapper around `ExecutiveIntakeForm` for the `/industries` feeder page.
 * Uses the native HTML `<dialog>` element so we get focus trap, ESC-to-close,
 * and the backdrop pseudo-element for free without pulling in a UI library.
 *
 * Click-outside-to-close is implemented by checking `e.target === dialogEl`
 * (clicks on the backdrop bubble up with the dialog itself as the target).
 */
export type IndustryIntakeModalProps = {
  industry: string | null;
  onClose: () => void;
};

export default function IndustryIntakeModal({ industry, onClose }: IndustryIntakeModalProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  // Open / close in sync with `industry` prop. Using `showModal()` (not
  // `show()`) gives us the focus trap + backdrop element.
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (industry && !el.open) {
      el.showModal();
    } else if (!industry && el.open) {
      el.close();
    }
  }, [industry]);

  // The native `cancel` event fires on ESC — route it to our close handler so
  // parent state stays consistent with `el.open`.
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    const onCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    el.addEventListener("cancel", onCancel);
    return () => el.removeEventListener("cancel", onCancel);
  }, [onClose]);

  // Click outside the inner panel (i.e. on the backdrop) closes the modal.
  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      aria-labelledby="industry-intake-modal-title"
      className="m-0 max-h-[92vh] w-[min(1200px,96vw)] overflow-hidden rounded-xl border border-white/10 bg-dark-bg p-0 text-white shadow-2xl backdrop:bg-black/70 backdrop:backdrop-blur-sm open:flex open:flex-col open:fixed open:inset-0 open:m-auto"
    >
      {/* Top bar — title + close. Sits above the scrollable wizard body. */}
      <div className="flex items-center justify-between border-b border-white/10 bg-[#0e0e10] px-6 py-3.5">
        <div className="flex items-center gap-3">
          <span className="h-2 w-2 rounded-full bg-pulse-red" aria-hidden />
          <h2
            id="industry-intake-modal-title"
            className="font-sans text-[13px] font-semibold tracking-[2px] text-white/85 uppercase"
          >
            Build a Custom Path{industry ? `: ${industry}` : ""}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-md p-2 font-sans text-lg leading-none text-white/55 transition-colors hover:bg-white/10 hover:text-white"
        >
          ×
        </button>
      </div>

      {/* Scrollable body — `prefilledIndustry` is the whole point of this
          surface; the wizard skips its industry step and shows a confirmation
          badge in the aside. */}
      <div className="flex-1 overflow-y-auto bg-dark-bg">
        {industry && (
          <ExecutiveIntakeForm prefilledIndustry={industry} variant="modal" />
        )}
      </div>
    </dialog>
  );
}
