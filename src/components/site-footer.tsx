"use client";

import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { ExternalLink } from "lucide-react";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { useSession } from "@/lib/auth-client";
import { isStandalone } from "@/lib/pwa";

const PORTFOLIO_URL = "https://portfolio-andrii-ole.vercel.app/";

/** Active play routes: demo /play and /play/:slug/:level — hide chrome there. */
function isActivePlay(pathname: string): boolean {
  if (pathname === "/play") return true;
  return /^\/play\/[^/]+\/[^/]+$/.test(pathname);
}

/**
 * Global footer: locale + theme for guests, portfolio link for everyone.
 * Hidden on /admin, active play, and when signed in inside the installed PWA.
 */
export function SiteFooter() {
  const pathname = usePathname();
  const t = useTranslations("footer");
  const { data: session, isPending } = useSession();
  const pwa = useSyncExternalStore(
    (onStoreChange) => {
      const mq = window.matchMedia("(display-mode: standalone)");
      mq.addEventListener("change", onStoreChange);
      return () => mq.removeEventListener("change", onStoreChange);
    },
    () => isStandalone(),
    () => false,
  );

  if (pathname.startsWith("/admin") || isActivePlay(pathname)) return null;

  const signedIn = !isPending && !!session;
  if (signedIn && pwa) return null;

  return (
    <footer className="mx-auto w-full max-w-4xl shrink-0 border-t border-line px-5 pb-3 pt-3">
      <div className="flex items-center justify-between gap-3">
        {!signedIn ? (
          <div className="flex items-center gap-1.5">
            <LocaleSwitcher />
            <ThemeToggle compact />
          </div>
        ) : (
          <span aria-hidden className="w-px shrink-0" />
        )}
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
