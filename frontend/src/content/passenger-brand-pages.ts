export interface PassengerBrandPageConfig {
  slug: string;
  name: string;
  filterBrand: string;
  filterBrandAliases?: string[];
  logoSrc: string;
}

const BRAND_PLACEHOLDER_LOGO = "/brands/brand-placeholder.svg";

const BASE_PASSENGER_BRAND_PAGES: PassengerBrandPageConfig[] = [
  {
    slug: "mercedes-benz",
    name: "Mercedes",
    filterBrand: "Mercedes-Benz",
    filterBrandAliases: ["Mercedes Benz", "Mercedes"],
    logoSrc: "/brands/mersedes.png",
  },
  {
    slug: "bmw",
    name: "BMW",
    filterBrand: "BMW",
    logoSrc: "/brands/bmw.png",
  },
  {
    slug: "lexus",
    name: "Lexus",
    filterBrand: "Lexus",
    logoSrc: "/brands/lexus.png",
  },
  {
    slug: "li",
    name: "Li",
    filterBrand: "Li",
    filterBrandAliases: ["Li (Lixiang)", "Li Xiang", "Lixiang"],
    logoSrc: "/brands/li.png",
  },
  {
    slug: "haval",
    name: "Haval",
    filterBrand: "Haval",
    logoSrc: "/brands/haval.png",
  },
  {
    slug: "toyota",
    name: "Toyota",
    filterBrand: "Toyota",
    logoSrc: "/brands/toyota.png",
  },
  {
    slug: "audi",
    name: "Audi",
    filterBrand: "Audi",
    logoSrc: "/brands/audi.png",
  },
  {
    slug: "land-rover",
    name: "Land Rover",
    filterBrand: "Land Rover",
    filterBrandAliases: ["Land-Rover", "Range Rover"],
    logoSrc: BRAND_PLACEHOLDER_LOGO,
  },
  {
    slug: "zeekr",
    name: "Zeekr",
    filterBrand: "Zeekr",
    logoSrc: BRAND_PLACEHOLDER_LOGO,
  },
  {
    slug: "volkswagen",
    name: "Volkswagen",
    filterBrand: "Volkswagen",
    logoSrc: BRAND_PLACEHOLDER_LOGO,
  },
  {
    slug: "hyundai",
    name: "Hyundai",
    filterBrand: "Hyundai",
    logoSrc: BRAND_PLACEHOLDER_LOGO,
  },
  {
    slug: "kia",
    name: "Kia",
    filterBrand: "Kia",
    logoSrc: BRAND_PLACEHOLDER_LOGO,
  },
  {
    slug: "geely",
    name: "Geely",
    filterBrand: "Geely",
    logoSrc: BRAND_PLACEHOLDER_LOGO,
  },
  {
    slug: "lada",
    name: "Lada",
    filterBrand: "Lada",
    logoSrc: BRAND_PLACEHOLDER_LOGO,
  },
  {
    slug: "porsche",
    name: "Porsche",
    filterBrand: "Porsche",
    logoSrc: BRAND_PLACEHOLDER_LOGO,
  },
  {
    slug: "tank",
    name: "Tank",
    filterBrand: "Tank",
    logoSrc: BRAND_PLACEHOLDER_LOGO,
  },
  {
    slug: "ford",
    name: "Ford",
    filterBrand: "Ford",
    logoSrc: BRAND_PLACEHOLDER_LOGO,
  },
  {
    slug: "mazda",
    name: "Mazda",
    filterBrand: "Mazda",
    logoSrc: BRAND_PLACEHOLDER_LOGO,
  },
  {
    slug: "voyah",
    name: "Voyah",
    filterBrand: "Voyah",
    logoSrc: BRAND_PLACEHOLDER_LOGO,
  },
  {
    slug: "gac",
    name: "GAC",
    filterBrand: "GAC",
    logoSrc: BRAND_PLACEHOLDER_LOGO,
  },
  {
    slug: "skoda",
    name: "Skoda",
    filterBrand: "Skoda",
    logoSrc: BRAND_PLACEHOLDER_LOGO,
  },
  {
    slug: "mitsubishi",
    name: "Mitsubishi",
    filterBrand: "Mitsubishi",
    logoSrc: BRAND_PLACEHOLDER_LOGO,
  },
  {
    slug: "nissan",
    name: "Nissan",
    filterBrand: "Nissan",
    logoSrc: BRAND_PLACEHOLDER_LOGO,
  },
  {
    slug: "jetour",
    name: "Jetour",
    filterBrand: "Jetour",
    logoSrc: BRAND_PLACEHOLDER_LOGO,
  },
  {
    slug: "belgee",
    name: "Belgee",
    filterBrand: "Belgee",
    logoSrc: BRAND_PLACEHOLDER_LOGO,
  },
  {
    slug: "jaecoo",
    name: "Jaecoo",
    filterBrand: "Jaecoo",
    logoSrc: BRAND_PLACEHOLDER_LOGO,
  },
];

export const PASSENGER_BRAND_PAGES: PassengerBrandPageConfig[] =
  BASE_PASSENGER_BRAND_PAGES;

export const PASSENGER_BRAND_SLUGS = PASSENGER_BRAND_PAGES.map((item) => item.slug);

const PASSENGER_BRAND_PAGES_BY_SLUG = new Map(
  PASSENGER_BRAND_PAGES.map((item) => [item.slug, item]),
);

export function getPassengerBrandPageBySlug(
  slug: string,
): PassengerBrandPageConfig | undefined {
  return PASSENGER_BRAND_PAGES_BY_SLUG.get(slug);
}
