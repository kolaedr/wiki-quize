"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { LogOut } from "lucide-react";
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
        <LogOut size={15} />
      </button>
    </div>
  );
}
