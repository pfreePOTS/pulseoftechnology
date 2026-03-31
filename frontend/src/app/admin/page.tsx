"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import WorkbenchImpactTab from "@/components/admin/WorkbenchImpactTab";
import WorkbenchPositioningTab from "@/components/admin/WorkbenchPositioningTab";
import WorkbenchPreviewPublishTab from "@/components/admin/WorkbenchPreviewPublishTab";
import WorkbenchPromotionTab from "@/components/admin/WorkbenchPromotionTab";
import WorkbenchResearchTab from "@/components/admin/WorkbenchResearchTab";
import WorkbenchSelectionTab from "@/components/admin/WorkbenchSelectionTab";
import WorkbenchSignalsTab from "@/components/admin/WorkbenchSignalsTab";

export type WorkbenchStep =
  | "signals"
  | "research"
  | "impact"
  | "selection"
  | "positioning"
  | "promotion"
  | "preview_publish";

const STEPS: { id: WorkbenchStep; label: string; description: string }[] = [
  { id: "signals", label: "Signals", description: "What\u2019s trending?" },
  { id: "research", label: "Research", description: "Watch & investigate" },
  { id: "impact", label: "Impact", description: "Industry risk & impact" },
  { id: "selection", label: "Selection", description: "Pick for the radar" },
  { id: "positioning", label: "Positioning", description: "Industry & personas" },
  { id: "promotion", label: "Promotion", description: "Content library" },
  { id: "preview_publish", label: "Preview & Publish", description: "Go live" },
];

const STEP_IDS = new Set(STEPS.map((s) => s.id));

function MarketersWorkbenchInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<WorkbenchStep>("signals");

  useEffect(() => {
    const q = searchParams.get("step");
    if (q && STEP_IDS.has(q as WorkbenchStep)) {
      setStep(q as WorkbenchStep);
    }
  }, [searchParams]);

  function goToStep(next: WorkbenchStep) {
    setStep(next);
    router.replace(`/admin?step=${next}`, { scroll: false });
  }

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-white">Marketer&apos;s Workbench</h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-400">
          Surface trending signals, research and watch topics, assess industry impact, select for the radar, tune
          positioning and promos, preview the newsletter, then publish. Newsletter sending is a separate operational
          action under System Jobs.
        </p>
      </header>

      <nav className="mb-8 flex flex-wrap gap-2 border-b border-gray-800 pb-4" aria-label="Workbench steps">
        {STEPS.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => goToStep(s.id)}
            className={`flex min-w-[108px] flex-1 flex-col rounded-lg border px-3 py-2.5 text-left transition-colors sm:flex-none ${
              step === s.id
                ? "border-indigo-500/50 bg-indigo-500/10"
                : "border-gray-800 bg-gray-900/50 hover:border-gray-700"
            }`}
          >
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
              Step {i + 1}
            </span>
            <span className="font-semibold text-white">{s.label}</span>
            <span className="text-xs text-gray-500">{s.description}</span>
          </button>
        ))}
      </nav>

      {step === "signals" && <WorkbenchSignalsTab />}
      {step === "research" && <WorkbenchResearchTab />}
      {step === "impact" && <WorkbenchImpactTab />}
      {step === "selection" && <WorkbenchSelectionTab />}
      {step === "positioning" && <WorkbenchPositioningTab />}
      {step === "promotion" && <WorkbenchPromotionTab />}
      {step === "preview_publish" && <WorkbenchPreviewPublishTab />}
    </div>
  );
}

function WorkbenchFallback() {
  return (
    <div className="mx-auto max-w-6xl py-16 text-center text-sm text-gray-500">Loading workbench…</div>
  );
}

export default function MarketersWorkbenchPage() {
  return (
    <Suspense fallback={<WorkbenchFallback />}>
      <MarketersWorkbenchInner />
    </Suspense>
  );
}
