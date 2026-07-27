"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ACTIVE_LOCALES, type LocalizedText } from "@/i18n/locales";
import { setGameTitleAction } from "@/lib/admin/actions";

/** Display names for the codes we offer; anything else shows its bare code. */
const LOCALE_NAMES: Record<string, string> = {
  en: "English",
  uk: "Українська",
  de: "Deutsch",
  es: "Español",
  fr: "Français",
  pl: "Polski",
};

const localeName = (code: string) => LOCALE_NAMES[code] ?? code.toUpperCase();

/**
 * Rename a game, one field per language.
 *
 * Titles are jsonb per locale and a game may already carry more languages than
 * the app currently renders, so the form seeds itself from the ACTIVE locales
 * PLUS whatever the title already has, and extra codes can be added by hand.
 * Saving sends the whole map, so nothing silently disappears.
 */
export function GameTitleDialog({
  onClose,
  slug,
  title,
}: {
  onClose: () => void;
  slug: string;
  title: LocalizedText;
}) {
  const router = useRouter();
  // Mounted only while open (see GameTitleEditButton), so the fields can be
  // seeded lazily instead of being reset by an effect on every open.
  const [values, setValues] = useState<Record<string, string>>(() => {
    const seed: Record<string, string> = {};
    for (const l of ACTIVE_LOCALES) seed[l] = title?.[l] ?? "";
    for (const [code, v] of Object.entries(title ?? {})) if (v) seed[code] = v;
    return seed;
  });
  const [extraCode, setExtraCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set = (code: string, v: string) => setValues((s) => ({ ...s, [code]: v }));

  const addLocale = () => {
    const code = extraCode.trim().toLowerCase();
    if (!/^[a-z]{2,3}$/.test(code) || code in values) return;
    setValues((s) => ({ ...s, [code]: "" }));
    setExtraCode("");
  };

  const removeLocale = (code: string) =>
    setValues((s) => {
      const next = { ...s };
      delete next[code];
      return next;
    });

  const save = () =>
    start(async () => {
      setError(null);
      const r = await setGameTitleAction(slug, values);
      if (!r.ok) {
        setError(r.message ?? "не вдалося зберегти");
        return;
      }
      router.refresh();
      onClose();
    });

  // ACTIVE locales first and always present; extras after, removable
  const codes = [
    ...ACTIVE_LOCALES.filter((l) => l in values),
    ...Object.keys(values)
      .filter((c) => !(ACTIVE_LOCALES as readonly string[]).includes(c))
      .sort(),
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Назва гри"
        className="flex w-full max-w-sm flex-col gap-3 rounded-2xl border border-line bg-bg p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-lg font-bold">Назва гри</h3>
          <button type="button" onClick={onClose} aria-label="Закрити">
            <X size={18} className="text-muted hover:text-fg" />
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {codes.map((code) => {
            const required = code === "en";
            return (
              <label key={code} className="flex flex-col gap-1">
                <span className="flex items-center justify-between text-[11px] text-muted">
                  <span>
                    {localeName(code)}
                    {required && <span className="text-danger"> *</span>}
                  </span>
                  {!(ACTIVE_LOCALES as readonly string[]).includes(code) && (
                    <button
                      type="button"
                      onClick={() => removeLocale(code)}
                      className="hover:text-danger"
                      aria-label={`Прибрати ${code}`}
                    >
                      <X size={12} />
                    </button>
                  )}
                </span>
                <Input
                  value={values[code] ?? ""}
                  onChange={(e) => set(code, e.target.value)}
                  placeholder={required ? "Game title" : `Назва (${code})`}
                  onKeyDown={(e) => e.key === "Enter" && save()}
                />
              </label>
            );
          })}
        </div>

        {/* add a language the app doesn't render yet — stored for later */}
        <div className="flex items-center gap-2">
          <Input
            className="h-9 w-20"
            placeholder="de"
            value={extraCode}
            onChange={(e) => setExtraCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addLocale())}
          />
          <Button size="sm" variant="ghost" onClick={addLocale} disabled={!extraCode.trim()}>
            <Plus size={13} /> мова
          </Button>
        </div>

        {error && <p className="text-xs text-danger">{error}</p>}

        <div className="flex items-center gap-2">
          <Button className="flex-1" onClick={save} disabled={pending || !values.en?.trim()}>
            {pending && <Loader2 size={14} className="animate-spin" />}
            Зберегти
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Скасувати
          </Button>
        </div>
      </div>
    </div>
  );
}
