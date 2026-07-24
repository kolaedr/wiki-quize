"use client";

import { useState, useTransition } from "react";
import { Loader2, Pencil, Save, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  deleteGameAction,
  renameGameAction,
  setGameConfigAction,
} from "@/lib/admin/actions";

/** Inline game editor: rename (en/uk), deck config (deckSize/perLevel), delete. */
export function GameEditor({
  gameId,
  titleEn,
  titleUk,
  deckSize = 10,
  perLevel = 20,
  itemsCount,
}: {
  gameId: string;
  titleEn: string;
  titleUk: string;
  deckSize?: number;
  perLevel?: number;
  itemsCount?: number;
}) {
  const [open, setOpen] = useState(false);
  const [en, setEn] = useState(titleEn);
  const [uk, setUk] = useState(titleUk);
  const [deck, setDeck] = useState(deckSize);
  const [per, setPer] = useState(perLevel);
  const [pending, start] = useTransition();
  const [armed, setArmed] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const projectedLevels = Math.max(1, Math.ceil((itemsCount || per) / Math.max(2, per)));

  const save = () =>
    start(async () => {
      const r = await renameGameAction(gameId, en, uk);
      setMsg(r.message);
    });

  const saveConfig = () =>
    start(async () => {
      const r = await setGameConfigAction(gameId, deck, per);
      setMsg(r.message);
    });

  const del = () => {
    if (!armed) {
      setArmed(true);
      return;
    }
    start(async () => {
      const r = await deleteGameAction(gameId);
      setMsg(r.message); // row disappears on success after revalidate
    });
  };

  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 self-start text-xs text-muted transition-colors hover:text-fg"
      >
        <Pencil size={12} /> Редагувати
      </button>
    );

  return (
    <div className="flex flex-col gap-2 border-t border-line/50 pt-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <Input className="h-9" placeholder="Назва (EN)" value={en} onChange={(e) => setEn(e.target.value)} />
        <Input className="h-9" placeholder="Назва (UK)" value={uk} onChange={(e) => setUk(e.target.value)} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={pending} onClick={save}>
          {pending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          Зберегти назву
        </Button>
      </div>

      {/* deck config */}
      <div className="flex flex-col gap-2 border-t border-line/40 pt-2">
        <span className="text-xs font-semibold text-fg">Колода й рівні</span>
        <div className="flex flex-wrap items-end gap-3 text-xs text-muted">
          <label className="flex flex-col gap-1">
            Карток за раунд
            <Input
              type="number"
              className="h-9 w-24"
              value={deck}
              onChange={(e) => setDeck(Number(e.target.value) || 0)}
            />
          </label>
          <label className="flex flex-col gap-1">
            Айтемів на рівень
            <Input
              type="number"
              className="h-9 w-24"
              value={per}
              onChange={(e) => setPer(Number(e.target.value) || 0)}
            />
          </label>
          <span className="pb-2">
            → рівнів: <span className="font-semibold text-fg">{projectedLevels}</span>
            {itemsCount != null && ` (айтемів: ${itemsCount})`}
          </span>
          <Button size="sm" variant="secondary" className="mb-0.5" disabled={pending} onClick={saveConfig}>
            {pending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            Зберегти колоду
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-line/40 pt-2">
        <Button
          size="sm"
          variant={armed ? "default" : "ghost"}
          disabled={pending}
          onClick={del}
          onBlur={() => setArmed(false)}
        >
          <Trash2 size={13} />
          {armed ? "Точно? Ще раз" : "Видалити"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          <X size={13} /> Закрити
        </Button>
        {msg && <span className="text-[11px] text-muted">{msg}</span>}
      </div>
    </div>
  );
}
