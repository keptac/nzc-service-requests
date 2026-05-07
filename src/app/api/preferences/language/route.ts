import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { languagePreferenceSchema } from "@/lib/validation";

export async function PATCH(request: Request) {
  const user = await requireUser();
  const payload = languagePreferenceSchema.safeParse(await request.json().catch(() => null));

  if (!payload.success) {
    return NextResponse.json({ error: "Invalid language preference." }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { preferredLanguage: payload.data.preferredLanguage }
  });

  return NextResponse.json({ preferredLanguage: payload.data.preferredLanguage });
}
