import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import "../styles/partners.css";

const PARTNERS_PROBLEM_POINTS = [
  "Часть стока видит только ограниченный круг покупателей",
  "Публикация и\u00A0обновление требуют времени",
  "Не все автомобили попадают в\u00A0удобный для\u00A0брокеров контур поиска",
  "Деньги продолжают оставаться в\u00A0непроданном стоке дольше, чем могли\u00A0бы",
];
const CHANGE_CARD_MAIN_IMAGE = "/partners/change-card-main@2x.png";
const CHANGE_CARD_MAIN_IMAGE_WEBP = "/partners/change-card-main.960.webp";
const CHANGE_CARD_MAIN_IMAGE_AVIF = "/partners/change-card-main.960.avif";
const CHANGE_CARD_DISTRIBUTION_IMAGE = "/partners/change-card-distribution@2x.png";
const CHANGE_CARD_DISTRIBUTION_IMAGE_WEBP = "/partners/change-card-distribution.960.webp";
const CHANGE_CARD_DISTRIBUTION_IMAGE_AVIF = "/partners/change-card-distribution.960.avif";
const CHANGE_CARD_CHANNEL_IMAGE = "/partners/change-card-channel@2x.png";
const CHANGE_CARD_CHANNEL_IMAGE_WEBP = "/partners/change-card-channel.960.webp";
const CHANGE_CARD_CHANNEL_IMAGE_AVIF = "/partners/change-card-channel.960.avif";
const COVERAGE_SECTION_IMAGE = "/partners/partners-coverage-bg.jpg";
const COVERAGE_SECTION_IMAGE_WEBP = "/partners/partners-coverage-bg.960.webp 960w, /partners/partners-coverage-bg.1600.webp 1600w";
const COVERAGE_SECTION_IMAGE_AVIF = "/partners/partners-coverage-bg.960.avif 960w, /partners/partners-coverage-bg.1600.avif 1600w";
const HERO_CARD_IMAGE_LEFT = "/partners/partners-hero-card-left.jpg";
const HERO_CARD_IMAGE_LEFT_WEBP = "/partners/partners-hero-card-left.700.webp";
const HERO_CARD_IMAGE_LEFT_AVIF = "/partners/partners-hero-card-left.700.avif";
const HERO_CARD_IMAGE_MAIN = "/partners/partners-hero-card-main.jpg";
const HERO_CARD_IMAGE_MAIN_WEBP = "/partners/partners-hero-card-main.900.webp";
const HERO_CARD_IMAGE_MAIN_AVIF = "/partners/partners-hero-card-main.900.avif";
const HERO_CARD_IMAGE_RIGHT = "/partners/partners-hero-card-right.jpg";
const HERO_CARD_IMAGE_RIGHT_WEBP = "/partners/partners-hero-card-right.700.webp";
const HERO_CARD_IMAGE_RIGHT_AVIF = "/partners/partners-hero-card-right.700.avif";
const WHY_SECTION_IMAGE = "/partners/why-section-image@2x.png";
const WHY_SECTION_IMAGE_WEBP = "/partners/why-section-image.1200.webp";
const WHY_SECTION_IMAGE_AVIF = "/partners/why-section-image.1200.avif";

interface PartnersTypeChip {
  label: string;
  iconSrc: string;
}

interface PartnersWhyCard {
  title: string;
  text: string;
}

interface PartnersProcessStep {
  index: number;
  title: string;
  text: string;
}

type RevealSectionKey = "problem" | "change" | "why" | "process";

interface PartnersHeroCard {
  id: string;
  image: string;
  imageWebp: string;
  imageAvif: string;
  title: string;
  subtitle: string;
  price: string;
  badge: string;
  priceTone: "good" | "high";
  progressWidth: string;
}

const PARTNERS_TYPE_CHIPS: PartnersTypeChip[] = [
  {
    label: "изъятые автомобили",
    iconSrc: "/partners/1.png",
  },
  {
    label: "возвратный сток",
    iconSrc: "/partners/2.png",
  },
  {
    label: "грузовая и\u00A0легковая техника",
    iconSrc: "/partners/3.png",
  },
  {
    label: "коммерческий транспорт",
    iconSrc: "/partners/4.png",
  },
  {
    label: "машины, которые уже выведены в\u00A0продажу",
    iconSrc: "/partners/5.png",
  },
  {
    label: "эксклюзивные позиции, не размещённые на\u00A0вашей площадке",
    iconSrc: "/partners/6.png",
  },
];

const PARTNERS_WHY_CARDS: PartnersWhyCard[] = [
  {
    title: "Единый каталог",
    text: "Брокеры идут к\u00A0нам, потому что больше не\u00A0нужно искать машины по\u00A0отдельным источникам",
  },
  {
    title: "Нет нагрузки на\u00A0команду",
    text: "Вы не\u00A0заводите объявления вручную и\u00A0не\u00A0поддерживаете каталог самостоятельно.",
  },
  {
    title: "Бесплатное размещение",
    text: "Мы не\u00A0берём плату за\u00A0публикацию стока на\u00A0платформе",
  },
];

const PARTNERS_PROCESS_STEPS: PartnersProcessStep[] = [
  {
    index: 1,
    title: "Вы передаёте файл стока",
    text: "Текущая выгрузка из\u00A0базы в\u00A0xls, json или в\u00A0любом другом формате",
  },
  {
    index: 2,
    title: "Мы публикуем",
    text: "Самостоятельно загружаем лоты, оформляем размещение и\u00A0выводим автомобили на\u00A0платформу.",
  },
  {
    index: 3,
    title: "Присылаете обновления",
    text: "Когда состав стока меняется, вы просто отправляете новую выгрузку",
  },
  {
    index: 4,
    title: "Поддерживаем сами",
    text: "Обновляем каталог и\u00A0продолжаем вести размещение без\u00A0дополнительной нагрузки на\u00A0вашу команду.",
  },
];

const PARTNERS_HERO_CARDS: PartnersHeroCard[] = [
  {
    id: "left",
    image: HERO_CARD_IMAGE_LEFT,
    imageWebp: HERO_CARD_IMAGE_LEFT_WEBP,
    imageAvif: HERO_CARD_IMAGE_LEFT_AVIF,
    title: "Toyota Land Cruiser Prado",
    subtitle: "Prestige, 2024",
    price: "8 350 000₽",
    badge: "Выгодная цена",
    priceTone: "good",
    progressWidth: "84%",
  },
  {
    id: "center",
    image: HERO_CARD_IMAGE_MAIN,
    imageWebp: HERO_CARD_IMAGE_MAIN_WEBP,
    imageAvif: HERO_CARD_IMAGE_MAIN_AVIF,
    title: "LI (LiXiang) L9",
    subtitle: "Ultra, 2024",
    price: "6 950 000₽",
    badge: "Выгодная цена",
    priceTone: "good",
    progressWidth: "86%",
  },
  {
    id: "right",
    image: HERO_CARD_IMAGE_RIGHT,
    imageWebp: HERO_CARD_IMAGE_RIGHT_WEBP,
    imageAvif: HERO_CARD_IMAGE_RIGHT_AVIF,
    title: "Volkswagen Golf",
    subtitle: "Life, 2021",
    price: "2 450 000₽",
    badge: "Выше рынка",
    priceTone: "high",
    progressWidth: "62%",
  },
];

function shouldUseInteractiveScrollEffects(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return false;
  }

  return window.innerWidth >= 1024;
}

function ProblemBulletIcon() {
  return (
    <span className="partners-problem__icon" aria-hidden="true">
      <span className="partners-problem__icon-line" />
      <span className="partners-problem__icon-dot" />
    </span>
  );
}

export function PartnersPage() {
  const [heroIndex, setHeroIndex] = useState(1);
  const coverageRef = useRef<HTMLElement | null>(null);
  const coverageFrameRef = useRef<HTMLDivElement | null>(null);
  const coverageImageRef = useRef<HTMLImageElement | null>(null);
  const problemRef = useRef<HTMLElement | null>(null);
  const changeRef = useRef<HTMLElement | null>(null);
  const typeRef = useRef<HTMLElement | null>(null);
  const whyRef = useRef<HTMLElement | null>(null);
  const processRef = useRef<HTMLElement | null>(null);
  const ctaRef = useRef<HTMLElement | null>(null);
  const [isCtaVisible, setIsCtaVisible] = useState(false);
  const [revealedSections, setRevealedSections] = useState<Record<RevealSectionKey, boolean>>({
    problem: false,
    change: false,
    why: false,
    process: false,
  });

  const handleHeroNext = useCallback(() => {
    setHeroIndex((prevIndex) => (prevIndex + 1) % PARTNERS_HERO_CARDS.length);
  }, []);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const timerId = window.setInterval(() => {
      handleHeroNext();
    }, 2000);

    return () => {
      window.clearInterval(timerId);
    };
  }, [handleHeroNext]);

  useEffect(() => {
    const sectionNode = coverageRef.current;
    const frameNode = coverageFrameRef.current;
    const imageNode = coverageImageRef.current;
    if (!sectionNode || !frameNode || !imageNode || typeof window === "undefined") {
      return;
    }

    if (!shouldUseInteractiveScrollEffects()) {
      sectionNode.style.setProperty("--partners-header-offset", "0px");
      sectionNode.style.setProperty("--coverage-scroll-distance", "0px");
      imageNode.style.transform = "translate3d(0, 0, 0)";
      return;
    }

    let rafId = 0;
    let scrollDistance = 0;
    let headerOffset = 0;
    let resizeObserver: ResizeObserver | null = null;
    let headerResizeObserver: ResizeObserver | null = null;

    const clampProgress = (value: number): number => Math.min(1, Math.max(0, value));

    const readHeaderOffset = (): number => {
      const headerNode = document.querySelector<HTMLElement>(".landing-header");
      if (!headerNode) {
        return 0;
      }
      return Math.ceil(headerNode.getBoundingClientRect().height);
    };

    const updateImageOffset = () => {
      rafId = 0;
      const rect = sectionNode.getBoundingClientRect();
      const stickyTop = headerOffset + 8;
      const travelDistance = Math.max(scrollDistance, 1);
      const progress = clampProgress((stickyTop - rect.top) / travelDistance);
      const offset = progress * scrollDistance;
      imageNode.style.transform = `translate3d(0, ${-offset}px, 0)`;
    };

    const requestOffsetUpdate = () => {
      if (rafId === 0) {
        rafId = window.requestAnimationFrame(updateImageOffset);
      }
    };

    const measureSection = () => {
      headerOffset = readHeaderOffset();
      sectionNode.style.setProperty("--partners-header-offset", `${headerOffset}px`);
      scrollDistance = Math.max(imageNode.clientHeight - frameNode.clientHeight, 0);
      sectionNode.style.setProperty("--coverage-scroll-distance", `${scrollDistance}px`);
      requestOffsetUpdate();
    };

    const handleScroll = () => {
      requestOffsetUpdate();
    };

    const handleResize = () => {
      measureSection();
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleResize);

    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        measureSection();
      });
      resizeObserver.observe(frameNode);
      resizeObserver.observe(imageNode);

      const headerNode = document.querySelector<HTMLElement>(".landing-header");
      if (headerNode) {
        headerResizeObserver = new ResizeObserver(() => {
          measureSection();
        });
        headerResizeObserver.observe(headerNode);
      }
    }

    const handleImageLoad = () => {
      measureSection();
    };

    if (imageNode.complete) {
      measureSection();
    } else {
      imageNode.addEventListener("load", handleImageLoad);
    }

    return () => {
      if (rafId !== 0) {
        window.cancelAnimationFrame(rafId);
      }
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
      imageNode.removeEventListener("load", handleImageLoad);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (headerResizeObserver) {
        headerResizeObserver.disconnect();
      }
    };
  }, []);

  useEffect(() => {
    const sectionNode = typeRef.current;
    if (!sectionNode || typeof window === "undefined") {
      return;
    }

    if (!shouldUseInteractiveScrollEffects()) {
      sectionNode.style.setProperty("--partners-type-progress", "1");
      sectionNode.style.setProperty("--partners-type-completion-progress", "1");
      sectionNode.style.setProperty("--partners-type-heading-progress", "1");
      sectionNode.style.setProperty("--partners-type-bg-progress", "1");
      sectionNode.style.setProperty("--partners-type-stage", `${PARTNERS_TYPE_CHIPS.length}`);
      sectionNode.style.setProperty("--partners-type-header-offset", "0px");
      sectionNode.style.setProperty("--partners-type-section-height", "auto");
      return;
    }

    const shellNode = sectionNode.querySelector<HTMLElement>(".partners-type__shell");
    if (!shellNode) {
      return;
    }

    let rafId = 0;
    let scrollDistance = 1;
    let stickyTopOffset = 0;
    let introDistance = 140;
    let backgroundDistance = 180;
    let chipsDistance = 360;
    let completionDistance = 1;

    const clampProgress = (value: number): number => Math.min(1, Math.max(0, value));
    const clampRange = (value: number, min: number, max: number): number =>
      Math.min(max, Math.max(min, value));
    const clampStage = (value: number): number =>
      Math.min(PARTNERS_TYPE_CHIPS.length, Math.max(0, value));

    const readHeaderOffset = (): number => {
      const headerNode = document.querySelector<HTMLElement>(".landing-header");
      if (!headerNode) {
        return 0;
      }
      return Math.ceil(headerNode.getBoundingClientRect().height);
    };

    const updateProgress = () => {
      rafId = 0;
      const rect = sectionNode.getBoundingClientRect();
      const totalDistance = Math.max(scrollDistance, 1);
      const traveledDistance = clampRange(stickyTopOffset - rect.top, 0, totalDistance);
      const headingProgress = clampProgress(traveledDistance / Math.max(introDistance, 1));
      const backgroundStartDistance = Math.round(introDistance * 0.35);
      const backgroundProgress = clampProgress(
        (traveledDistance - backgroundStartDistance) / Math.max(backgroundDistance, 1),
      );
      const chipsStartDistance = introDistance + backgroundDistance;
      const chipsProgress = clampProgress(
        (traveledDistance - chipsStartDistance) / Math.max(chipsDistance, 1),
      );
      const stage = clampStage(
        Math.floor(chipsProgress * PARTNERS_TYPE_CHIPS.length + 0.00001),
      );
      const progress = clampProgress(traveledDistance / totalDistance);
      const completionProgress = clampProgress(traveledDistance / Math.max(completionDistance, 1));
      sectionNode.style.setProperty("--partners-type-progress", progress.toFixed(3));
      sectionNode.style.setProperty("--partners-type-completion-progress", completionProgress.toFixed(3));
      sectionNode.style.setProperty("--partners-type-heading-progress", headingProgress.toFixed(3));
      sectionNode.style.setProperty("--partners-type-bg-progress", backgroundProgress.toFixed(3));
      sectionNode.style.setProperty("--partners-type-stage", `${stage}`);
    };

    const requestProgressUpdate = () => {
      if (rafId === 0) {
        rafId = window.requestAnimationFrame(updateProgress);
      }
    };

    const measureSection = () => {
      const headerOffset = readHeaderOffset();
      stickyTopOffset = headerOffset + 8;
      sectionNode.style.setProperty("--partners-type-header-offset", `${stickyTopOffset}px`);
      introDistance = Math.max(120, Math.min(Math.round(window.innerHeight * 0.16), 180));
      backgroundDistance = Math.max(140, Math.min(Math.round(window.innerHeight * 0.2), 220));
      const chipStepDistance = Math.max(46, Math.min(Math.round(window.innerHeight * 0.07), 68));
      chipsDistance = chipStepDistance * PARTNERS_TYPE_CHIPS.length;
      completionDistance = introDistance + backgroundDistance + chipsDistance;
      const holdAfterReveal = 24;
      const minTailDistance = 120;
      const requiredTailForPush = Math.max(
        window.innerHeight - shellNode.offsetHeight - stickyTopOffset + holdAfterReveal,
        minTailDistance,
      );
      scrollDistance = completionDistance + requiredTailForPush;
      const sectionHeight = shellNode.offsetHeight + scrollDistance;
      sectionNode.style.setProperty("--partners-type-section-height", `${sectionHeight}px`);
      requestProgressUpdate();
    };

    const handleScroll = () => {
      requestProgressUpdate();
    };

    const handleResize = () => {
      measureSection();
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleResize);
    measureSection();

    return () => {
      if (rafId !== 0) {
        window.cancelAnimationFrame(rafId);
      }
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    const revealTargets: Array<{ key: RevealSectionKey; node: HTMLElement | null }> = [
      { key: "problem", node: problemRef.current },
      { key: "change", node: changeRef.current },
      { key: "why", node: whyRef.current },
      { key: "process", node: processRef.current },
    ];

    if (typeof IntersectionObserver === "undefined") {
      setRevealedSections({
        problem: true,
        change: true,
        why: true,
        process: true,
      });
      return;
    }

    const nodeToKey = new Map<Element, RevealSectionKey>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) {
            continue;
          }
          const key = nodeToKey.get(entry.target);
          if (!key) {
            continue;
          }
          setRevealedSections((prev) => {
            if (prev[key]) {
              return prev;
            }
            return { ...prev, [key]: true };
          });
          observer.unobserve(entry.target);
        }
      },
      {
        threshold: 0.28,
        rootMargin: "0px 0px -140px 0px",
      },
    );

    for (const target of revealTargets) {
      if (!target.node) {
        continue;
      }
      nodeToKey.set(target.node, target.key);
      observer.observe(target.node);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const sectionNode = ctaRef.current;
    if (!sectionNode) {
      return;
    }

    if (typeof IntersectionObserver === "undefined") {
      setIsCtaVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setIsCtaVisible(true);
            observer.disconnect();
            break;
          }
        }
      },
      {
        threshold: 0.28,
        rootMargin: "0px 0px -140px 0px",
      },
    );

    observer.observe(sectionNode);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="partners-page">
      <div className="partners-page__shell">
        <section className="partners-hero" aria-labelledby="partners-hero-title">
          <div className="partners-hero__heading">
            <p>{"Партнёрство с\u00A0реАктив"}</p>
            <h1 id="partners-hero-title">{"Бесплатный источник лидов для\u00A0лизинговых компаний"}</h1>
            <p className="partners-hero__description">
              {"Мы собираем автомобили от\u00A0разных держателей в\u00A0одной системе, приводим на\u00A0платформу "}
              {"брокеров и\u00A0даём партнёрам ещё одну точку продаж"}
            </p>
          </div>

          <div className="partners-hero__actions">
            <a
              className="partners-hero__button partners-hero__button--primary"
              href="https://forms.yandex.ru/u/69afbe1e84227c93c7f0d9e2"
              target="_blank"
              rel="noreferrer noopener"
            >
              Заполнить форму
            </a>
            <a
              className="partners-hero__button partners-hero__button--secondary"
              href="https://t.me/romanodokienko"
              target="_blank"
              rel="noreferrer noopener"
            >
              Написать в Telegram
            </a>
          </div>

          <div className="partners-hero-carousel">
            <div className="partners-hero-carousel__track">
              {PARTNERS_HERO_CARDS.map((card, index) => {
                const offset = index - heroIndex;
                const total = PARTNERS_HERO_CARDS.length;
                let position = (offset + total) % total;
                if (position > Math.floor(total / 2)) {
                  position -= total;
                }

                const isCenter = position === 0;
                const isAdjacent = Math.abs(position) === 1;
                const isHighPrice = card.priceTone === "high";

                return (
                  <article
                    key={card.id}
                    className="partners-hero-card"
                    style={
                      {
                        "--hero-pos": `${position}`,
                        "--hero-size": `${isCenter ? 1.42 : 1}`,
                        "--hero-y": isCenter ? "0px" : "52px",
                        "--hero-progress-track": isHighPrice ? "#ffe8cd" : "#d7ecdc",
                        "--hero-progress-fill": isHighPrice ? "#f59b2f" : "#229968",
                        "--hero-progress-width": card.progressWidth,
                        "--hero-badge-color": "rgba(0, 0, 0, 0.5)",
                        zIndex: isCenter ? 4 : isAdjacent ? 2 : 1,
                        opacity: isCenter ? 1 : isAdjacent ? 0.4 : 0,
                        visibility: Math.abs(position) > 1 ? "hidden" : "visible",
                      } as CSSProperties
                    }
                    aria-hidden={!isCenter}
                  >
                    <div className="partners-hero-card__media">
                      <picture>
                        <source srcSet={card.imageAvif} type="image/avif" />
                        <source srcSet={card.imageWebp} type="image/webp" />
                        <img
                          src={card.image}
                          alt={card.title}
                          loading={isCenter ? "eager" : "lazy"}
                          fetchPriority={isCenter ? "high" : "low"}
                          decoding="async"
                        />
                      </picture>
                    </div>

                    <div className="partners-hero-card__body">
                      <div className="partners-hero-card__title-block">
                        <p className="partners-hero-card__title">{card.title}</p>
                        <p className="partners-hero-card__subtitle">{card.subtitle}</p>
                      </div>

                      <div className="partners-hero-card__price-block">
                        <p className="partners-hero-card__price">{card.price}</p>
                        <div className="partners-hero-card__progress">
                          <span />
                        </div>
                        <p className="partners-hero-card__badge">{card.badge}</p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="partners-hero-carousel__fade partners-hero-carousel__fade--left" aria-hidden="true" />
            <div className="partners-hero-carousel__fade partners-hero-carousel__fade--right" aria-hidden="true" />
          </div>
        </section>

        <section
          ref={coverageRef}
          className="partners-coverage"
          aria-label="Покрытие стока на\u00A0платформе"
        >
          <div className="partners-coverage__sticky">
            <div ref={coverageFrameRef} className="partners-coverage__inner">
              <picture>
                <source
                  srcSet={COVERAGE_SECTION_IMAGE_AVIF}
                  sizes="(max-width: 1023px) 100vw, 920px"
                  type="image/avif"
                />
                <source
                  srcSet={COVERAGE_SECTION_IMAGE_WEBP}
                  sizes="(max-width: 1023px) 100vw, 920px"
                  type="image/webp"
                />
                <img
                  ref={coverageImageRef}
                  src={COVERAGE_SECTION_IMAGE}
                  alt=""
                  loading="lazy"
                  fetchPriority="low"
                  decoding="async"
                />
              </picture>
              <article className="partners-coverage__badge">
                <p className="partners-coverage__badge-title">{"17 000+ лотов на\u00A0платформе"}</p>
                <p className="partners-coverage__badge-text">
                  {"Мы уже размещаем технику наших партнёров: РЕСО, Альфа-Лизинг, "}
                  {"Газпромбанк Автолизинг, Совкомбанк Лизинг"}
                </p>
              </article>
            </div>
          </div>
        </section>

        <section
          ref={problemRef}
          className={`partners-problem${revealedSections.problem ? " is-visible" : ""}`}
          aria-labelledby="partners-problem-title"
        >
          <h2 id="partners-problem-title">
            {"Проблема замороженного стока в\u00A0том, что спрос распределяется неэффективно"}
          </h2>

          <ul className="partners-problem__list">
            {PARTNERS_PROBLEM_POINTS.map((point) => (
              <li key={point} className="partners-problem__item">
                <p>{point}</p>
                <ProblemBulletIcon />
              </li>
            ))}
          </ul>
        </section>

        <section
          ref={changeRef}
          className={`partners-change${revealedSections.change ? " is-visible" : ""}`}
          aria-labelledby="partners-change-title"
        >
          <div className="partners-change__heading">
            <p>{"Что меняется с\u00A0нами?"}</p>
            <h2 id="partners-change-title">
              {"ре"}
              <span>А</span>
              {"ктив - это единый агрегатор лизингового стока"}
            </h2>
          </div>

          <div className="partners-change__cards">
            <article className="partners-change-card partners-change-card--main">
              <p>{"Поиск техники сразу по\u00A0рынку, а\u00A0не по\u00A0отдельным сайтам"}</p>
              <div className="partners-change-card__main-image">
                <picture>
                  <source srcSet={CHANGE_CARD_MAIN_IMAGE_AVIF} type="image/avif" />
                  <source srcSet={CHANGE_CARD_MAIN_IMAGE_WEBP} type="image/webp" />
                  <img
                    src={CHANGE_CARD_MAIN_IMAGE}
                    alt=""
                    loading="lazy"
                    decoding="async"
                  />
                </picture>
              </div>
            </article>

            <div className="partners-change__side-cards">
              <article className="partners-change-card partners-change-card--side">
                <div className="partners-change-card__icon partners-change-card__icon--distribution">
                  <picture>
                    <source srcSet={CHANGE_CARD_DISTRIBUTION_IMAGE_AVIF} type="image/avif" />
                    <source srcSet={CHANGE_CARD_DISTRIBUTION_IMAGE_WEBP} type="image/webp" />
                    <img
                      src={CHANGE_CARD_DISTRIBUTION_IMAGE}
                      alt=""
                      loading="lazy"
                      decoding="async"
                    />
                  </picture>
                </div>
                <p>
                  {"Дистрибуция там,"} <br />
                  {"где уже есть целевой спрос"}
                </p>
              </article>

              <article className="partners-change-card partners-change-card--side">
                <div className="partners-change-card__icon partners-change-card__icon--channel">
                  <picture>
                    <source srcSet={CHANGE_CARD_CHANNEL_IMAGE_AVIF} type="image/avif" />
                    <source srcSet={CHANGE_CARD_CHANNEL_IMAGE_WEBP} type="image/webp" />
                    <img
                      src={CHANGE_CARD_CHANNEL_IMAGE}
                      alt=""
                      loading="lazy"
                      decoding="async"
                    />
                  </picture>
                </div>
                <p>{"Дополнительный бесплатный канал продаж"}</p>
              </article>
            </div>
          </div>
        </section>

        <section
          ref={typeRef}
          className="partners-type partners-page__bleed"
          aria-labelledby="partners-type-title"
        >
          <div className="partners-type__sticky">
            <div className="partners-type__shell">
              <h2 id="partners-type-title">{"Что подходит для\u00A0публикации на\u00A0платформе"}</h2>
              <div className="partners-type__chips">
                {PARTNERS_TYPE_CHIPS.map((chip, index) => (
                  <article
                    key={chip.label}
                    className="partners-type-chip"
                    style={
                      {
                        "--chip-index": `${index}`,
                        "--chip-stage": `${index + 1}`,
                      } as CSSProperties
                    }
                  >
                    <span className="partners-type-chip__icon" aria-hidden="true">
                      <img
                        src={chip.iconSrc}
                        alt=""
                        loading="lazy"
                        decoding="async"
                      />
                    </span>
                    <p>{chip.label}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section
          ref={whyRef}
          className={`partners-why${revealedSections.why ? " is-visible" : ""}`}
          aria-labelledby="partners-why-title"
        >
          <div className="partners-why__heading">
            <p>{"Плюсы для\u00A0партнёра"}</p>
            <h2 id="partners-why-title">Зачем подключаться?</h2>
          </div>

          <div className="partners-why__visual">
            <div className="partners-why__image-wrap">
              <picture>
                <source srcSet={WHY_SECTION_IMAGE_AVIF} type="image/avif" />
                <source srcSet={WHY_SECTION_IMAGE_WEBP} type="image/webp" />
                <img
                  src={WHY_SECTION_IMAGE}
                  alt=""
                  loading="lazy"
                  decoding="async"
                />
              </picture>
            </div>

            <div className="partners-why__cards">
              {PARTNERS_WHY_CARDS.map((card) => (
                <article key={card.title} className="partners-why-card">
                  <h3>{card.title}</h3>
                  <p>{card.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section
          ref={processRef}
          className={`partners-process${revealedSections.process ? " is-visible" : ""}`}
          aria-labelledby="partners-process-title"
        >
          <div className="partners-process__heading">
            <p>{"Как это работает для\u00A0вас"}</p>
            <h2 id="partners-process-title">{"Подключение без\u00A0сложного процесса"}</h2>
          </div>

          <div className="partners-process__steps">
            {PARTNERS_PROCESS_STEPS.map((step, index) => (
              <article
                key={step.index}
                className="partners-process-step"
                style={{ "--process-step-index": `${index}` } as CSSProperties}
              >
                <span className="partners-process-step__index" aria-hidden="true">
                  {step.index}
                </span>
                <div className="partners-process-step__content">
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section
          ref={ctaRef}
          className={`partners-cta partners-page__bleed${isCtaVisible ? " is-visible" : ""}`}
          aria-labelledby="partners-cta-title"
        >
          <div className="partners-cta__shell">
            <h2 id="partners-cta-title">
              {"Получите дополнительный канал спроса для\u00A0продажи вашей техники"}
            </h2>
            <div className="partners-cta__actions">
              <a
                className="partners-cta__button partners-cta__button--primary"
                href="https://forms.yandex.ru/u/69afbe1e84227c93c7f0d9e2"
                target="_blank"
                rel="noreferrer noopener"
              >
                Заполнить форму
              </a>
              <a
                className="partners-cta__button partners-cta__button--secondary"
                href="https://t.me/romanodokienko"
                target="_blank"
                rel="noreferrer noopener"
              >
                Написать в Telegram
              </a>
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}
