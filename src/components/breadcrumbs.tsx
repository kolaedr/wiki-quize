import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";

export interface Crumb {
  href?: string;
  label: string;
}

/** Breadcrumb trail: Home / Category / Game / Level — easy way back from anywhere. */
export function Breadcrumbs({
  items,
  className = "",
}: {
  items: Crumb[];
  className?: string;
}) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex min-w-0 items-center gap-1 overflow-x-auto whitespace-nowrap text-xs text-muted ${className}`}
      data-scrollable
    >
      <Link href="/" className="flex items-center transition-colors hover:text-accent">
        <Home size={13} />
      </Link>
      {items.map((c, i) => (
        <span key={i} className="flex items-center gap-1">
          <ChevronRight size={12} className="shrink-0 opacity-60" />
          {c.href ? (
            <Link href={c.href} className="transition-colors hover:text-accent">
              {c.label}
            </Link>
          ) : (
            <span className="font-medium text-fg">{c.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
