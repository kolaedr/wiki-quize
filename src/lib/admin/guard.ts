import { headers } from "next/headers";
import { auth } from "@/lib/auth";

/**
 * Super-admin gate. Access when user.role === "admin" OR the email is listed
 * in ADMIN_EMAILS (bootstrap: the very first admin can't set roles yet).
 */
export async function getAdminSession() {
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null);
  if (!session) return null;

  const role = (session.user as { role?: string }).role;
  const allowlist = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const isAdmin =
    role === "admin" || allowlist.includes(session.user.email.toLowerCase());
  return isAdmin ? session : null;
}
