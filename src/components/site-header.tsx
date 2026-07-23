import Link from "next/link";
import { Shield } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserButton } from "@/components/auth/user-button";
import { getAdminSession } from "@/lib/admin/guard";

/** Global header — ALWAYS visible, on every page including games. */
export async function SiteHeader() {
  const admin = await getAdminSession().catch(() => null);
  return (
    <header className="mx-auto flex w-full max-w-4xl shrink-0 items-center justify-between px-5 pb-1 pt-4">
      <Link
        href="/"
        className="font-display text-lg font-semibold tracking-tight transition-colors hover:text-accent"
      >
        WikiQuize
      </Link>
      <div className="flex items-center gap-2">
        {admin && (
          <Link
            href="/admin"
            title="Admin"
            className="glass-card flex h-10 w-10 items-center justify-center text-muted transition-colors hover:text-accent"
          >
            <Shield size={17} />
          </Link>
        )}
        <UserButton />
        <ThemeToggle />
      </div>
    </header>
  );
}
