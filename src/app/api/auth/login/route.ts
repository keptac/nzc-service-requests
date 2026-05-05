import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validation";
import { setSessionCookie, signSession, verifyPassword } from "@/lib/auth";
import { auditLog } from "@/lib/audit";

export async function POST(request: Request) {
  const payload = loginSchema.safeParse(await request.json().catch(() => null));

  if (!payload.success) {
    return NextResponse.json({ error: "Enter a valid email and password." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email: payload.data.email.toLowerCase() },
    include: { role: true }
  });

  if (!user || !user.active) {
    return NextResponse.json({ error: "Invalid login details." }, { status: 401 });
  }

  const valid = await verifyPassword(payload.data.password, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "Invalid login details." }, { status: 401 });
  }

  setSessionCookie(signSession(user));
  await auditLog({
    actorId: user.id,
    action: "USER_LOGIN",
    entityType: "User",
    entityId: user.id,
    metadata: { role: user.role.name }
  });

  return NextResponse.json({ ok: true });
}
