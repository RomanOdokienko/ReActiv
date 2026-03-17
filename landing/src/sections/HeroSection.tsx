export function HeroSection() {
  return (
    <section className="hero">
      <div className="hero__copy">
        <span className="hero__eyebrow">Независимый лендинг</span>
        <h1>Единая витрина изъятой лизинговой техники для быстрой сделки</h1>
        <p className="hero__lead">
          Отдельный маркетинговый слой для ReActiv: без касаний кабинета, витрины и логики
          импорта. Здесь можно спокойно тестировать оффер, визуал и конверсионные блоки.
        </p>
        <div className="hero__actions">
          <a className="button button--primary" href="#contact">
            Получить демо
          </a>
          <a className="button button--ghost" href="#benefits">
            Посмотреть структуру
          </a>
        </div>
        <ul className="hero__facts" aria-label="Ключевые преимущества">
          <li>Отдельное React-приложение</li>
          <li>Собственный CSS и компоненты</li>
          <li>Ноль правок в существующем frontend</li>
        </ul>
      </div>

      <div className="hero__panel" aria-label="Смысловая карточка продукта">
        <div className="hero__panel-badge">B2B marketplace</div>
        <div className="hero__panel-grid">
          <article>
            <span>Для лизинговых компаний</span>
            <strong>Быстрая публикация стока</strong>
          </article>
          <article>
            <span>Для дилеров и партнеров</span>
            <strong>Прямой доступ к актуальным лотам</strong>
          </article>
          <article>
            <span>Для команды продукта</span>
            <strong>Отдельная зона для экспериментов</strong>
          </article>
        </div>
      </div>
    </section>
  );
}
