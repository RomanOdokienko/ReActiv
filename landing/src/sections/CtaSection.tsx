import { SectionShell } from "../components/SectionShell";

export function CtaSection() {
  return (
    <SectionShell
      id="contact"
      eyebrow="Следующий шаг"
      title="Здесь можно собирать оффер и сценарий захвата лида"
      description="Пока это заготовка, но она уже живет отдельно и готова для дальнейшей упаковки в полноценный лендинг."
    >
      <div className="cta-panel">
        <div>
          <h3>Что можно делать дальше</h3>
          <p>
            Добавить кейсы, FAQ, форму заявки, блок доверия, анимации, адаптивные секции и SEO-тексты
            без риска задеть основной продукт.
          </p>
        </div>
        <a className="button button--primary" href="mailto:hello@reactiv.pro">
          Заполнить CTA позже
        </a>
      </div>
    </SectionShell>
  );
}
