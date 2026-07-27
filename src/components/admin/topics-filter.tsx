"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";

const STATUS = [
  { v: "all", label: "усі статуси" },
  { v: "draft", label: "чернетки" },
  { v: "ready", label: "готові" },
  { v: "published", label: "опубліковані" },
  { v: "disabled", label: "вимкнені" },
];

/**
 * Search/filter bar for the datasets index. Drives the URL query only — the
 * page itself is a server component, so filtering never fans out per-row
 * requests to the server actions.
 */
export function TopicsFilter({ q = "", status = "all" }: { q?: string; status?: string }) {
  const router = useRouter();
  const [text, setText] = useState(q);

  const go = (next: { q?: string; status?: string }) => {
    const s = { q, status, ...next };
    const p = new URLSearchParams();
    if (s.q) p.set("q", s.q);
    if (s.status && s.status !== "all") p.set("status", s.status);
    router.push(`/admin/topics${p.toString() ? `?${p.toString()}` : ""}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1.5">
        <Input
          className="h-9 w-56"
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
        {q && (
          <button
            type="button"
            onClick={() => {
              setText("");
              go({ q: "" });
            }}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-line/60 text-muted hover:text-accent"
            aria-label="Скинути пошук"
          >
            <X size={14} />
          </button>
        )}
      </div>
      <select
        value={status}
        onChange={(e) => go({ status: e.target.value })}
        className="h-9 rounded-lg border border-line/60 bg-transparent px-2 text-xs text-fg outline-none focus:border-accent"
      >
        {STATUS.map((s) => (
          <option key={s.v} value={s.v}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  );
}
