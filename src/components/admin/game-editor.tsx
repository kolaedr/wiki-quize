"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2, Pencil, Save, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ItemImagePicker } from "@/components/admin/item-image-picker";
import {
  deleteGameAction,
  getGameCoverageAction,
  listGameItemImagesAction,
  renameGameAction,
  setGameConfigAction,
  setGameCoverAction,
  setGameIconAction,
  setGameVisualAction,
  type CoverageResult,
} from "@/lib/admin/actions";
import { GameIcon, ICON_NAMES } from "@/components/game-icon";

interface FieldDef {
  role: string;
  kind: string;
}

/** Inline game editor: rename, deck config, VISUAL (which fields are shown), delete. */
export function GameEditor({
  gameId,
  titleEn,
  titleUk,
  deckSize = 10,
  perLevel = 20,
  itemsCount,
  mechanic,
  fields = [],
  answerRole,
  promptImageRole,
  imageRole,
  valueRole,
  refRole,
  cover,
  icon,
  promptShow: promptShowInit = "",
  optionShow: optionShowInit = "",
  promptBlur,
  mod = false,
}: {
  gameId: string;
  titleEn: string;
  titleUk: string;
  deckSize?: number;
  perLevel?: number;
  itemsCount?: number;
  mechanic?: string;
  fields?: FieldDef[];
  answerRole?: string;
  promptImageRole?: string;
  imageRole?: string;
  valueRole?: string;
  refRole?: string;
  cover?: string;
  icon?: string;
  promptImage?: boolean;
  promptShow?: "" | "text" | "image" | "both";
  optionShow?: "" | "text" | "image" | "both";
  /** blur radius (px) over the question image until answered */
  promptBlur?: number;
  /** moderator view: only title + icon (no deck/visual/cover/delete) */
  mod?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [en, setEn] = useState(titleEn);
  const [uk, setUk] = useState(titleUk);
  const [ic, setIc] = useState(icon ?? "deck");
  const [deck, setDeck] = useState(deckSize);
  const [per, setPer] = useState(perLevel);
  const [pending, start] = useTransition();
  const [armed, setArmed] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // visual roles
  const imageFields = fields.filter((f) => f.kind === "image");
  const valueFields = fields.filter((f) => f.kind === "number" || f.kind === "date");
  const [aRole, setARole] = useState(answerRole ?? "");
  const [pRole, setPRole] = useState(promptImageRole ?? "");
  const [iRole, setIRole] = useState(imageRole ?? "");
  const [vRole, setVRole] = useState(valueRole ?? "");
  const [pShow, setPShow] = useState<string>(promptShowInit);
  const [oShow, setOShow] = useState<string>(optionShowInit);
  const [blur, setBlur] = useState<number>(promptBlur ?? 0);
  const [cov, setCov] = useState<CoverageResult | null>(null);

  const isRefChoice = mechanic === "choice" && !!refRole;
  const isOwnChoice = mechanic === "choice" && !refRole;
  const isChoice = isRefChoice || isOwnChoice;
  const isHL = mechanic === "higher_lower";
  const hasVisual = isChoice ? imageFields.length > 0 : isHL;

  const projectedLevels = Math.max(1, Math.ceil((itemsCount || per) / Math.max(2, per)));

  useEffect(() => {
    if (open && hasVisual && !cov) getGameCoverageAction(gameId).then(setCov);
  }, [open, hasVisual, cov, gameId]);

  const save = () =>
    start(async () => {
      const r = await renameGameAction(gameId, en, uk);
      setMsg(r.message);
    });

  const saveIcon = (name: string) => {
    setIc(name);
    start(async () => {
      const r = await setGameIconAction(gameId, name);
      setMsg(r.message);
    });
  };

  const saveConfig = () =>
    start(async () => {
      const r = await setGameConfigAction(gameId, deck, per);
      setMsg(r.message);
    });

  const saveVisual = () =>
    start(async () => {
      const patch: {
        answerRole?: string | null;
        promptImageRole?: string | null;
        imageRole?: string | null;
        valueRole?: string | null;
        promptShow?: "" | "text" | "image" | "both";
        optionShow?: "" | "text" | "image" | "both";
        promptBlur?: number;
      } = {};
      if (isRefChoice) patch.promptImageRole = pRole || null;
      if (isOwnChoice) patch.answerRole = aRole || null;
      if (isChoice) {
        patch.promptShow = pShow as "" | "text" | "image" | "both";
        patch.optionShow = oShow as "" | "text" | "image" | "both";
        patch.promptBlur = blur;
      }
      if (isHL) {
        patch.imageRole = iRole || null;
        patch.valueRole = vRole || null;
      }
      const r = await setGameVisualAction(gameId, patch);
      setMsg(r.message);
      setCov(null);
      getGameCoverageAction(gameId).then(setCov);
    });

  const del = () => {
    if (!armed) {
      setArmed(true);
      return;
    }
    start(async () => {
      const r = await deleteGameAction(gameId);
      setMsg(r.message);
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

      {/* icon — the game's fallback visual (used when there's no cover image) */}
      <div className="flex flex-wrap items-center gap-2 border-t border-line/40 pt-2 text-xs text-muted">
        <span className="font-semibold text-fg">Іконка</span>
        <GameIcon name={ic} size={18} className="h-8 w-8" />
        <select
          value={ic}
          onChange={(e) => saveIcon(e.target.value)}
          className="h-9 rounded-lg border border-line/60 bg-transparent px-2 text-fg outline-none focus:border-accent"
        >
          {ICON_NAMES.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <span className="text-[11px]">зберігається одразу</span>
      </div>

      {/* VISUAL: which dataset fields are shown as question / answer */}
      {!mod && (hasVisual || isChoice) && (
        <div className="flex flex-col gap-2 border-t border-line/40 pt-2">
          <span className="text-xs font-semibold text-fg">Візуал гри — що показуємо</span>

          {/* presentation: what the QUESTION and each OPTION render (text/image/both) */}
          {isChoice && (
            <div className="flex flex-wrap items-end gap-3 text-xs text-muted">
              <label className="flex flex-col gap-1">
                Питання показує
                <ShowSelect value={pShow} onChange={setPShow} />
              </label>
              <label className="flex flex-col gap-1">
                Варіанти показують
                <ShowSelect value={oShow} onChange={setOShow} />
              </label>
              <label className="flex flex-col gap-1">
                Блюр питання
                <select
                  value={blur}
                  onChange={(e) => setBlur(Number(e.target.value))}
                  className="h-9 rounded-lg border border-line/60 bg-transparent px-2 text-xs text-fg outline-none focus:border-accent"
                  title="Розмиває картинку питання до відповіді — коли зображення надто очевидне"
                >
                  <option value={0}>без блюру</option>
                  <option value={5}>легкий</option>
                  <option value={10}>середній</option>
                  <option value={16}>сильний</option>
                </select>
              </label>
            </div>
          )}
          {isChoice && blur > 0 && (
            <p className="text-[11px] text-muted">
              Картинка питання буде розмита, а після відповіді проявиться. Для впізнаваних
              речей (прапор, логотип) це і робить раунд цікавим.
            </p>
          )}

          <div className="flex flex-wrap items-end gap-3 text-xs text-muted">
            {isRefChoice && imageFields.length > 0 && (
              <label className="flex flex-col gap-1">
                Зображення питання (яке поле)
                <RoleSelect
                  value={pRole}
                  onChange={setPRole}
                  options={imageFields}
                  emptyLabel="головне фото"
                />
              </label>
            )}
            {isOwnChoice && imageFields.length > 0 && (
              <label className="flex flex-col gap-1">
                Зображення-відповідь (яке поле)
                <RoleSelect value={aRole} onChange={setARole} options={imageFields} />
              </label>
            )}
            {isHL && (
              <>
                <label className="flex flex-col gap-1">
                  Показник (число)
                  <RoleSelect value={vRole} onChange={setVRole} options={valueFields} />
                </label>
                <label className="flex flex-col gap-1">
                  Картинка на картці
                  <RoleSelect
                    value={iRole}
                    onChange={setIRole}
                    options={imageFields}
                    emptyLabel="без картинки"
                  />
                </label>
              </>
            )}
            <Button size="sm" variant="secondary" className="mb-0.5" disabled={pending} onClick={saveVisual}>
              {pending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              Зберегти візуал
            </Button>
          </div>

          {/* coverage: how "visual" the game actually is */}
          {cov?.ok && (
            <div className="flex flex-wrap gap-3 text-[11px]">
              {cov.questionRole && (
                <Coverage label={`Питання (${cov.questionRole})`} value={cov.questionCoverage} />
              )}
              {isRefChoice && cov.refRole && (
                <Coverage label="Відповіді (картинки рефів)" value={cov.answerCoverage} />
              )}
              {cov.total != null && <span className="text-muted">айтемів: {cov.total}</span>}
            </div>
          )}
          {isRefChoice && (
            <p className="text-[11px] text-muted">
              Відповіді показують картинки рефів (прапори/лого) автоматично. Низьке
              покриття → пересинхрони датасет, щоб дотягти картинки.
            </p>
          )}
        </div>
      )}

      {/* deck config */}
      {!mod && (
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
      )}

      {/* cover image */}
      {!mod && (
        <ItemImagePicker
          label="Обкладинка гри"
          hint="Зʼявиться на картці гри в каталозі замість іконки."
          initial={cover}
          load={() => listGameItemImagesAction(gameId)}
          save={(u) => setGameCoverAction(gameId, u)}
        />
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-line/40 pt-2">
        {!mod && (
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
        )}
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          <X size={13} /> Закрити
        </Button>
        {msg && <span className="text-[11px] text-muted">{msg}</span>}
      </div>
    </div>
  );
}

function ShowSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-lg border border-line/60 bg-transparent px-2 text-xs text-fg outline-none focus:border-accent"
    >
      <option value="">за замовчуванням</option>
      <option value="text">лише текст</option>
      <option value="image">лише зображення</option>
      <option value="both">текст + зображення</option>
    </select>
  );
}

function RoleSelect({
  value,
  onChange,
  options,
  emptyLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  options: FieldDef[];
  emptyLabel?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-lg border border-line/60 bg-transparent px-2 text-xs text-fg outline-none focus:border-accent"
    >
      {emptyLabel !== undefined && <option value="">{emptyLabel}</option>}
      {options.map((f) => (
        <option key={f.role} value={f.role}>
          {f.role}
        </option>
      ))}
    </select>
  );
}

function Coverage({ label, value }: { label: string; value?: number }) {
  const pct = value == null ? null : Math.round(value * 100);
  const tone =
    pct == null ? "text-muted" : pct >= 80 ? "text-success" : pct >= 50 ? "text-amber-500" : "text-danger";
  return (
    <span className={tone}>
      {label}: <span className="font-semibold">{pct == null ? "—" : `${pct}%`}</span>
    </span>
  );
}
