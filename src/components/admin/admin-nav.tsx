"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Database,
  FolderTree,
  Gamepad2,
  LayoutDashboard,
  MessageSquare,
  Users,
} from "lucide-react";
import type { StaffLevel } from "@/lib/admin/guard";

/** superOnly links are hidden from moderators (who only tidy games). */
const LINKS = [
  { href: "/admin", label: "Огляд", icon: LayoutDashboard, exact: true, superOnly: true },
  { href: "/admin/categories", label: "Категорії", icon: FolderTree, superOnly: true },
  { href: "/admin/topics", label: "Датасети", icon: Database, superOnly: true },
  { href: "/admin/games", label: "Ігри", icon: Gamepad2, superOnly: false },
  { href: "/admin/feedback", label: "Фідбек", icon: MessageSquare, superOnly: true },
  { href: "/admin/users", label: "Користувачі", icon: Users, superOnly: true },
];

/** Admin sidebar navigation — horizontal on mobile, vertical column on desktop. */
export function AdminNav({ level }: { level: StaffLevel }) {
  const pathname = usePathname();
  const links = LINKS.filter((l) => level === "super" || !l.superOnly);
  return (
    <nav className="flex gap-1 overflow-x-auto lg:flex-col">
      {links.map(({ href, label, icon: Icon, exact }) => {
        const active = exact
          ? pathname === href
          : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-2.5 whitespace-nowrap rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${
              active
                ? "bg-accent-soft text-accent"
                : "text-muted hover:bg-accent-soft/40 hover:text-fg"
            }`}
          >
            <Icon size={16} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
