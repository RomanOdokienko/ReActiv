import { useEffect, useRef, useState } from "react";

interface DockOffset {
  right: number;
  bottom: number;
}

function getBaseDockOffset(viewportWidth: number): DockOffset {
  if (viewportWidth <= 760) {
    return { right: 12, bottom: 92 };
  }
  return { right: 26, bottom: 112 };
}

interface RectBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

function buildButtonRect(
  viewportWidth: number,
  viewportHeight: number,
  buttonSize: number,
  right: number,
  bottom: number,
): RectBox {
  const left = viewportWidth - right - buttonSize;
  const top = viewportHeight - bottom - buttonSize;
  return {
    left,
    top,
    right: left + buttonSize,
    bottom: top + buttonSize,
    width: buttonSize,
    height: buttonSize,
  };
}

function rectsIntersect(a: RectBox, b: RectBox, padding = 0): boolean {
  return !(
    a.right + padding <= b.left ||
    a.left - padding >= b.right ||
    a.bottom + padding <= b.top ||
    a.top - padding >= b.bottom
  );
}

function getFloatingObstacles(feedbackRoot: HTMLElement | null): RectBox[] {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return [];
  }

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const allElements = Array.from(document.querySelectorAll<HTMLElement>("body *"));
  const obstacles: RectBox[] = [];

  for (const element of allElements) {
    if (feedbackRoot && (element === feedbackRoot || feedbackRoot.contains(element))) {
      continue;
    }
    const style = window.getComputedStyle(element);
    if (style.position !== "fixed") {
      continue;
    }
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
      continue;
    }

    const rect = element.getBoundingClientRect();
    if (rect.width < 48 || rect.height < 48) {
      continue;
    }
    if (rect.right <= 0 || rect.bottom <= 0 || rect.left >= viewportWidth || rect.top >= viewportHeight) {
      continue;
    }
    if (rect.right < viewportWidth * 0.45 || rect.bottom < viewportHeight * 0.45) {
      continue;
    }
    if (rect.width > viewportWidth * 0.98 && rect.height > viewportHeight * 0.98) {
      continue;
    }

    obstacles.push({
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
    });
  }

  return obstacles.sort((left, right) => right.width * right.height - left.width * left.height);
}

export function FeedbackWidget() {
  const [isTouchMode, setIsTouchMode] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isOpenByClick, setIsOpenByClick] = useState(false);
  const [dockOffset, setDockOffset] = useState<DockOffset>({ right: 26, bottom: 112 });
  const rootRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const isOpen = isTouchMode ? isOpenByClick : isHovered;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
    const updateInteractionMode = () => {
      const nextIsTouchMode = !mediaQuery.matches;
      setIsTouchMode(nextIsTouchMode);

      if (nextIsTouchMode) {
        setIsHovered(false);
      } else {
        setIsOpenByClick(false);
      }
    };

    updateInteractionMode();
    mediaQuery.addEventListener("change", updateInteractionMode);

    return () => {
      mediaQuery.removeEventListener("change", updateInteractionMode);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }

    const updateDockOffset = () => {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const baseOffset = getBaseDockOffset(viewportWidth);
      const buttonSize = viewportWidth <= 760 ? 56 : 60;
      const gap = viewportWidth <= 760 ? 10 : 12;
      const obstacles = getFloatingObstacles(rootRef.current);

      let nextRight = baseOffset.right;
      let nextBottom = baseOffset.bottom;

      const maxBottom = Math.max(baseOffset.bottom, viewportHeight - buttonSize - 8);

      for (const obstacle of obstacles) {
        const buttonRect = buildButtonRect(
          viewportWidth,
          viewportHeight,
          buttonSize,
          nextRight,
          nextBottom,
        );
        if (!rectsIntersect(buttonRect, obstacle, 8)) {
          continue;
        }

        const preferredBottom = viewportHeight - obstacle.top + gap;
        nextBottom = Math.max(nextBottom, Math.min(preferredBottom, maxBottom));
      }

      setDockOffset((current) => {
        if (current.right === nextRight && current.bottom === nextBottom) {
          return current;
        }
        return { right: nextRight, bottom: nextBottom };
      });
    };

    updateDockOffset();
    const mutationObserver = new MutationObserver(updateDockOffset);
    mutationObserver.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class", "style"],
    });
    window.addEventListener("resize", updateDockOffset);
    const intervalId = window.setInterval(updateDockOffset, 500);

    return () => {
      mutationObserver.disconnect();
      window.removeEventListener("resize", updateDockOffset);
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (!isTouchMode || !isOpenByClick) {
      return;
    }

    function handleOutsideClick(event: PointerEvent): void {
      const target = event.target as Node | null;
      if (
        target &&
        !panelRef.current?.contains(target) &&
        !buttonRef.current?.contains(target)
      ) {
        setIsOpenByClick(false);
      }
    }

    function handleEscape(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        setIsOpenByClick(false);
      }
    }

    document.addEventListener("pointerdown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("pointerdown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpenByClick, isTouchMode]);

  return (
    <div
      ref={rootRef}
      className="feedback-widget"
      style={{ right: `${dockOffset.right}px`, bottom: `${dockOffset.bottom}px` }}
      onMouseEnter={() => {
        if (!isTouchMode) {
          setIsHovered(true);
        }
      }}
      onMouseLeave={() => {
        if (!isTouchMode) {
          setIsHovered(false);
        }
      }}
    >
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
        onClick={() => {
          if (isTouchMode) {
            setIsOpenByClick((value) => !value);
          }
        }}
      >
        <img src="/message-square-question.svg" alt="" aria-hidden="true" />
      </button>
    </div>
  );
}
