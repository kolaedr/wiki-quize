"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import type { LocalizedText } from "@/i18n/locales";
import { GameTitleDialog } from "./game-title-dialog";

/**
 * Staff-only pencil in the corner of a public game card. Auto-generated names
 * ("Car make: country") are easiest to spot while browsing the catalogue, so
 * the fix lives there instead of behind a trip to /admin — which matters most
 * on a phone.
 *
 * Rendered as a SIBLING of the card's link (never inside it): a button nested
 * in an anchor is invalid and would swallow the tap.
 */
export function GameTitleEditButton({
  slug,
  title,
  className = "",
}: {
  slug: string;
  title: LocalizedText;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label="Редагувати назву"
        title="Редагувати назву"
        className={`glass-card flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:text-accent ${className}`}
      >
        <Pencil size={13} />
      </button>
      {/* mounted only while open, so it always opens with fresh field values */}
      {open && <GameTitleDialog onClose={() => setOpen(false)} slug={slug} title={title} />}
    </>
  );
}
