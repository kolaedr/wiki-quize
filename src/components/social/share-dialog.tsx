"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Check, Copy, Share2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Share modal: a big scannable QR in the centre (point a phone at it), the link
 * in a copyable field, and a native Share button (Web Share API, falls back to
 * copy). Reused by invites and challenges.
 */
export function ShareDialog({
  open,
  onClose,
  title,
  url,
  hint,
  shareText,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  url: string;
  hint?: string;
  shareText?: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCopied(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      /* clipboard blocked — field is selectable */
    }
  };

  const share = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, text: shareText ?? title, url });
        return;
      } catch {
        /* user cancelled — fine */
        return;
      }
    }
    copy();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl border border-line bg-bg p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex w-full items-start justify-between gap-3">
          <h3 className="font-display text-lg font-bold">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Закрити">
            <X size={18} className="text-muted hover:text-fg" />
          </button>
        </div>

        {/* QR — on a white plate so it scans in dark mode too */}
        <div className="rounded-2xl bg-white p-3 shadow-sm">
          <QRCodeSVG value={url} size={190} marginSize={0} level="M" />
        </div>
        <p className="text-center text-[11px] text-muted">
          {hint ?? "Наведи камеру телефона на код"}
        </p>

        {/* link + copy */}
        <div className="flex w-full items-center gap-2">
          <input
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            className="h-9 flex-1 rounded-lg border border-line/60 bg-transparent px-2 text-xs text-muted"
          />
          <Button size="sm" variant="ghost" onClick={copy} aria-label="Копіювати лінк">
            {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
          </Button>
        </div>

        {/* native share */}
        <Button size="lg" className="w-full" onClick={share}>
          <Share2 size={16} /> Поділитися
        </Button>
      </div>
    </div>
  );
}
