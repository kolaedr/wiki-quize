"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { CircleUserRound } from "lucide-react";
import { useSession } from "@/lib/auth-client";

/** Header account chip: sign-in link for guests, cabinet link for users. */
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
    <Link
      href="/me"
      title={t("cabinet")}
      className="glass-card flex h-10 items-center gap-2 px-3 text-sm font-medium transition-colors hover:text-accent"
    >
      <CircleUserRound size={17} className="text-accent" />
      <span className="max-w-24 truncate">{session.user.name || session.user.email}</span>
    </Link>
  );
}
