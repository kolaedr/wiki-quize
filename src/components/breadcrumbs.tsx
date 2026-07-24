import Link from "next/link";
import { ArrowLeft, ChevronRight, Home } from "lucide-react";

export interface Crumb {
  href?: string;
  label: string;
}

/**
 * Breadcrumb trail with a big touch-friendly BACK button at the front — the
 * primary way up on phones. "Back" = one level up: an explicit `backHref`, else
 * the nearest ancestor crumb that has a link, else home. The trail stays for
 * context and can scroll horizontally on narrow screens.
 */
export function Breadcrumbs({
  items,
  backHref,
  className = "",
}: {
  items: Crumb[];
  backHref?: string;
  className?: string;
}) {
  const parent =
    backHref ??
    items
      .slice(0, -1) // never point "back" at the current page (the last crumb)
      .reverse()
      .find((c) => c.href)?.href ??
    "/";

  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex min-w-0 items-center gap-2 text-xs text-muted ${className}`}
    >
      <Link
        href={parent}
        aria-label="Назад"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line/70 text-fg transition-all hover:border-accent hover:text-accent active:scale-95"
      >
        <ArrowLeft size={16} />
      </Link>
      <div
        className="flex min-w-0 items-center gap-1 overflow-x-auto whitespace-nowrap"
        data-scrollable
      >
        <Link href="/" aria-label="Home" className="flex items-center transition-colors hover:text-accent">
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
      </div>
    </nav>
  );
}
