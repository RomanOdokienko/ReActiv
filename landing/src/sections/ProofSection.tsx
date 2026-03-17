import { SectionShell } from "../components/SectionShell";

const BENEFITS = [
  {
    title: "Изолированная разработка",
    text: "Лендинг живет в своей папке и не мешает разработке личного кабинета и витрины.",
  },
  {
    title: "Тот же стек",
    text: "React, Vite и TypeScript остаются знакомыми, поэтому потом интегрировать будет проще.",
  },
  {
    title: "Быстрые эксперименты",
    text: "Можно без риска проверять офферы, блоки доверия, CTA и новые визуальные идеи.",
  },
];

export function ProofSection() {
  return (
    <SectionShell
      id="benefits"
      eyebrow="Почему так удобнее"
      title="Ты можешь строить маркетинговую часть независимо от основной продуктовой разработки"
      description="Новая зона создана специально для спокойной работы над лендингом без конфликтов за общие файлы."
    >
      <div className="benefit-grid">
        {BENEFITS.map((benefit) => (
          <article key={benefit.title} className="benefit-card">
            <h3>{benefit.title}</h3>
            <p>{benefit.text}</p>
          </article>
        ))}
      </div>
    </SectionShell>
  );
}
