import JsonLd from "@/components/JsonLd";
import { faqSchema, type FaqItem } from "@/lib/schema";

type Props = {
  items: FaqItem[];
  eyebrow?: string;
  heading?: string;
  intro?: string;
  id?: string;
  tone?: "light" | "surface";
};

/**
 * Visible question-and-answer section paired with its `FAQPage` structured
 * data. The schema is generated from the same array that renders the copy, so
 * the two cannot drift — marking up answers that are not visible on the page
 * is a structured-data violation.
 *
 * Use at most once per page: multiple `FAQPage` blocks on one URL confuse
 * consumers.
 */
export default function FaqSection({
  items,
  eyebrow = "Common Questions",
  heading = "Questions leaders ask",
  intro,
  id = "faq",
  tone = "light",
}: Props) {
  if (items.length === 0) return null;

  return (
    <section
      id={id}
      className={`scroll-mt-[96px] border-t border-[#e8e8e8] px-6 py-[90px] ${
        tone === "surface" ? "bg-[#f4f4f4]" : "bg-white"
      }`}
    >
      <JsonLd data={faqSchema(items)} />
      <div className="mx-auto max-w-[1200px]">
        <div className="mb-12">
          <span className="mb-3 block font-sans text-[11px] font-semibold tracking-[3px] text-pulse-teal uppercase">
            {eyebrow}
          </span>
          <h2 className="border-l-[5px] border-pulse-red py-0 pl-[18px] font-sans text-[30px] font-bold leading-tight text-[#1a1a1a]">
            {heading}
          </h2>
          {intro ? (
            <p className="mt-4 max-w-[640px] pl-[23px] font-sans text-[15px] leading-relaxed text-[#646464]">
              {intro}
            </p>
          ) : null}
        </div>

        <div className="grid gap-x-10 gap-y-9 md:grid-cols-2">
          {items.map((item) => (
            <div key={item.question}>
              <h3 className="mb-2.5 font-sans text-[17px] font-bold leading-snug text-[#1a1a1a]">
                {item.question}
              </h3>
              <p className="font-sans text-[15px] leading-[1.75] text-[#646464]">{item.answer}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
