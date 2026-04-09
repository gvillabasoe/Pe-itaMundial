import type { PropsWithChildren, ReactNode } from 'react';

interface CardProps extends PropsWithChildren {
  title?: string;
  subtitle?: string;
  aside?: ReactNode;
  className?: string;
}

export function Card({ title, subtitle, aside, className = '', children }: CardProps) {
  return (
    <section className={`card ${className}`.trim()}>
      {(title || subtitle || aside) && (
        <header className="cardHeader">
          <div>
            {title ? <h2 className="cardTitle">{title}</h2> : null}
            {subtitle ? <p className="cardSubtitle">{subtitle}</p> : null}
          </div>
          {aside ? <div>{aside}</div> : null}
        </header>
      )}
      {children}
    </section>
  );
}
