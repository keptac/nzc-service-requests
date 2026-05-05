import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notificationSchema } from "@/lib/validation";

export async function PATCH(request: Request) {
  const user = await requireUser();
  const payload = notificationSchema.safeParse(await request.json().catch(() => null));

  if (!payload.success) {
    return NextResponse.json({ error: "Invalid notification." }, { status: 400 });
  }

  await prisma.notification.updateMany({
    where: {
      id: payload.data.notificationId,
      userId: user.id
    },
    data: {
      readAt: new Date()
    }
  });

  return NextResponse.json({ ok: true });
}
