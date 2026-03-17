import type { PropsWithChildren, ReactNode } from "react";

interface SectionShellProps extends PropsWithChildren {
  id?: string;
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  className?: string;
}

export function SectionShell({
  id,
  eyebrow,
  title,
  description,
  className,
  children,
}: SectionShellProps) {
  return (
    <section id={id} className={`section-shell${className ? ` ${className}` : ""}`}>
      <div className="section-shell__intro">
        {eyebrow ? <span className="section-shell__eyebrow">{eyebrow}</span> : null}
        <h2>{title}</h2>
        {description ? <p className="section-shell__description">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}
