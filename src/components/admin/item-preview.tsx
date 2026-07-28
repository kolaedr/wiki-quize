"use client";

import { useState } from "react";
import { Eye, ExternalLink, ImageOff } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";

interface FieldDef {
  role: string;
  kind: string;
}
interface Entity {
  qid: string;
  label: string;
  imageUrl: string | null;
  values: Record<string, unknown>;
  wikiLinks: Record<string, string> | null;
}

/** Eye button → modal previewing one item's fields (image, refs, numbers). */
export function ItemPreview({ entity, fields }: { entity: Entity; fields: FieldDef[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Переглянути айтем"
        title="Переглянути"
        className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-accent-soft hover:text-accent"
      >
        <Eye size={15} />
      </button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        className="max-h-[85vh] max-w-md overflow-y-auto"
        title={
          <span className="flex flex-col">
            {entity.label}
            <a
              href={`https://www.wikidata.org/wiki/${entity.qid}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-[11px] font-normal text-muted hover:text-accent"
            >
              {entity.qid} <ExternalLink size={10} />
            </a>
          </span>
        }
      >

            {entity.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- Commons preview
              <img src={entity.imageUrl} alt="" className="max-h-48 w-full rounded-lg object-contain" />
            ) : (
              <span className="flex h-24 items-center justify-center rounded-lg bg-accent-soft">
                <ImageOff size={20} className="text-muted" />
              </span>
            )}

            <div className="flex flex-col gap-2 text-xs">
              {fields.map((f) => {
                const v = entity.values[f.role];
                if (v == null || (Array.isArray(v) && v.length === 0)) return null;
                return (
                  <div key={f.role} className="flex flex-col gap-1 border-t border-line/50 pt-2">
                    <span className="text-[11px] uppercase tracking-wide text-muted">{f.role}</span>
                    {f.kind === "image" && typeof v === "string" ? (
                      // eslint-disable-next-line @next/next/no-img-element -- Commons preview
                      <img src={v} alt="" className="h-16 w-24 rounded object-contain" />
                    ) : f.kind === "entityRefList" && Array.isArray(v) ? (
                      <div className="flex flex-wrap gap-1.5">
                        {v.map((ref, i) => {
                          const r = ref as { qid?: string; labels?: Record<string, string> };
                          const lbl = r.labels?.uk ?? r.labels?.en ?? r.qid ?? "";
                          return (
                            <span key={i} className="rounded-full bg-accent-soft px-2 py-0.5 text-accent">
                              {lbl}
                            </span>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="text-fg">{String(v)}</span>
                    )}
                  </div>
                );
              })}
            </div>

            {entity.wikiLinks && Object.keys(entity.wikiLinks).length > 0 && (
              <div className="flex flex-wrap gap-2 border-t border-line/50 pt-2 text-xs">
                {Object.entries(entity.wikiLinks).map(([loc, url]) => (
                  <a
                    key={loc}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-accent hover:underline"
                  >
                    {loc} <ExternalLink size={10} />
                  </a>
                ))}
              </div>
            )}
      </Dialog>
    </>
  );
}
