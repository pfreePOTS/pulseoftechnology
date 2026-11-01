export type LocationService = {
  title: string;
  body: string;
};

export type LocationPartner = {
  src: string;
  alt: string;
};

export type LocationPage = {
  slug: string;
  city: string;
  metaTitle: string;
  metaDescription: string;
  headline: string;
  areas: string;
  intro: string;
  services: readonly LocationService[];
  expertise: readonly string[];
  phone: string;
  image: string;
  imageAlt: string;
  /** Tailwind object-position class. Defaults to center. */
  imagePosition?: string;
  /** Required when the hero is a Creative Commons photo. */
  imageCredit?: { author: string; fileUrl: string };
};

/** The service list on the current pulseone.com city pages. */
const SERVICES: readonly LocationService[] = [
  {
    title: "CTO Services",
    body: "Managed IT consulting. Monthly, quarterly, or annual review and business planning sessions.",
  },
  {
    title: "End-User Help Desk",
    body: "Ongoing troubleshooting and problem resolution for typical business systems and applications.",
  },
  {
    title: "IT Security",
    body: "Assess, implement, and manage security across the firewall and network, plus physical and administrative controls. Quarterly or annual penetration testing, malware, and security assessments.",
  },
  {
    title: "Plan, Design, and Implement",
    body: "Project-based solution development, design, testing, and implementation. Specialties include cloud migrations, firewall and security, email, and Microsoft technologies.",
  },
  {
    title: "Project and Program Management",
    body: "Ongoing or project-based management of timelines, budgets, and resources for internal projects.",
  },
];

function expertise(area: string, customers: string): string[] {
  return [
    `IT consulting for small and medium businesses in ${area}`,
    "Managed IT support",
    "Microsoft 365, Microsoft Teams, and other Microsoft application deployment",
    `Onsite installation and training supporting ${customers} customers`,
    "Remote workforce and remote access",
    "Firewalls, network security, and VPN",
  ];
}

/** Partner marks already shown on the current city pages. Files live in /public/images. */
export const LOCATION_PARTNERS: readonly LocationPartner[] = [
  { src: "/images/logo_microsoft.png", alt: "Microsoft" },
  { src: "/images/logo_barracuda.jpg", alt: "Barracuda" },
  { src: "/images/logo_dell.png", alt: "Dell" },
  { src: "/images/logo_fortinet.png", alt: "Fortinet" },
  { src: "/images/logo_sonicwall.jpg", alt: "SonicWall" },
];

export const LOCATIONS: readonly LocationPage[] = [
  {
    slug: "los-angeles",
    city: "Los Angeles",
    metaTitle: "Managed IT Services in Los Angeles | PulseOne",
    metaDescription:
      "Managed IT services in Los Angeles. End-to-end IT management, cloud, security, and a local help desk from PulseOne.",
    headline: "Managed IT Services in Los Angeles",
    areas: "Los Angeles and the surrounding area",
    intro:
      "PulseOne is a managed IT provider in Los Angeles, with end-to-end IT management, cloud computing, and a team that keeps the business running. We monitor systems around the clock and respond when something breaks, so downtime stays short.",
    services: SERVICES,
    expertise: expertise("Los Angeles and surrounding areas", "Los Angeles"),
    phone: "213.802.0388",
    image: "/images/locations/los-angeles.jpg",
    imageAlt: "Downtown Los Angeles skyline at dusk",
    imagePosition: "object-[center_35%]",
  },
  {
    slug: "ventura",
    city: "Ventura",
    metaTitle: "Managed IT Services in Ventura | PulseOne",
    metaDescription:
      "Managed IT support for the Central Coast. PulseOne serves Ventura, Santa Barbara, Oxnard, Thousand Oaks, Simi Valley, and Ojai.",
    headline: "Managed IT Support for the Central Coast",
    areas: "Ventura • Santa Barbara • Oxnard • Thousand Oaks • Simi Valley • Ojai",
    intro:
      "Providing IT services on the Central Coast for over 20 years. Servicing Ventura, Camarillo, Simi Valley, Oxnard, Santa Barbara, Ojai, and other areas near you. The corporate office is at 1996 Eastman Avenue, Suite 111, Ventura.",
    services: SERVICES,
    expertise: expertise("the Central Coast and surrounding areas", "Central Coast"),
    phone: "805.901.8511",
    image: "/images/locations/ventura.jpg",
    imageAlt: "Ventura Pier from the dunes",
    imagePosition: "object-[center_70%]",
    imageCredit: {
      author: "Ymblanter",
      fileUrl: "https://commons.wikimedia.org/wiki/File:Ventura_Pier_from_the_dunes.jpg",
    },
  },
  {
    slug: "new-jersey",
    city: "New Jersey",
    metaTitle: "Managed IT Services in New Jersey | PulseOne",
    metaDescription:
      "Managed IT support for New Jersey. PulseOne serves Trenton, Edison, Newark, Princeton, and Levittown.",
    headline: "Managed IT Support for New Jersey",
    areas: "Trenton • Edison • Newark • Princeton • Levittown",
    intro:
      "Providing IT services to local businesses for over 18 years. Servicing Trenton, Edison, Newark, Princeton, Levittown, and other areas near you.",
    services: SERVICES,
    expertise: expertise("New Jersey and surrounding areas", "New Jersey"),
    phone: "732-913-0060",
    image: "/images/locations/new-jersey.jpg",
    imageAlt: "Jersey City skyline across the Hudson",
    imagePosition: "object-[center_30%]",
  },
  {
    slug: "bozeman",
    city: "Bozeman",
    metaTitle: "Managed IT Services in Bozeman | PulseOne",
    metaDescription:
      "Managed IT support for Bozeman. PulseOne serves Bozeman, Billings, Helena, Big Sky, and Butte.",
    headline: "Managed IT Support for Bozeman",
    areas: "Bozeman • Billings • Helena • Big Sky • Butte",
    intro:
      "Providing IT services to local businesses for over 18 years. Servicing Bozeman, Billings, Helena, Big Sky, Butte, and other areas near you.",
    services: SERVICES,
    expertise: expertise("Bozeman and surrounding areas", "Montana"),
    phone: "406-898-2300",
    image: "/images/locations/bozeman.jpg",
    imageAlt: "Bozeman and the Gallatin Valley from the Bridger Mountains",
    imagePosition: "object-[center_30%]",
    imageCredit: {
      author: "Dave Michael",
      fileUrl:
        "https://commons.wikimedia.org/wiki/File:Bozeman,_MT_from_Saddle_Peak_in_the_Bridger_Mountains,_Montana,_USA.jpg",
    },
  },
  {
    slug: "philadelphia",
    city: "Philadelphia",
    metaTitle: "Managed IT Support in Philadelphia | PulseOne",
    metaDescription:
      "Managed IT support for Philadelphia. PulseOne serves Philadelphia, Burlington, Newportville, Levittown, and Trenton.",
    headline: "Managed IT Support for Philadelphia",
    areas: "Philadelphia • Burlington • Newportville • Levittown • Trenton",
    intro:
      "Providing IT services to local businesses for over 18 years. Servicing North Philadelphia, Burlington, Newportville, Levittown, Trenton, and other areas near you.",
    services: SERVICES,
    expertise: expertise("Philadelphia and surrounding areas", "Philadelphia"),
    phone: "800.422.1156",
    image: "/images/locations/philadelphia.jpg",
    imageAlt: "Downtown Philadelphia skyline at dusk",
  },
  {
    slug: "nashville",
    city: "Nashville",
    metaTitle: "Managed IT Services in Nashville | PulseOne",
    metaDescription:
      "Managed IT support for Nashville and Middle Tennessee from PulseOne's Central Region office.",
    headline: "Managed IT Support for Nashville",
    areas: "Nashville • Franklin • Brentwood • Murfreesboro • Hendersonville",
    intro:
      "The Central Region office is in Nashville. PulseOne has provided IT services since 2002, and this office covers Nashville and the surrounding Middle Tennessee towns with the same help desk, security, and project work.",
    services: SERVICES,
    expertise: expertise("Nashville and surrounding areas", "Nashville"),
    phone: "629-895-0400",
    image: "/images/locations/nashville.jpg",
    imageAlt: "Nashville skyline and the Cumberland River",
    imagePosition: "object-[center_35%]",
  },
];

export function getLocation(slug: string): LocationPage | undefined {
  return LOCATIONS.find((location) => location.slug === slug);
}

export function locationPath(slug: string): string {
  return `/locations/${slug}`;
}
