import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { commentSchema } from "@/lib/validation";
import { accessContext, getRequestById } from "@/lib/requests";
import { canComment } from "@/lib/permissions";
import { auditLog } from "@/lib/audit";
import { notifyUsers } from "@/lib/notifications";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  const payload = commentSchema.safeParse(await request.json().catch(() => null));

  if (!payload.success) {
    return NextResponse.json({ error: "Comment cannot be empty." }, { status: 400 });
  }

  const serviceRequest = await getRequestById(params.id);
  if (!serviceRequest) return NextResponse.json({ error: "Request not found." }, { status: 404 });

  if (!canComment(user, accessContext(serviceRequest))) {
    return NextResponse.json({ error: "You cannot comment on this request." }, { status: 403 });
  }

  const comment = await prisma.comment.create({
    data: {
      requestId: serviceRequest.id,
      authorId: user.id,
      body: payload.data.body
    },
    include: {
      author: { include: { role: true } }
    }
  });

  const notifyIds = new Set<string>([serviceRequest.requesterId]);
  serviceRequest.comments.forEach((item) => notifyIds.add(item.authorId));
  notifyIds.delete(user.id);

  await notifyUsers({
    userIds: Array.from(notifyIds),
    requestId: serviceRequest.id,
    title: `New comment on ${serviceRequest.requestNumber}`,
    body: `${user.name} commented on ${serviceRequest.title}.`
  });

  await auditLog({
    actorId: user.id,
    requestId: serviceRequest.id,
    action: "COMMENT_CREATED",
    entityType: "Comment",
    entityId: comment.id
  });

  return NextResponse.json({ comment });
}
