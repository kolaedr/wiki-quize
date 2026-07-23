"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { LogOut } from "lucide-react";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const t = useTranslations("auth");
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await authClient.signOut();
        router.push("/");
        router.refresh();
      }}
      className="glass-card flex h-10 items-center gap-2 px-4 text-sm text-muted transition-colors hover:text-danger"
    >
      <LogOut size={15} />
      {t("signout")}
    </button>
  );
}
