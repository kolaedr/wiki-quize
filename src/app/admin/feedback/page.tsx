import { asc, desc, eq } from "drizzle-orm";
import { MessageSquare } from "lucide-react";
import { db } from "@/db";
import { feedback } from "@/db/schema";
import { user } from "@/db/auth-schema";
import { ActionButton } from "@/components/admin/action-button";
import { Badge } from "@/components/ui/badge";
import { setFeedbackHandledAction } from "@/lib/feedback/actions";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  topic_request: "Хочу тему",
  idea: "Ідея",
  bug: "Баг",
  other: "Інше",
};

/** Admin: user feedback — mostly "I want this topic" requests. Open first. */
export default async function AdminFeedbackPage() {
  const rows = await db
    .select({
      id: feedback.id,
      kind: feedback.kind,
      message: feedback.message,
      contact: feedback.contact,
      handled: feedback.handled,
      createdAt: feedback.createdAt,
      sender: user.name,
    })
    .from(feedback)
    .leftJoin(user, eq(user.id, feedback.userId))
    .orderBy(asc(feedback.handled), desc(feedback.createdAt))
    .catch(() => []);

  const open = rows.filter((r) => !r.handled).length;

  return (
    <>
      <h1 className="flex items-center gap-2 font-display text-2xl font-bold">
        <MessageSquare size={20} /> Фідбек
        {open > 0 && <Badge variant="danger">{open} нових</Badge>}
      </h1>

      {rows.length === 0 && (
        <p className="text-sm text-muted">Поки немає жодного повідомлення від користувачів.</p>
      )}

      <section className="flex flex-col gap-3">
        {rows.map((r) => (
          <div
            key={r.id}
            className={`glass-card flex flex-col gap-2 p-4 ${r.handled ? "opacity-60" : ""}`}
          >
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <Badge variant={r.kind === "bug" ? "danger" : "muted"}>
                {KIND_LABEL[r.kind] ?? r.kind}
              </Badge>
              {r.handled && <Badge variant="success">опрацьовано</Badge>}
              <span>{new Date(r.createdAt).toLocaleDateString("uk")}</span>
              {r.sender && <span>· від {r.sender}</span>}
            </div>
            <p className="whitespace-pre-wrap text-sm">{r.message}</p>
            <div className="flex items-center justify-between gap-3">
              {r.contact ? (
                <span className="text-[11px] text-muted">звʼязок: {r.contact}</span>
              ) : (
                <span />
              )}
              <ActionButton
                variant="ghost"
                label={r.handled ? "Відкрити" : "Позначити готовим"}
                action={setFeedbackHandledAction.bind(null, r.id)}
              />
            </div>
          </div>
        ))}
      </section>
    </>
  );
}
