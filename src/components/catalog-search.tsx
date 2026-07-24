"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";

/** Search box for the catalog — navigates to /categories?q=… */
export function CatalogSearch({ initial = "", placeholder }: { initial?: string; placeholder: string }) {
  const router = useRouter();
  const [text, setText] = useState(initial);
  const go = (v: string) =>
    router.push(v.trim() ? `/categories?q=${encodeURIComponent(v.trim())}` : "/categories");

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && go(text)}
          placeholder={placeholder}
          className="h-11 pl-9"
        />
        {text && (
          <button
            type="button"
            onClick={() => {
              setText("");
              go("");
            }}
            aria-label="Очистити"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-fg"
          >
            <X size={15} />
          </button>
        )}
      </div>
    </div>
  );
}
