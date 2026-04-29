type Industry = { name: string; iconPath: string };

const INDUSTRIES: Industry[] = [
  {
    name: "Healthcare",
    iconPath:
      "M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm-7 3a3 3 0 1 1 0 6 3 3 0 0 1 0-6zm6 13H6v-.5c0-2.5 3.6-4.5 6-4.5s6 2 6 4.5V19z",
  },
  {
    name: "Legal",
    iconPath:
      "M12 3L1 9l4 2.18V17h2v-4.82L12 14l7-3.82V17h2v-5.82L23 9 12 3zm0 2.27L19.32 9 12 12.73 4.68 9 12 5.27zM5 19v2h14v-2H5z",
  },
  {
    name: "Manufacturing",
    iconPath:
      "M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z",
  },
  {
    name: "Financial Services",
    iconPath:
      "M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z",
  },
  {
    name: "Education",
    iconPath:
      "M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z",
  },
  {
    name: "Nonprofits",
    iconPath:
      "M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z",
  },
  {
    name: "Construction & Real Estate",
    iconPath:
      "M13 2.05V4.07c3.39.49 6 3.39 6 6.93 0 2.65-1.35 4.98-3.38 6.38L14 16v5h5l-1.22-1.22C19.91 18.07 22 15.14 22 11.7 22 6.81 18.05 2.82 13 2.05zM11 2.05C5.95 2.82 2 6.81 2 11.7c0 3.44 2.09 6.37 5.22 8.08L6 21h5v-5l-1.62 1.38C8.35 16.18 7 13.85 7 11.2c0-3.54 2.61-6.44 6-6.93V2.05z",
  },
  {
    name: "Professional Services",
    iconPath:
      "M20 6h-2.18c.07-.44.18-.88.18-1.34C18 2.54 15.96.5 13.5.5c-1.32 0-2.5.56-3.36 1.46L9 3.09 7.86 1.96C7 1.06 5.82.5 4.5.5 2.04.5 0 2.54 0 5c0 .46.11.9.18 1.34H0v2h.5L3 20h18l2.5-12H24V6h-4zm-6.5-3.5c.83 0 1.5.67 1.5 1.5S14.33 5.5 13.5 5.5 12 4.83 12 4s.67-.5 1.5-.5zM4.5 2c.83 0 1.5.67 1.5 1.5S5.33 5 4.5 5 3 4.33 3 3.5 3.67 2 4.5 2zM5 18l-1-8h16l-1 8H5z",
  },
  {
    name: "Government & Public Sector",
    iconPath: "M12 2L2 7l10 5 10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
  },
  {
    name: "Life Sciences",
    iconPath:
      "M19.8 18.4L14 10.67V6.5l1.35-1.69c.26-.33.03-.81-.39-.81H9.04c-.42 0-.65.48-.39.81L10 6.5v4.17L4.2 18.4c-.49.66-.02 1.6.8 1.6h14c.82 0 1.29-.94.8-1.6z",
  },
];

function PillRow({ suffix }: { suffix: string }) {
  return (
    <>
      {INDUSTRIES.map(({ name, iconPath }) => (
        <div
          key={`${suffix}-${name}`}
          className="flex shrink-0 items-center gap-2.5 border-r border-[#cbc9c9] px-7 py-3.5 whitespace-nowrap last:border-r-0"
        >
          <span className="inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center">
            <svg
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 fill-pulse-red"
              aria-hidden
            >
              <path d={iconPath} />
            </svg>
          </span>
          <span className="font-sans text-base font-semibold text-[#1a1a1a]">{name}</span>
        </div>
      ))}
    </>
  );
}

export default function IndustriesSection() {
  return (
    <section className="overflow-hidden bg-white px-6 py-16">
      <div className="mx-auto mb-9 max-w-[1200px] text-center">
        <span className="mb-3 block font-sans text-[13px] font-semibold tracking-[3px] text-pulse-teal uppercase">
          Who We Serve
        </span>
        <h2 className="font-sans text-[38px] font-bold tracking-tight text-[#1a1a1a]">
          Built for Your Industry
        </h2>
        <p className="mx-auto mt-2.5 max-w-[860px] font-sans text-base leading-relaxed text-[#646464]">
          With a team that has seen everything from manufacturing and legal to healthcare, insurance,
          and nonprofits, our rich tapestry of experiences allows us to combine the best technologies
          to meet your needs.
        </p>
      </div>
      <div className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute top-0 bottom-0 left-0 z-[2] w-20 bg-gradient-to-r from-white to-transparent"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute top-0 right-0 bottom-0 z-[2] w-20 bg-gradient-to-l from-white to-transparent"
          aria-hidden
        />
        <div className="marquee-track-animate flex w-max gap-0">
          <PillRow suffix="a" />
          <PillRow suffix="b" />
        </div>
      </div>
    </section>
  );
}
