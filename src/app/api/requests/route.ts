import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createRequestSchema } from "@/lib/validation";
import { canCreateRequest } from "@/lib/permissions";
import { determineApprovalPath, nextPendingStatus } from "@/lib/workflow";
import { nextRequestNumber, getVisibleRequests } from "@/lib/requests";
import { auditLog } from "@/lib/audit";
import { notifyNextApprovers } from "@/lib/notifications";
import { saveUpload } from "@/lib/uploads";
import { resolveRequestSignatories } from "@/lib/signatories";

function optionalString(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export async function GET() {
  const user = await requireUser();
  const requests = await getVisibleRequests(user);
  return NextResponse.json({ requests });
}

export async function POST(request: Request) {
  const user = await requireUser();
  const formData = await request.formData();
  const payload = createRequestSchema.safeParse({
    typeId: optionalString(formData.get("typeId")),
    title: optionalString(formData.get("title")),
    description: optionalString(formData.get("description")),
    requestingChurchId: optionalString(formData.get("requestingChurchId")),
    targetChurchId: optionalString(formData.get("targetChurchId")),
    targetDistrictId: optionalString(formData.get("targetDistrictId")),
    targetConferenceId: optionalString(formData.get("targetConferenceId")),
    targetUnionId: optionalString(formData.get("targetUnionId")),
    proposedDate: optionalString(formData.get("proposedDate")),
    requiredToDate: optionalString(formData.get("requiredToDate")),
    contactPerson: optionalString(formData.get("contactPerson")),
    contactEmail: optionalString(formData.get("contactEmail")),
    serviceRequired: optionalString(formData.get("serviceRequired")),
    presentationMethod: optionalString(formData.get("presentationMethod")),
    nameSuggested: optionalString(formData.get("nameSuggested")),
    fromWhere: optionalString(formData.get("fromWhere")),
    whereRequired: optionalString(formData.get("whereRequired")),
    boardActionNumber: optionalString(formData.get("boardActionNumber")),
    expensesIncurredBy: optionalString(formData.get("expensesIncurredBy")),
    clericalOfficeName: optionalString(formData.get("clericalOfficeName")),
    clericalOfficePhone: optionalString(formData.get("clericalOfficePhone")),
    firstElderName: optionalString(formData.get("firstElderName")),
    firstElderPhone: optionalString(formData.get("firstElderPhone")),
    districtPastorName: optionalString(formData.get("districtPastorName")),
    districtPastorPhone: optionalString(formData.get("districtPastorPhone")),
    priority: optionalString(formData.get("priority")) ?? "NORMAL",
    additionalNotes: optionalString(formData.get("additionalNotes")),
    saveAsDraft: formData.get("saveAsDraft") === "true"
  });

  if (!payload.success) {
    return NextResponse.json({ error: "Check the request form and try again." }, { status: 400 });
  }

  if (!canCreateRequest(user, payload.data.requestingChurchId)) {
    return NextResponse.json({ error: "You cannot create a request for this church." }, { status: 403 });
  }

  const requestingChurch = await prisma.church.findUnique({
    where: { id: payload.data.requestingChurchId },
    include: { district: { include: { conference: { include: { union: true } } } } }
  });

  if (!requestingChurch) {
    return NextResponse.json({ error: "Requesting church was not found." }, { status: 404 });
  }

  const [targetChurch, targetDistrict, targetConference, targetUnion] = await Promise.all([
    payload.data.targetChurchId
      ? prisma.church.findUnique({
          where: { id: payload.data.targetChurchId },
          include: { district: { include: { conference: { include: { union: true } } } } }
        })
      : null,
    payload.data.targetDistrictId
      ? prisma.district.findUnique({
          where: { id: payload.data.targetDistrictId },
          include: { conference: { include: { union: true } } }
        })
      : null,
    payload.data.targetConferenceId
      ? prisma.conference.findUnique({
          where: { id: payload.data.targetConferenceId },
          include: { union: true }
        })
      : null,
    payload.data.targetUnionId
      ? prisma.union.findUnique({
          where: { id: payload.data.targetUnionId }
        })
      : null
  ]);

  const uploadedFiles = formData
    .getAll("attachments")
    .filter((file): file is File => file instanceof File && file.size > 0);

  let savedUploads: Awaited<ReturnType<typeof saveUpload>>[] = [];
  try {
    savedUploads = await Promise.all(uploadedFiles.map((file) => saveUpload(file)));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not save upload." },
      { status: 400 }
    );
  }

  const workflow = payload.data.saveAsDraft
    ? []
    : determineApprovalPath(requestingChurch, {
        church: targetChurch,
        district: targetDistrict,
        conference: targetConference,
        union: targetUnion
      });

  const firstStep = workflow[0];
  const requestNumber = await nextRequestNumber();
  const signatories = await resolveRequestSignatories({
    requesterId: user.id,
    districtId: requestingChurch.districtId
  });
  const serviceRequest = await prisma.serviceRequest.create({
    data: {
      requestNumber,
      typeId: payload.data.typeId,
      title: payload.data.title,
      description: payload.data.description,
      requestingChurchId: payload.data.requestingChurchId,
      targetChurchId: payload.data.targetChurchId,
      targetDistrictId: payload.data.targetDistrictId,
      targetConferenceId: payload.data.targetConferenceId,
      targetUnionId: payload.data.targetUnionId,
      proposedDate: payload.data.proposedDate ? new Date(payload.data.proposedDate) : null,
      requiredToDate: payload.data.requiredToDate ? new Date(payload.data.requiredToDate) : null,
      contactPerson: payload.data.contactPerson,
      contactEmail: payload.data.contactEmail,
      serviceRequired: payload.data.serviceRequired,
      presentationMethod: payload.data.presentationMethod,
      nameSuggested: payload.data.nameSuggested,
      fromWhere: payload.data.fromWhere,
      whereRequired: payload.data.whereRequired,
      boardActionNumber: payload.data.boardActionNumber,
      expensesIncurredBy: payload.data.expensesIncurredBy,
      clericalOfficeName: signatories.clericalOfficeName,
      clericalOfficePhone: signatories.clericalOfficePhone,
      firstElderName: payload.data.firstElderName,
      firstElderPhone: payload.data.firstElderPhone,
      districtPastorName: signatories.districtPastorName,
      districtPastorPhone: signatories.districtPastorPhone,
      priority: payload.data.priority,
      additionalNotes: payload.data.additionalNotes,
      requesterId: user.id,
      status: firstStep ? nextPendingStatus(firstStep.stage) : "DRAFT",
      currentStepOrder: firstStep?.stepOrder,
      approvalSteps: {
        create: workflow.map((step) => ({
          ...step,
          status: "PENDING"
        }))
      },
      attachments: {
        create: savedUploads.map((file) => ({
          ...file,
          uploaderId: user.id
        }))
      },
      comments: {
        create: {
          authorId: user.id,
          body: payload.data.saveAsDraft
            ? "Draft request created."
            : "Request submitted for approval.",
          system: true
        }
      }
    },
    include: {
      approvalSteps: true
    }
  });

  await auditLog({
    actorId: user.id,
    requestId: serviceRequest.id,
    action: payload.data.saveAsDraft ? "REQUEST_DRAFT_CREATED" : "REQUEST_SUBMITTED",
    entityType: "ServiceRequest",
    entityId: serviceRequest.id,
    metadata: { requestNumber }
  });

  if (firstStep) {
    await notifyNextApprovers({
      requestId: serviceRequest.id,
      requestNumber,
      title: serviceRequest.title,
      stage: firstStep.stage,
      scope: firstStep
    });
  }

  return NextResponse.json({ id: serviceRequest.id, requestNumber }, { status: 201 });
}
