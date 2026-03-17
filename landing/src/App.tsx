import { CtaSection } from "./sections/CtaSection";
import { HeroSection } from "./sections/HeroSection";
import { ProcessSection } from "./sections/ProcessSection";
import { ProofSection } from "./sections/ProofSection";

export function App() {
  return (
    <div className="landing-shell">
      <header className="site-header">
        <a className="site-header__brand" href="#top">
          Ре<span>Актив</span>
        </a>
        <nav className="site-header__nav" aria-label="Навигация лендинга">
          <a href="#benefits">Почему ReActiv</a>
          <a href="#flow">Как это работает</a>
          <a href="#contact">Оставить заявку</a>
        </nav>
      </header>

      <main id="top">
        <HeroSection />
        <ProofSection />
        <ProcessSection />
        <CtaSection />
      </main>
    </div>
  );
}
