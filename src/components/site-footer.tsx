"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { ExternalLink } from "lucide-react";
import { LocaleSwitcher } from "@/components/locale-switcher";

const PORTFOLIO_URL = "https://portfolio-andrii-ole.vercel.app/";

/** Active play routes: demo /play and /play/:slug/:level — hide chrome there. */
function isActivePlay(pathname: string): boolean {
  if (pathname === "/play") return true;
  return /^\/play\/[^/]+\/[^/]+$/.test(pathname);
}

/**
 * Global footer: language switch + portfolio link.
 * Hidden on /admin (own chrome) and on the active game screen.
 */
export function SiteFooter() {
  const pathname = usePathname();
  const t = useTranslations("footer");

  if (pathname.startsWith("/admin") || isActivePlay(pathname)) return null;

  return (
    <footer className="mx-auto w-full max-w-4xl shrink-0 border-t border-line px-5 pb-3 pt-3">
      <div className="flex items-center justify-between gap-3">
        <LocaleSwitcher />
        <a
          href={PORTFOLIO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-accent"
        >
          {t("portfolio")}
          <ExternalLink size={14} aria-hidden />
        </a>
      </div>
    </footer>
  );
}
