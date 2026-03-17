import { SectionShell } from "../components/SectionShell";

const STEPS = [
  "Делаешь лендинг внутри `landing/src`, не заходя в `frontend/src`.",
  "Запускаешь отдельный dev-сервер и работаешь со своей версткой и секциями.",
  "Когда структура и визуал готовы, отдельно решаете с братом, как интегрировать это в основной фронт.",
];

export function ProcessSection() {
  return (
    <SectionShell
      id="flow"
      eyebrow="Процесс"
      title="Простой путь работы через fork"
      description="Сначала независимый маркетинговый прототип, потом аккуратная интеграция по договоренности."
      className="section-shell--contrast"
    >
      <ol className="step-list">
        {STEPS.map((step, index) => (
          <li key={step} className="step-card">
            <span className="step-card__index">0{index + 1}</span>
            <p>{step}</p>
          </li>
        ))}
      </ol>
    </SectionShell>
  );
}
