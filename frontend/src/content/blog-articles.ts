export interface BlogArticleMeta {
  slug: string;
  title: string;
  cardTitle: string;
  readingTime: string;
  seoTitle: string;
  seoDescription: string;
}

export interface BlogPlaceholderCard {
  title: string;
  readingTime: string;
}

export const BLOG_ARTICLES: BlogArticleMeta[] = [
  {
    slug: "auto-posle-lizinga-stoit-li-pokupat-i-chego-opasatsya",
    title: "Авто после лизинга: стоит ли покупать и чего опасаться",
    cardTitle: "Авто после лизинга: стоит ли покупать и чего опасаться",
    readingTime: "~ 8 минут чтения",
    seoTitle: "Авто после лизинга: стоит ли покупать и чего опасаться — Блог РеАктив",
    seoDescription:
      "Разбираем, как проверить авто после лизинга перед покупкой: ограничения, залоги, документы, риски и порядок безопасной сделки.",
  },
  {
    slug: "kak-proverit-avtomobil-na-lizing-po-vin-i-gosnomeru",
    title: "Как проверить автомобиль на лизинг по VIN и госномеру",
    cardTitle: "Как проверить автомобиль на лизинг по VIN и госномеру",
    readingTime: "~ 6 минут чтения",
    seoTitle: "Как проверить автомобиль на лизинг по VIN и госномеру — Блог РеАктив",
    seoDescription:
      "Пошагово разбираем, как проверить авто на лизинг по VIN и госномеру: где смотреть залог, ограничения и как снизить риски сделки.",
  },
  {
    slug: "kupit-avto-s-probegom-u-lizingovoy-kompanii-poshagovo",
    title: "Купить авто с пробегом у лизинговой компании: пошагово от выбора лота до сделки",
    cardTitle: "Купить авто с пробегом у лизинговой компании: пошагово от выбора лота до сделки",
    readingTime: "~ 8 минут чтения",
    seoTitle:
      "Купить авто с пробегом у лизинговой компании: пошагово от выбора лота до сделки — Блог РеАктив",
    seoDescription:
      "Пошаговый разбор покупки авто у лизинговой компании: где искать лоты, как проверить документы, осмотреть машину и безопасно оформить сделку.",
  },
  {
    slug: "chek-list-osmotra-avto-posle-lizinga",
    title: "Чек-лист осмотра авто после лизинга: пробег, кузов, сервисная история, документы",
    cardTitle: "Чек-лист осмотра авто после лизинга: пробег, кузов, сервисная история, документы",
    readingTime: "~ 6 минут чтения",
    seoTitle:
      "Чек-лист осмотра авто после лизинга: пробег, кузов, сервисная история, документы — Блог РеАктив",
    seoDescription:
      "Практичный чек-лист проверки авто после лизинга: пробег, кузов, сервисная история и документы перед покупкой.",
  },
  {
    slug: "pokupka-avto-posle-lizinga-s-nds",
    title: "Покупка авто после лизинга с НДС: кому выгодно и какие документы просить",
    cardTitle: "Покупка авто после лизинга с НДС: кому выгодно и какие документы просить",
    readingTime: "~ 5 минут чтения",
    seoTitle:
      "Покупка авто после лизинга с НДС: кому выгодно и какие документы просить — Блог РеАктив",
    seoDescription:
      "Разбираем, когда покупка авто после лизинга с НДС действительно выгодна, и какие документы обязательно проверить перед сделкой.",
  },
];

export const BLOG_PLACEHOLDER_CARDS: BlogPlaceholderCard[] = [];

const BLOG_ARTICLES_BY_SLUG = new Map(BLOG_ARTICLES.map((article) => [article.slug, article]));

export function getBlogArticleBySlug(slug: string): BlogArticleMeta | undefined {
  return BLOG_ARTICLES_BY_SLUG.get(slug);
}
