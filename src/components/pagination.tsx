import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** Server-friendly prev/next pagination (rule: every DB-backed list is paginated). */
export function Pagination({
  page,
  hasNext,
  makeHref,
}: {
  page: number;
  hasNext: boolean;
  makeHref: (page: number) => string;
}) {
  if (page <= 1 && !hasNext) return null;
  return (
    <nav className="flex items-center justify-center gap-3 py-2 text-sm">
      {page > 1 ? (
        <Link
          href={makeHref(page - 1)}
          className="glass-card flex h-9 w-9 items-center justify-center text-muted hover:text-accent"
        >
          <ChevronLeft size={16} />
        </Link>
      ) : (
        <span className="glass-card flex h-9 w-9 items-center justify-center text-muted opacity-30">
          <ChevronLeft size={16} />
        </span>
      )}
      <span className="text-muted">{page}</span>
      {hasNext ? (
        <Link
          href={makeHref(page + 1)}
          className="glass-card flex h-9 w-9 items-center justify-center text-muted hover:text-accent"
        >
          <ChevronRight size={16} />
        </Link>
      ) : (
        <span className="glass-card flex h-9 w-9 items-center justify-center text-muted opacity-30">
          <ChevronRight size={16} />
        </span>
      )}
    </nav>
  );
}
