import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Espaçamento horizontal padrão das páginas (compartilhado por cabeçalho e conteúdo) */
export const PAGE_GUTTER = "px-200 m:px-400";

interface PageHeaderProps {
  title: ReactNode;
  /** Trilha acima do título (ex.: Linhas › Horizontais) */
  breadcrumbs?: string[];
  lozenge?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** Abas ou conteúdo logo abaixo do título */
  children?: ReactNode;
}

/** Cabeçalho de página: um H1 por página (font.heading.large), ações à direita. */
export function PageHeader({ title, breadcrumbs, lozenge, description, actions, children }: PageHeaderProps) {
  return (
    <div className={cn(PAGE_GUTTER, "pt-300")}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Trilha" className="mb-050">
          <ol className="flex items-center gap-050 font-body-small text-subtlest">
            {breadcrumbs.map((b, i) => (
              <li key={b} className="flex items-center gap-050">
                {i > 0 && <ChevronRight aria-hidden className="size-icon-small" />}
                {b}
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="flex flex-wrap items-center justify-between gap-200">
        <div className="flex min-w-0 items-center gap-150">
          <h1 className="font-heading-large text-default">{title}</h1>
          {lozenge}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-100">{actions}</div>}
      </div>
      {description && <p className="mt-050 max-w-search-width text-subtle">{description}</p>}
      {children}
    </div>
  );
}

/** Corpo de página com o mesmo recuo do cabeçalho */
export function PageBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn(PAGE_GUTTER, "flex flex-col gap-300 py-300", className)}>{children}</div>;
}
