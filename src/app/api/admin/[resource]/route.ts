import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createEntitySchemas, updateEntitySchemas } from "@/lib/validation";
import { hashPassword } from "@/lib/auth";
import { auditLog } from "@/lib/audit";
import { approvedWhatsAppNumber, isPastorRoleName, normalizeWhatsAppNumber } from "@/lib/phone";
import type { RoleName } from "@/lib/constants";

type Resource = keyof typeof createEntitySchemas;

const resources = ["unions", "conferences", "districts", "churches", "users", "requestTypes"] as const;

function isResource(resource: string): resource is Resource {
  return resources.includes(resource as Resource);
}

function modelFor(resource: Resource) {
  const models = {
    unions: prisma.union,
    conferences: prisma.conference,
    districts: prisma.district,
    churches: prisma.church,
    users: prisma.user,
    requestTypes: prisma.serviceRequestType
  };
  return models[resource] as any;
}

function nullableId(value: string | null | undefined) {
  return value && value.length > 0 ? value : null;
}

export async function POST(request: Request, { params }: { params: { resource: string } }) {
  const user = await requireSuperAdmin();
  if (!isResource(params.resource)) {
    return NextResponse.json({ error: "Unknown admin resource." }, { status: 404 });
  }

  const schema = createEntitySchemas[params.resource];
  const payload = schema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid admin form data." }, { status: 400 });
  }

  let created: { id: string };
  if (params.resource === "users") {
    const data = payload.data as {
      name: string;
      email: string;
      password: string;
      roleName: RoleName;
      phonePrimary?: string | null;
      phoneSecondary?: string | null;
      whatsappNumber?: string | null;
      whatsappEnabled?: boolean;
      preferredLanguage?: string;
      unionId?: string | null;
      conferenceId?: string | null;
      districtId?: string | null;
      churchId?: string | null;
    };
    const role = await prisma.role.findUnique({ where: { name: data.roleName } });
    if (!role) return NextResponse.json({ error: "Role not found." }, { status: 400 });
    const phonePrimary = normalizeWhatsAppNumber(data.phonePrimary);
    const phoneSecondary = normalizeWhatsAppNumber(data.phoneSecondary);
    const whatsappNumber = approvedWhatsAppNumber({
      whatsappNumber: data.whatsappNumber,
      phonePrimary,
      phoneSecondary
    });
    const whatsappEnabled = Boolean(
      whatsappNumber && (data.whatsappEnabled || isPastorRoleName(data.roleName))
    );

    created = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email.toLowerCase(),
        passwordHash: await hashPassword(data.password),
        phonePrimary,
        phoneSecondary,
        whatsappNumber,
        whatsappEnabled,
        whatsappEnabledAt: whatsappEnabled ? new Date() : null,
        preferredLanguage: data.preferredLanguage,
        roleId: role.id,
        unionId: nullableId(data.unionId),
        conferenceId: nullableId(data.conferenceId),
        districtId: nullableId(data.districtId),
        churchId: nullableId(data.churchId)
      }
    });
  } else {
    created = await modelFor(params.resource).create({
      data: payload.data
    });
  }

  await auditLog({
    actorId: user.id,
    action: "ADMIN_CREATED",
    entityType: params.resource,
    entityId: created.id
  });

  return NextResponse.json({ id: created.id }, { status: 201 });
}

export async function PATCH(request: Request, { params }: { params: { resource: string } }) {
  const user = await requireSuperAdmin();
  if (!isResource(params.resource)) {
    return NextResponse.json({ error: "Unknown admin resource." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : null;
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  const schema = updateEntitySchemas[params.resource];
  const payload = schema.safeParse(body);
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid admin form data." }, { status: 400 });
  }

  let updated: { id: string };
  if (params.resource === "users") {
    const data = payload.data as {
      name?: string;
      email?: string;
      password?: string;
      roleName?: RoleName;
      phonePrimary?: string | null;
      phoneSecondary?: string | null;
      whatsappNumber?: string | null;
      whatsappEnabled?: boolean;
      preferredLanguage?: string;
      unionId?: string | null;
      conferenceId?: string | null;
      districtId?: string | null;
      churchId?: string | null;
      active?: boolean;
    };
    const role = data.roleName ? await prisma.role.findUnique({ where: { name: data.roleName } }) : null;
    const existing = await prisma.user.findUnique({
      where: { id },
      include: { role: true }
    });
    if (!existing) return NextResponse.json({ error: "User not found." }, { status: 404 });
    const nextRoleName = data.roleName ?? (existing.role.name as RoleName);
    const phonePrimary =
      data.phonePrimary === undefined ? existing.phonePrimary : normalizeWhatsAppNumber(data.phonePrimary);
    const phoneSecondary =
      data.phoneSecondary === undefined ? existing.phoneSecondary : normalizeWhatsAppNumber(data.phoneSecondary);
    const explicitWhatsAppNumber =
      data.whatsappNumber === undefined
        ? existing.whatsappNumber
        : normalizeWhatsAppNumber(data.whatsappNumber);
    const whatsappNumber = approvedWhatsAppNumber({
      whatsappNumber: explicitWhatsAppNumber,
      phonePrimary,
      phoneSecondary
    });
    const shouldEnableWhatsApp = Boolean(
      whatsappNumber && (isPastorRoleName(nextRoleName) || data.whatsappEnabled === true)
    );
    const shouldDisableWhatsApp = !isPastorRoleName(nextRoleName) && data.whatsappEnabled === false;
    const nextWhatsAppEnabled = Boolean(
      whatsappNumber && (shouldDisableWhatsApp ? false : shouldEnableWhatsApp || existing.whatsappEnabled)
    );
    const whatsappEnabledAt =
      !existing.whatsappEnabled && nextWhatsAppEnabled ? new Date() : nextWhatsAppEnabled ? existing.whatsappEnabledAt : null;

    updated = await prisma.user.update({
      where: { id },
      data: {
        name: data.name,
        email: data.email?.toLowerCase(),
        passwordHash: data.password ? await hashPassword(data.password) : undefined,
        phonePrimary: data.phonePrimary === undefined ? undefined : phonePrimary,
        phoneSecondary: data.phoneSecondary === undefined ? undefined : phoneSecondary,
        whatsappNumber:
          data.whatsappNumber === undefined &&
          data.phonePrimary === undefined &&
          data.phoneSecondary === undefined
            ? undefined
            : whatsappNumber,
        whatsappEnabled: nextWhatsAppEnabled,
        whatsappEnabledAt,
        preferredLanguage: data.preferredLanguage,
        roleId: role?.id,
        unionId: data.unionId === undefined ? undefined : nullableId(data.unionId),
        conferenceId: data.conferenceId === undefined ? undefined : nullableId(data.conferenceId),
        districtId: data.districtId === undefined ? undefined : nullableId(data.districtId),
        churchId: data.churchId === undefined ? undefined : nullableId(data.churchId),
        active: data.active
      }
    });
  } else {
    const { id: ignored, ...data } = payload.data as Record<string, unknown>;
    void ignored;
    updated = await modelFor(params.resource).update({
      where: { id },
      data
    });
  }

  await auditLog({
    actorId: user.id,
    action: "ADMIN_UPDATED",
    entityType: params.resource,
    entityId: updated.id
  });

  return NextResponse.json({ id: updated.id });
}
