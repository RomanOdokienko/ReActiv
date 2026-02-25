import { useEffect, useRef, useState } from "react";

export function FeedbackWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleOutsideClick(event: PointerEvent): void {
      const target = event.target as Node | null;
      if (
        target &&
        !panelRef.current?.contains(target) &&
        !buttonRef.current?.contains(target)
      ) {
        setIsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("pointerdown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  return (
    <div className="feedback-widget">
      {isOpen && (
        <div
          id="feedback-widget-panel"
          ref={panelRef}
          className="feedback-widget__panel"
          role="dialog"
          aria-label="Обратная связь"
        >
          <p>
            Мы строим продукт для вас и внимательно читаем каждое сообщение. Если есть проблема или пожелание —
            просто напишите нам на почту <a href="mailto:romanodokienko@gmail.com">romanodokienko@gmail.com</a> или
            в{" "}
            <a href="https://t.me/romanodokienko" target="_blank" rel="noreferrer">
              Telegram
            </a>
            .
          </p>
        </div>
      )}

      <button
        ref={buttonRef}
        type="button"
        className={`feedback-widget__button ${isOpen ? "is-open" : ""}`}
        aria-label="Открыть обратную связь"
        aria-haspopup="dialog"
        aria-controls="feedback-widget-panel"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((value) => !value)}
      >
        <img src="/message-square-question.svg" alt="" aria-hidden="true" />
      </button>
    </div>
  );
}
