import Link from "next/link";

export type ContactCtaBandProps = {
  id?: string;
  eyebrow?: string;
  title: React.ReactNode;
  description: string;
  buttonLabel?: string;
};

/** Dark footer CTA — links to `/contact` (scheduling integration disabled for now). */
export default function ContactCtaBand({
  id,
  eyebrow = "Get in Touch",
  title,
  description,
  buttonLabel = "Send us a message",
}: ContactCtaBandProps) {
  return (
    <section
      id={id}
      className="relative scroll-mt-[96px] overflow-hidden border-t-[3px] border-pulse-red bg-dark-bg px-8 pt-20 pb-16"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_60%_50%,rgba(213,23,30,0.10)_0%,transparent_70%)]"
        aria-hidden
      />
      <div className="relative mx-auto max-w-[760px] text-center">
        <span className="mb-2.5 block font-sans text-[13px] font-semibold tracking-[3px] text-pulse-teal uppercase">
          {eyebrow}
        </span>
        <h2 className="mb-4 font-sans text-4xl leading-tight font-extrabold text-white">{title}</h2>
        <p className="mx-auto mb-8 max-w-[560px] font-sans text-[17px] leading-relaxed text-white/55">
          {description}
        </p>
        <Link
          href="/contact"
          className="inline-flex items-center justify-center rounded-md bg-pulse-red px-8 py-3.5 font-sans text-[14.5px] font-semibold text-white transition-colors hover:bg-[#a81117]"
        >
          {buttonLabel} →
        </Link>
      </div>
    </section>
  );
}
