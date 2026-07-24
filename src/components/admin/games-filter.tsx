"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

const STATUS = [
  { v: "all", label: "усі статуси" },
  { v: "published", label: "опубліковані" },
  { v: "unlisted", label: "unlisted" },
  { v: "blocked", label: "заблоковані" },
];
const SORT = [
  { v: "new", label: "новіші" },
  { v: "plays", label: "за іграми" },
  { v: "title", label: "за назвою" },
  { v: "status", label: "за статусом" },
];

/** Filter/sort/search bar for the games list; drives the URL query. */
export function GamesFilter({
  status = "all",
  sort = "new",
  q = "",
}: {
  status?: string;
  sort?: string;
  q?: string;
}) {
  const router = useRouter();
  const [text, setText] = useState(q);

  const go = (next: { status?: string; sort?: string; q?: string }) => {
    const s = { status, sort, q, ...next };
    const p = new URLSearchParams();
    if (s.status && s.status !== "all") p.set("status", s.status);
    if (s.sort && s.sort !== "new") p.set("sort", s.sort);
    if (s.q) p.set("q", s.q);
    router.push(`/admin/games${p.toString() ? `?${p.toString()}` : ""}`);
  };

  const selectCls =
    "h-9 rounded-lg border border-line/60 bg-transparent px-2 text-xs text-fg outline-none focus:border-accent";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1.5">
        <Input
          className="h-9 w-44"
          placeholder="Пошук за назвою / slug"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && go({ q: text.trim() })}
        />
        <button
          type="button"
          onClick={() => go({ q: text.trim() })}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-line/60 text-muted hover:text-accent"
          aria-label="Шукати"
        >
          <Search size={14} />
        </button>
      </div>
      <select className={selectCls} value={status} onChange={(e) => go({ status: e.target.value })}>
        {STATUS.map((s) => (
          <option key={s.v} value={s.v}>
            {s.label}
          </option>
        ))}
      </select>
      <select className={selectCls} value={sort} onChange={(e) => go({ sort: e.target.value })}>
        {SORT.map((s) => (
          <option key={s.v} value={s.v}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  );
}
