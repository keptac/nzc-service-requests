import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  ROLE_NAMES,
  SERVICE_REQUEST_TYPES,
  STAGE_TO_STATUS,
  type RoleName
} from "../src/lib/constants";
import { determineApprovalPath } from "../src/lib/workflow";
import { approvedWhatsAppNumber, isPastorRoleName } from "../src/lib/phone";
import {
  cleanText,
  dataQualityStatus,
  duplicateKeyForRow,
  generatedEmailForName,
  makeUniqueEmail,
  normalizeImportRows,
  slugifyCode,
  stableHash,
  type ImportConferenceCode,
  type NormalizedImportRow
} from "./seed-helpers";

const prisma = new PrismaClient();
const DEFAULT_PASSWORD = "Password123!";
const SEED_DIR = path.join(process.cwd(), "prisma", "seed");

type ServiceRequestTypeName = (typeof SERVICE_REQUEST_TYPES)[number];

const CONFERENCE_FILES: Array<{
  code: ImportConferenceCode;
  name: string;
  fileName: string;
}> = [
  {
    code: "EZC",
    name: "East Zimbabwe Conference",
    fileName: "ezc_church_clerks_full.csv"
  },
  {
    code: "NZC",
    name: "North Zimbabwe Conference",
    fileName: "nzc_church_clerks_full.csv"
  }
];

function readSeedRows() {
  return CONFERENCE_FILES.flatMap(({ code, fileName }) => {
    const filePath = path.join(SEED_DIR, fileName);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Missing seed CSV: ${filePath}`);
    }
    return normalizeImportRows(fs.readFileSync(filePath, "utf8"), code);
  });
}

function uniqueRows(rows: NormalizedImportRow[]) {
  const seen = new Set<string>();
  const imported: NormalizedImportRow[] = [];
  let duplicates = 0;

  for (const row of rows) {
    const key = duplicateKeyForRow(row);
    if (seen.has(key)) {
      duplicates += 1;
      continue;
    }
    seen.add(key);
    imported.push(row);
  }

  return { imported, duplicates };
}

function uniqueCode(base: string, usedCodes: Set<string>) {
  const normalized = base.replace(/-+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "SEED";
  let code = normalized;
  let suffix = 2;
  while (usedCodes.has(code)) {
    const suffixText = `-${suffix}`;
    code = `${normalized.slice(0, 48 - suffixText.length)}${suffixText}`;
    suffix += 1;
  }
  usedCodes.add(code);
  return code;
}

function hierarchyKey(...parts: string[]) {
  return parts.map((part) => cleanText(part).toLowerCase()).join("|");
}

function titleFromEmail(email: string, fallback: string) {
  const localPart = email.split("@")[0] ?? fallback;
  const words = localPart
    .replace(/[._-]+/g, " ")
    .replace(/[0-9]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const name = words.length
    ? words.map((word) => `${word[0]?.toUpperCase() ?? ""}${word.slice(1)}`).join(" ")
    : fallback;
  return `Pastor ${name}`;
}

async function clearDatabase() {
  await prisma.whatsAppMessage.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.approvalStep.deleteMany();
  await prisma.serviceRequest.deleteMany();
  await prisma.user.deleteMany();
  await prisma.role.deleteMany();
  await prisma.serviceRequestType.deleteMany();
  await prisma.church.deleteMany();
  await prisma.district.deleteMany();
  await prisma.conference.deleteMany();
  await prisma.union.deleteMany();
}

async function createRoles() {
  const roles = {} as Record<RoleName, { id: string }>;
  for (const name of ROLE_NAMES) {
    const role = await prisma.role.create({
      data: {
        name,
        description: `${name} system role`
      }
    });
    roles[name] = role;
  }
  return roles;
}

async function createServiceRequestTypes() {
  const requestTypes = {} as Record<ServiceRequestTypeName, { id: string }>;
  for (const name of SERVICE_REQUEST_TYPES) {
    const requestType = await prisma.serviceRequestType.create({ data: { name } });
    requestTypes[name] = requestType;
  }
  return requestTypes;
}

async function createHierarchy(rows: NormalizedImportRow[]) {
  const usedDistrictCodes = new Set<string>();
  const usedChurchCodes = new Set<string>();
  const union = await prisma.union.create({
    data: {
      name: "Zimbabwe East Union Conference",
      code: "ZEUC"
    }
  });

  const conferences = Object.fromEntries(
    await Promise.all(
      CONFERENCE_FILES.map(async ({ code, name }) => [
        code,
        await prisma.conference.create({
          data: {
            name,
            code,
            unionId: union.id
          }
        })
      ])
    )
  ) as Record<ImportConferenceCode, { id: string; code: string; name: string; unionId: string }>;

  const districtNames = new Map<string, { conferenceCode: ImportConferenceCode; districtName: string }>();
  for (const row of rows) {
    districtNames.set(hierarchyKey(row.sourceConferenceCode, row.districtName), {
      conferenceCode: row.sourceConferenceCode,
      districtName: row.districtName
    });
  }

  const districts = new Map<string, { id: string; name: string; conferenceId: string }>();
  for (const item of [...districtNames.values()].sort((a, b) =>
    `${a.conferenceCode}-${a.districtName}`.localeCompare(`${b.conferenceCode}-${b.districtName}`)
  )) {
    const code = uniqueCode(
      `${item.conferenceCode}-${slugifyCode(item.districtName, stableHash(item.districtName))}`,
      usedDistrictCodes
    );
    const district = await prisma.district.create({
      data: {
        name: item.districtName,
        code,
        conferenceId: conferences[item.conferenceCode].id
      }
    });
    districts.set(hierarchyKey(item.conferenceCode, item.districtName), district);
  }

  const churchNames = new Map<
    string,
    { conferenceCode: ImportConferenceCode; districtName: string; churchName: string }
  >();
  for (const row of rows) {
    churchNames.set(hierarchyKey(row.sourceConferenceCode, row.districtName, row.churchName), {
      conferenceCode: row.sourceConferenceCode,
      districtName: row.districtName,
      churchName: row.churchName
    });
  }

  const churches = new Map<string, { id: string; name: string; districtId: string }>();
  for (const item of [...churchNames.values()].sort((a, b) =>
    `${a.conferenceCode}-${a.districtName}-${a.churchName}`.localeCompare(
      `${b.conferenceCode}-${b.districtName}-${b.churchName}`
    )
  )) {
    const district = districts.get(hierarchyKey(item.conferenceCode, item.districtName));
    if (!district) throw new Error(`Missing district for church ${item.churchName}`);
    const code = uniqueCode(
      `${item.conferenceCode}-${slugifyCode(item.districtName, stableHash(item.districtName)).slice(0, 12)}-${slugifyCode(
        item.churchName,
        stableHash(item.churchName)
      ).slice(0, 20)}`,
      usedChurchCodes
    );
    const church = await prisma.church.create({
      data: {
        name: item.churchName,
        code,
        districtId: district.id
      }
    });
    churches.set(hierarchyKey(item.conferenceCode, item.districtName, item.churchName), church);
  }

  return { union, conferences, districts, churches };
}

async function createImportedUsers(input: {
  rows: NormalizedImportRow[];
  roles: Record<RoleName, { id: string }>;
  hierarchy: Awaited<ReturnType<typeof createHierarchy>>;
  passwordHash: string;
}) {
  const usedEmails = new Set<string>();
  const createdUsers: Array<{ dataQualityStatus: string }> = [];

  const superAdmin = await prisma.user.create({
    data: {
      name: "ZEUC Super Admin",
      email: makeUniqueEmail("super.admin@zeuc.local", usedEmails),
      passwordHash: input.passwordHash,
      roleId: input.roles["Super Admin"].id,
      unionId: input.hierarchy.union.id,
      isSeedUser: true,
      dataQualityStatus: "clean"
    }
  });
  createdUsers.push(superAdmin);

  for (const row of input.rows) {
    const conference = input.hierarchy.conferences[row.sourceConferenceCode];
    const district = input.hierarchy.districts.get(hierarchyKey(row.sourceConferenceCode, row.districtName));
    const church = input.hierarchy.churches.get(
      hierarchyKey(row.sourceConferenceCode, row.districtName, row.churchName)
    );
    if (!district || !church) throw new Error(`Missing hierarchy for ${row.sourceRowNumber}`);

    const qualityNotes = [...row.qualityNotes];
    let email = row.emailCandidate;
    if (!email || usedEmails.has(email)) {
      if (email && usedEmails.has(email)) qualityNotes.push("duplicate_email_replaced");
      email = generatedEmailForName(row.fullName);
    }
    email = makeUniqueEmail(email, usedEmails);
    const whatsappNumber = approvedWhatsAppNumber({
      phonePrimary: row.phonePrimary,
      phoneSecondary: row.phoneSecondary
    });
    const whatsappEnabled = Boolean(whatsappNumber && isPastorRoleName(row.roleName));

    const created = await prisma.user.create({
      data: {
        name: row.fullName,
        email,
        passwordHash: input.passwordHash,
        phonePrimary: row.phonePrimary,
        phoneSecondary: row.phoneSecondary,
        whatsappNumber,
        whatsappEnabled,
        whatsappEnabledAt: whatsappEnabled ? new Date() : null,
        isSeedUser: true,
        dataQualityStatus: dataQualityStatus(qualityNotes),
        roleId: input.roles[row.roleName].id,
        unionId: input.hierarchy.union.id,
        conferenceId: conference.id,
        districtId: district.id,
        churchId: church.id
      }
    });
    createdUsers.push(created);
  }

  const pastorRowsByDistrict = new Map<string, NormalizedImportRow>();
  let pastorEmailConflicts = 0;
  for (const row of input.rows.filter((item) => item.sourceConferenceCode === "NZC" && item.pastorEmail)) {
    const key = hierarchyKey(row.sourceConferenceCode, row.districtName);
    const existing = pastorRowsByDistrict.get(key);
    if (!existing) {
      pastorRowsByDistrict.set(key, row);
      continue;
    }
    if (existing.pastorEmail !== row.pastorEmail) pastorEmailConflicts += 1;
  }

  for (const row of pastorRowsByDistrict.values()) {
    if (!row.pastorEmail) continue;
    const conference = input.hierarchy.conferences.NZC;
    const district = input.hierarchy.districts.get(hierarchyKey("NZC", row.districtName));
    if (!district) throw new Error(`Missing NZC district for pastor ${row.pastorEmail}`);

    const qualityNotes = ["pastor_name_inferred"];
    let email = row.pastorEmail;
    if (usedEmails.has(email)) {
      const [localPart, domain] = email.split("@");
      email = `${localPart}.${slugifyCode(row.districtName, stableHash(row.districtName)).toLowerCase()}@${domain}`;
      qualityNotes.push("duplicate_pastor_email_replaced");
    }

    const created = await prisma.user.create({
      data: {
        name: titleFromEmail(row.pastorEmail, row.districtName),
        email: makeUniqueEmail(email, usedEmails),
        passwordHash: input.passwordHash,
        whatsappEnabled: false,
        isSeedUser: true,
        dataQualityStatus: dataQualityStatus(qualityNotes),
        roleId: input.roles["District Pastor"].id,
        unionId: input.hierarchy.union.id,
        conferenceId: conference.id,
        districtId: district.id
      }
    });
    createdUsers.push(created);
  }

  return {
    createdUsers,
    pastorEmailConflicts
  };
}

async function createSampleRequests(requestTypes: Record<ServiceRequestTypeName, { id: string }>) {
  const users = await prisma.user.findMany({
    where: {
      role: { name: "Church Clerk" },
      churchId: { not: null }
    },
    include: {
      church: {
        include: {
          district: {
            include: {
              conference: {
                include: { union: true }
              }
            }
          }
        }
      }
    },
    orderBy: [{ email: "asc" }]
  });

  const churches = await prisma.church.findMany({
    include: {
      district: {
        include: {
          conference: {
            include: { union: true }
          }
        }
      }
    },
    orderBy: [{ name: "asc" }]
  });

  const ezcRequester = users.find((user) => user.church?.district.conference.code === "EZC");
  const nzcRequester = users.find((user) => user.church?.district.conference.code === "NZC");
  if (!ezcRequester?.church || !nzcRequester?.church) {
    throw new Error("Seed CSVs must provide at least one EZC and one NZC Church Clerk.");
  }

  const nzcPeer =
    churches.find(
      (church) => church.districtId === nzcRequester.church?.districtId && church.id !== nzcRequester.churchId
    ) ?? nzcRequester.church;
  const ezcPeer =
    churches.find(
      (church) => church.districtId !== ezcRequester.church?.districtId && church.district.conference.code === "EZC"
    ) ?? ezcRequester.church;

  await createRequest({
    number: "ZEUC-2026-00001",
    title: `Music ministry visit to ${nzcPeer.name}`,
    description: `Request for a music group from ${nzcRequester.church.name} to minister at ${nzcPeer.name}.`,
    typeName: "Music Group",
    requestingChurch: nzcRequester.church,
    targetChurch: nzcPeer,
    requester: nzcRequester,
    serviceRequired: "Music ministry",
    nameSuggested: `${nzcRequester.church.name} music group`
  });

  await createRequest({
    number: "ZEUC-2026-00002",
    title: `Preaching assignment at ${nzcRequester.church.name}`,
    description: `Cross-conference request from ${ezcRequester.church.name} to ${nzcRequester.church.name}.`,
    typeName: "Preaching Assignment",
    requestingChurch: ezcRequester.church,
    targetChurch: nzcRequester.church,
    requester: ezcRequester,
    serviceRequired: "Preaching",
    nameSuggested: ezcRequester.name
  });

  await createRequest({
    number: "ZEUC-2026-00003",
    title: `Clerk training at ${ezcPeer.name}`,
    description: `Training request using real East Zimbabwe Conference churches from the import dataset.`,
    typeName: "Training",
    requestingChurch: ezcRequester.church,
    targetChurch: ezcPeer,
    requester: ezcRequester,
    serviceRequired: "Training",
    nameSuggested: "ZEUC clerk training team",
    requiredToDate: new Date("2026-06-14")
  });

  async function createRequest(input: {
    number: string;
    title: string;
    description: string;
    typeName: ServiceRequestTypeName;
    requestingChurch: NonNullable<(typeof users)[number]["church"]>;
    targetChurch: (typeof churches)[number];
    requester: (typeof users)[number];
    serviceRequired: string;
    nameSuggested: string;
    requiredToDate?: Date;
  }) {
    const workflow = determineApprovalPath(input.requestingChurch, { church: input.targetChurch });
    const currentStage = workflow[0]?.stage ?? "PASTOR";
    const fromWhere = `${input.requestingChurch.name}, ${input.requestingChurch.district.name}`;
    const whereRequired = `${input.targetChurch.name}, ${input.targetChurch.district.name}`;
    const districtPastor = await prisma.user.findFirst({
      where: {
        active: true,
        districtId: input.requestingChurch.districtId,
        role: { name: "District Pastor" }
      },
      orderBy: { name: "asc" }
    });

    await prisma.serviceRequest.create({
      data: {
        requestNumber: input.number,
        title: input.title,
        description: input.description,
        typeId: requestTypes[input.typeName].id,
        requestingChurchId: input.requestingChurch.id,
        targetChurchId: input.targetChurch.id,
        proposedDate: new Date("2026-06-06"),
        requiredToDate: input.requiredToDate,
        requesterId: input.requester.id,
        contactPerson: input.requester.name,
        contactEmail: input.requester.email,
        serviceRequired: input.serviceRequired,
        presentationMethod: "In person",
        nameSuggested: input.nameSuggested,
        fromWhere,
        whereRequired,
        expensesIncurredBy: input.requestingChurch.name,
        clericalOfficeName: input.requester.name,
        clericalOfficePhone: input.requester.phonePrimary,
        districtPastorName: districtPastor?.name,
        districtPastorPhone:
          districtPastor?.phonePrimary ?? districtPastor?.phoneSecondary ?? districtPastor?.whatsappNumber,
        additionalNotes: "Sample request created from imported ZEUC seed data.",
        status: STAGE_TO_STATUS[currentStage],
        currentStepOrder: 1,
        approvalSteps: {
          create: workflow.map((step) => ({
            ...step,
            status: step.stepOrder === 1 ? "PENDING" : "PENDING"
          }))
        },
        comments: {
          create: [
            {
              authorId: input.requester.id,
              body: "Seed sample request created for workflow validation."
            }
          ]
        },
        auditLogs: {
          create: [
            {
              actorId: input.requester.id,
              action: "REQUEST_CREATED",
              entityType: "ServiceRequest",
              entityId: input.number,
              metadata: JSON.stringify({ seeded: true, source: "zeuc_csv_import" })
            }
          ]
        }
      }
    });
  }
}

async function main() {
  const rawRows = readSeedRows();
  const { imported: rows, duplicates } = uniqueRows(rawRows);
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);

  await clearDatabase();
  const roles = await createRoles();
  const requestTypes = await createServiceRequestTypes();
  const hierarchy = await createHierarchy(rows);
  const { createdUsers, pastorEmailConflicts } = await createImportedUsers({
    rows,
    roles,
    hierarchy,
    passwordHash
  });
  await createSampleRequests(requestTypes);

  const needsReview = createdUsers.filter((user) => user.dataQualityStatus === "needs_review").length;
  console.log(`Seed complete using ZEUC CSV data.`);
  console.log(`Rows imported: ${rows.length}. Duplicate rows skipped: ${duplicates}.`);
  console.log(`Users created: ${createdUsers.length}. Needs review: ${needsReview}.`);
  console.log(`District pastor email conflicts skipped after first district email: ${pastorEmailConflicts}.`);
  console.log(`Default password for imported users: ${DEFAULT_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
