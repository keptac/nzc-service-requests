import { NextResponse } from "next/server";
import { clearSessionCookie, getCurrentUser } from "@/lib/auth";
import { auditLog } from "@/lib/audit";

export async function POST() {
  const user = await getCurrentUser();
  clearSessionCookie();

  if (user) {
    await auditLog({
      actorId: user.id,
      action: "USER_LOGOUT",
      entityType: "User",
      entityId: user.id
    });
  }

  return NextResponse.json({ ok: true });
}
