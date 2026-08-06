import Image from "next/image";

const pillars = [
  {
    title: "We Listen",
    body: "Every technology decision starts and ends with the people it serves. We spend time with your team and listen before we recommend anything.",
    image: "/images/people_team.jpg",
    imageAlt: "People collaborating",
    badgeClass: "bg-pulse-red",
    icon: (
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <path
          fill="white"
          d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"
        />
      </svg>
    ),
  },
  {
    title: "We Understand",
    body: "We watch the technology landscape every day and translate it into what actually matters for your business, so you can decide with confidence.",
    image: "/images/technology_server.jpg",
    imageAlt: "Technology infrastructure",
    badgeClass: "bg-pulse-teal",
    icon: (
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <path
          fill="white"
          d="M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z"
        />
      </svg>
    ),
  },
  {
    title: "We Deliver",
    body: "We do the work ourselves, measure the results, and show you what changed at each step. You should be able to point at the progress.",
    image: "/images/progress_handshake.jpg",
    imageAlt: "Business progress and partnership",
    badgeClass: "bg-[#1a1a1a]",
    icon: (
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <path
          fill="white"
          d="M13 2.05V4.05C17.39 4.59 20.5 8.58 19.96 12.97C19.5 16.61 16.64 19.5 13 19.93V21.93C18.5 21.38 22.5 16.5 21.95 11C21.5 6.25 17.73 2.5 13 2.05M11 2.06C9.05 2.25 7.19 3 5.67 4.26L7.1 5.74C8.22 4.84 9.57 4.26 11 4.06V2.06M4.26 5.67C3 7.19 2.25 9.04 2.05 11H4.05C4.24 9.58 4.8 8.23 5.69 7.1L4.26 5.67M2.06 13C2.26 14.96 3.03 16.81 4.27 18.33L5.69 16.9C4.81 15.77 4.24 14.42 4.06 13H2.06M7.1 18.37L5.67 19.74C7.18 21 9.04 21.79 11 22V20C9.58 19.82 8.23 19.25 7.1 18.37M12 7L8 11H11V17H13V11H16L12 7Z"
        />
      </svg>
    ),
  },
];

export default function PhilosophySection() {
  return (
    <section id="philosophy" className="bg-light-bg px-6 py-20">
      <div className="mx-auto max-w-[1200px]">
        <div className="mb-14 max-w-[720px]">
          <span className="mb-3 block font-sans text-[13px] font-semibold tracking-[3px] text-pulse-teal uppercase">
            Why PulseOne?
          </span>
          <h2 className="mb-5 border-l-[5px] border-pulse-red py-0 pl-[18px] font-sans text-[40px] leading-tight font-bold tracking-tight text-[#1a1a1a]">
            A People-First Philosophy
          </h2>
          <p className="font-sans text-[17px] leading-[1.8] text-[#646464]">
            For over 20 years, PulseOne has operated across various industries on a simple belief:
            technology is only as powerful as the relationships built around it. Our customer service
            begins with listening to your wants, needs, and challenges.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {pillars.map((p) => (
            <div
              key={p.title}
              className="overflow-hidden rounded-lg bg-white shadow-[0_2px_14px_rgba(0,0,0,0.07)]"
            >
              <div className="relative block overflow-hidden">
                <Image
                  src={p.image}
                  alt={p.imageAlt}
                  width={800}
                  height={400}
                  className="h-[200px] w-full object-cover"
                />
                <div
                  className="pointer-events-none absolute inset-0 bg-gradient-to-br from-pulse-red/35 via-[rgba(10,10,10,0.15)] to-transparent"
                  aria-hidden
                />
              </div>
              <div className="px-[22px] pt-6 pb-6">
                <div
                  className={`mb-3.5 inline-flex h-11 w-11 items-center justify-center rounded-lg ${p.badgeClass}`}
                >
                  <span className="h-6 w-6">{p.icon}</span>
                </div>
                <h4 className="mb-2 font-sans text-[17px] font-bold text-[#1a1a1a]">{p.title}</h4>
                <p className="font-sans text-sm leading-relaxed text-[#646464]">{p.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
