"use server";

import { getStaff, type StaffLevel } from "@/lib/admin/guard";

/** Client-safe staff check for the header admin link. */
export async function getMyStaffLevel(): Promise<StaffLevel | null> {
  return (await getStaff())?.level ?? null;
}
