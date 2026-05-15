"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

import ExecutiveIntakeForm from "@/components/ExecutiveIntakeForm";

/**
 * Full executive intake wizard (map + tailoring questions) in a `<dialog>`,
 * opened from the main nav “Solutions” item.
 */
export type SolutionsIntakeModalProps = {
  open: boolean;
  onClose: () => void;
  /** Increment when opening the dialog so the wizard resets to step 1 without an extra mount. */
  sessionKey: number;
};

export default function SolutionsIntakeModal({ open, onClose, sessionKey }: SolutionsIntakeModalProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  useLayoutEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open) {
      if (!el.open) {
        el.showModal();
      }
    } else if (el.open) {
      el.close();
    }
  }, [open]);

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

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      aria-labelledby="solutions-intake-modal-title"
      className="z-[200] m-0 max-h-[92vh] w-[min(1200px,96vw)] overflow-hidden rounded-xl border border-white/10 bg-dark-bg p-0 text-white shadow-2xl backdrop:bg-black/70 backdrop:backdrop-blur-sm open:flex open:flex-col open:fixed open:inset-0 open:m-auto"
    >
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 bg-[#0e0e10] px-6 py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="h-2 w-2 shrink-0 rounded-full bg-pulse-red" aria-hidden />
          <h2
            id="solutions-intake-modal-title"
            className="truncate font-sans text-[13px] font-semibold tracking-[2px] text-white/85 uppercase"
          >
            Solutions — build your path
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

      <div className="min-h-0 flex-1 overflow-y-auto bg-dark-bg">
        {open ? <ExecutiveIntakeForm key={sessionKey} variant="modal" /> : null}
      </div>
    </dialog>
  );
}
