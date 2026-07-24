import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowUpRight, Shield } from "lucide-react";
import { AdminNav } from "@/components/admin/admin-nav";
import { UserButton } from "@/components/auth/user-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { getAdminSession } from "@/lib/admin/guard";

export const dynamic = "force-dynamic";

/**
 * Dedicated admin shell: its OWN top bar + sidebar, full width — visually
 * separate from the game app (the global SiteHeader hides itself on /admin).
 */
export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  if (!(await getAdminSession())) redirect("/");

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col">
      {/* admin top bar (full width) */}
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-line/70 px-4 py-3 lg:px-6">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <Shield size={16} />
          </span>
          <span className="font-display text-sm font-semibold tracking-tight">
            Wiqus · Адмін-панель
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="glass-card flex h-10 items-center gap-1.5 rounded-full px-3.5 text-sm text-muted transition-colors hover:text-fg"
          >
            На сайт
            <ArrowUpRight size={15} />
          </Link>
          <UserButton />
          <ThemeToggle />
        </div>
      </header>

      {/* sidebar + content */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside className="shrink-0 border-b border-line/70 px-3 py-3 lg:w-56 lg:border-b-0 lg:border-r lg:py-5">
          <AdminNav />
        </aside>
        <main className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-6 overflow-y-auto px-4 py-5 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
