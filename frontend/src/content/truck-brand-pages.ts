export interface TruckBrandPageConfig {
  slug: string;
  name: string;
  filterBrand: string;
  filterBrandAliases?: string[];
  logoSrc: string;
}

const BRAND_PLACEHOLDER_LOGO = "/brands/brand-placeholder.svg";

const BASE_TRUCK_BRAND_PAGES: TruckBrandPageConfig[] = [
  {
    slug: "sitrak",
    name: "SITRAK",
    filterBrand: "SITRAK",
    logoSrc: "/brands/sitrak.png",
  },
  {
    slug: "shacman",
    name: "Shacman",
    filterBrand: "Shacman",
    logoSrc: "/brands/shacman.png",
  },
  {
    slug: "kamaz",
    name: "KAMAZ",
    filterBrand: "KAMAZ",
    filterBrandAliases: ["Kamaz", "КАМАЗ", "Камаз"],
    logoSrc: "/brands/kamaz.png",
  },
  {
    slug: "faw",
    name: "FAW",
    filterBrand: "FAW",
    logoSrc: "/brands/faw.png",
  },
  {
    slug: "howo",
    name: "HOWO",
    filterBrand: "HOWO",
    logoSrc: "/brands/howo.png",
  },
  {
    slug: "isuzu",
    name: "Isuzu",
    filterBrand: "Isuzu",
    filterBrandAliases: ["ISUZU"],
    logoSrc: "/brands/isuzu.png",
  },
  {
    slug: "xcmg",
    name: "XCMG",
    filterBrand: "XCMG",
    logoSrc: "/brands/xcmg.png",
  },
  {
    slug: "sany",
    name: "SANY",
    filterBrand: "SANY",
    logoSrc: BRAND_PLACEHOLDER_LOGO,
  },
  {
    slug: "maz",
    name: "MAZ",
    filterBrand: "MAZ",
    filterBrandAliases: ["МАЗ", "Maz"],
    logoSrc: BRAND_PLACEHOLDER_LOGO,
  },
  {
    slug: "zoomlion",
    name: "Zoomlion",
    filterBrand: "Zoomlion",
    filterBrandAliases: ["ZOOMLION"],
    logoSrc: BRAND_PLACEHOLDER_LOGO,
  },
  {
    slug: "volvo",
    name: "Volvo",
    filterBrand: "Volvo",
    filterBrandAliases: ["VOLVO"],
    logoSrc: BRAND_PLACEHOLDER_LOGO,
  },
  {
    slug: "dongfeng",
    name: "Dongfeng",
    filterBrand: "Dongfeng",
    filterBrandAliases: ["DONGFENG"],
    logoSrc: BRAND_PLACEHOLDER_LOGO,
  },
  {
    slug: "jac",
    name: "JAC",
    filterBrand: "JAC",
    logoSrc: BRAND_PLACEHOLDER_LOGO,
  },
  {
    slug: "scania",
    name: "Scania",
    filterBrand: "Scania",
    filterBrandAliases: ["SCANIA"],
    logoSrc: BRAND_PLACEHOLDER_LOGO,
  },
  {
    slug: "hyundai",
    name: "Hyundai",
    filterBrand: "Hyundai",
    filterBrandAliases: ["HYUNDAI"],
    logoSrc: BRAND_PLACEHOLDER_LOGO,
  },
  {
    slug: "ural",
    name: "Ural",
    filterBrand: "Ural",
    filterBrandAliases: ["Урал", "УРАЛ"],
    logoSrc: BRAND_PLACEHOLDER_LOGO,
  },
  {
    slug: "ford",
    name: "Ford",
    filterBrand: "Ford",
    filterBrandAliases: ["FORD"],
    logoSrc: BRAND_PLACEHOLDER_LOGO,
  },
  {
    slug: "mercedes-benz",
    name: "Mercedes-Benz",
    filterBrand: "Mercedes-Benz",
    filterBrandAliases: ["Mercedes Benz", "Mercedes"],
    logoSrc: BRAND_PLACEHOLDER_LOGO,
  },
  {
    slug: "man",
    name: "MAN",
    filterBrand: "MAN",
    logoSrc: BRAND_PLACEHOLDER_LOGO,
  },
  {
    slug: "kanglim",
    name: "Kanglim",
    filterBrand: "Kanglim",
    filterBrandAliases: ["KANGLIM"],
    logoSrc: BRAND_PLACEHOLDER_LOGO,
  },
  {
    slug: "liugong",
    name: "LiuGong",
    filterBrand: "LiuGong",
    filterBrandAliases: ["LIUGONG", "Liu Gong"],
    logoSrc: BRAND_PLACEHOLDER_LOGO,
  },
  {
    slug: "lonking",
    name: "Lonking",
    filterBrand: "Lonking",
    filterBrandAliases: ["LONKING"],
    logoSrc: BRAND_PLACEHOLDER_LOGO,
  },
  {
    slug: "tonar",
    name: "Tonar",
    filterBrand: "Tonar",
    filterBrandAliases: ["ТОНАР", "TONAR"],
    logoSrc: BRAND_PLACEHOLDER_LOGO,
  },
  {
    slug: "daf",
    name: "DAF",
    filterBrand: "DAF",
    logoSrc: BRAND_PLACEHOLDER_LOGO,
  },
  {
    slug: "shantui",
    name: "Shantui",
    filterBrand: "Shantui",
    filterBrandAliases: ["SHANTUI"],
    logoSrc: BRAND_PLACEHOLDER_LOGO,
  },
  {
    slug: "iveco",
    name: "IVECO",
    filterBrand: "IVECO",
    filterBrandAliases: ["Iveco"],
    logoSrc: BRAND_PLACEHOLDER_LOGO,
  },
  {
    slug: "lovol",
    name: "Lovol",
    filterBrand: "Lovol",
    filterBrandAliases: ["LOVOL"],
    logoSrc: BRAND_PLACEHOLDER_LOGO,
  },
  {
    slug: "sollers",
    name: "Sollers",
    filterBrand: "Sollers",
    filterBrandAliases: ["SOLLERS"],
    logoSrc: BRAND_PLACEHOLDER_LOGO,
  },
  {
    slug: "gaz",
    name: "GAZ",
    filterBrand: "GAZ",
    filterBrandAliases: ["ГАЗ", "Gaz"],
    logoSrc: BRAND_PLACEHOLDER_LOGO,
  },
  {
    slug: "sdlg",
    name: "SDLG",
    filterBrand: "SDLG",
    logoSrc: BRAND_PLACEHOLDER_LOGO,
  },
  {
    slug: "hino",
    name: "Hino",
    filterBrand: "Hino",
    filterBrandAliases: ["HINO"],
    logoSrc: BRAND_PLACEHOLDER_LOGO,
  },
  {
    slug: "hongyan",
    name: "Hongyan",
    filterBrand: "Hongyan",
    filterBrandAliases: ["HONGYAN"],
    logoSrc: BRAND_PLACEHOLDER_LOGO,
  },
  {
    slug: "grunwald",
    name: "Grunwald",
    filterBrand: "Grunwald",
    filterBrandAliases: ["GRUNWALD"],
    logoSrc: BRAND_PLACEHOLDER_LOGO,
  },
];

export const TRUCK_BRAND_PAGES: TruckBrandPageConfig[] = BASE_TRUCK_BRAND_PAGES;

export const TRUCK_BRAND_SLUGS = TRUCK_BRAND_PAGES.map((item) => item.slug);

const TRUCK_BRAND_PAGES_BY_SLUG = new Map(
  TRUCK_BRAND_PAGES.map((item) => [item.slug, item]),
);

export function getTruckBrandPageBySlug(slug: string): TruckBrandPageConfig | undefined {
  return TRUCK_BRAND_PAGES_BY_SLUG.get(slug);
}


