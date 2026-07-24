"use client";

import { useState, useTransition } from "react";
import { ImageIcon, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { GameItemImage } from "@/lib/admin/actions";

/**
 * Pick an image from a set of items' pictures (a game's items, or all items in a
 * category). Generic: `load` fetches the candidate images, `save` persists the
 * chosen URL (or null to clear).
 */
export function ItemImagePicker({
  initial,
  label,
  hint,
  load,
  save,
}: {
  initial?: string;
  label: string;
  hint?: string;
  load: () => Promise<{ ok: boolean; items?: GameItemImage[]; message?: string }>;
  save: (url: string | null) => Promise<{ ok: boolean; message?: string }>;
}) {
  const [current, setCurrent] = useState(initial ?? "");
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<GameItemImage[] | null>(null);
  const [loading, startLoad] = useTransition();
  const [saving, startSave] = useTransition();

  const openPicker = () => {
    setOpen(true);
    if (!items)
      startLoad(async () => {
        const r = await load();
        setItems(r.ok ? (r.items ?? []) : []);
      });
  };

  const pick = (url: string) =>
    startSave(async () => {
      const r = await save(url);
      if (r.ok) {
        setCurrent(url);
        setOpen(false);
      }
    });

  const clear = () =>
    startSave(async () => {
      const r = await save(null);
      if (r.ok) setCurrent("");
    });

  return (
    <div className="flex flex-col gap-2 border-t border-line/40 pt-2">
      <span className="text-xs font-semibold text-fg">{label}</span>
      <div className="flex items-center gap-3">
        {current ? (
          // eslint-disable-next-line @next/next/no-img-element -- Commons thumb
          <img src={current} alt="" className="h-14 w-20 rounded-lg object-contain" />
        ) : (
          <span className="flex h-14 w-20 items-center justify-center rounded-lg bg-accent-soft text-muted">
            <ImageIcon size={18} />
          </span>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" disabled={saving} onClick={openPicker}>
            Обрати з айтемів
          </Button>
          {current && (
            <Button size="sm" variant="ghost" disabled={saving} onClick={clear}>
              Прибрати
            </Button>
          )}
        </div>
      </div>
      {hint && <p className="text-[11px] text-muted">{hint}</p>}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-lg flex-col gap-3 rounded-2xl border border-line bg-bg p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold">Оберіть зображення</h3>
              <button type="button" onClick={() => setOpen(false)} aria-label="Закрити">
                <X size={18} className="text-muted hover:text-fg" />
              </button>
            </div>
            {loading && (
              <div className="flex justify-center p-6">
                <Loader2 size={22} className="animate-spin text-accent" />
              </div>
            )}
            {items && items.length === 0 && !loading && (
              <p className="p-4 text-sm text-muted">Немає айтемів із зображеннями.</p>
            )}
            {items && items.length > 0 && (
              <div className="grid grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
                {items.map((it) => (
                  <button
                    key={it.qid}
                    type="button"
                    disabled={saving}
                    onClick={() => pick(it.imageUrl)}
                    className="flex flex-col items-center gap-1 rounded-lg border border-line/60 p-1.5 transition-colors hover:border-accent disabled:opacity-50"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- Commons thumb */}
                    <img src={it.imageUrl} alt="" className="h-16 w-full rounded object-contain" />
                    <span className="w-full truncate text-center text-[10px] text-muted">{it.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
