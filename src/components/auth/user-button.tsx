"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { authClient, useSession } from "@/lib/auth-client";

/** Header account chip: sign-in link for guests, name + sign-out for users. */
export function UserButton() {
  const t = useTranslations("auth");
  const { data: session, isPending } = useSession();

  if (isPending) {
    return <div className="glass-card h-10 w-10 animate-pulse rounded-full" />;
  }

  if (!session) {
    return (
      <Link
        href="/auth"
        className="glass-card flex h-10 items-center px-4 text-sm font-medium text-muted transition-colors hover:text-accent"
      >
        {t("signin")}
      </Link>
    );
  }

  return (
    <div className="glass-card flex h-10 items-center gap-2 pl-3 pr-1">
      <span className="max-w-24 truncate text-sm font-medium">
        {session.user.name || session.user.email}
      </span>
      <button
        onClick={() => authClient.signOut()}
        title={t("signout")}
        className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:text-danger"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 14 5-5-5-5m5 5H9" />
        </svg>
      </button>
    </div>
  );
}
