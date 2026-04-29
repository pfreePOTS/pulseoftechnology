import Image from "next/image";
import Link from "next/link";

export default function GlobalFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-dark-bg text-white">
      <div className="mx-auto max-w-[1200px] px-6 py-16">
        <div className="grid gap-12 border-b border-white/10 pb-12 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="mb-4">
              <Image
                src="/pulseone_logo_official.png"
                alt="PulseOne"
                width={180}
                height={40}
                className="h-10 w-auto brightness-0 invert"
              />
            </div>
            <p className="font-sans text-sm leading-relaxed text-white/55">
              A strategic technology advisory firm and managed service provider. Helping
              organizations stay ahead of change since 2002.
            </p>
          </div>
          <div>
            <h5 className="mb-4 font-sans text-sm font-bold text-white">Our Services</h5>
            <div className="flex flex-col gap-2 font-sans text-sm text-white/55">
              <a href="#" className="hover:text-pulse-teal">
                Cybersecurity
              </a>
              <a href="#" className="hover:text-pulse-teal">
                AI &amp; Emerging Tech
              </a>
              <a href="#" className="hover:text-pulse-teal">
                Compliance &amp; Risk
              </a>
              <a href="#" className="hover:text-pulse-teal">
                Managed IT Services
              </a>
              <a href="#" className="hover:text-pulse-teal">
                Strategic Advisory
              </a>
            </div>
          </div>
          <div>
            <h5 className="mb-4 font-sans text-sm font-bold text-white">Pulse of Technology</h5>
            <div className="flex flex-col gap-2 font-sans text-sm text-white/55">
              <Link href="/radar" className="hover:text-pulse-teal">
                Technology Radar
              </Link>
              {/* External blog — opens in a new tab. `rel="noopener noreferrer"`
                  is required when using `target="_blank"` to prevent the new
                  page from accessing `window.opener` and to suppress Referer. */}
              <a
                href="https://blog.pulseone.com"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-pulse-teal"
              >
                Insights &amp; Articles
              </a>
              {/* Newsletter signup lives in the SubscribeWizard at the bottom
                  of /radar (the section is anchored by `id="subscribe"`). */}
              <Link href="/radar#subscribe" className="hover:text-pulse-teal">
                Newsletter
              </Link>
              <a href="#" className="hover:text-pulse-teal">
                Assessments
              </a>
            </div>
          </div>
          <div>
            <h5 className="mb-4 font-sans text-sm font-bold text-white">Company</h5>
            <div className="flex flex-col gap-2 font-sans text-sm text-white/55">
              <a href="#" className="hover:text-pulse-teal">
                Our Approach
              </a>
              <Link href="/industries" className="hover:text-pulse-teal">
                Industries We Serve
              </Link>
              <a href="#" className="hover:text-pulse-teal">
                Client Login
              </a>
              <Link href="/contact" className="hover:text-pulse-teal">
                Let&apos;s Talk
              </Link>
              <a href="#" className="hover:text-pulse-teal">
                Privacy Policy
              </a>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-3 pt-8 text-[13px] text-white/30 md:flex-row md:items-center md:justify-between">
          <p>© {year} PulseOne Group. All rights reserved.</p>
          <p className="text-center md:text-right">
            Ventura, CA · Los Angeles, CA · New Jersey · Nashville, TN · Bozeman, MT
          </p>
        </div>
      </div>
    </footer>
  );
}
