const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

const roles = [
  "Super Admin",
  "Union President",
  "Union Secretary",
  "Union Admin",
  "Conference President",
  "Conference Secretary",
  "Conference Admin",
  "Conference Pastor",
  "District Coordinator",
  "District Pastor",
  "Church Clerk",
  "Assistant Church Clerk",
  "Church Elder"
];

const requestTypes = ["Music Group", "Preaching Assignment", "Training", "Other"];
const approverRoles = {
  DESTINATION: ["Church Clerk", "Assistant Church Clerk", "Church Elder"],
  PASTOR: ["District Pastor"],
  CONFERENCE: [
    "Conference President",
    "Conference Secretary",
    "Conference Admin",
    "Conference Pastor"
  ],
  UNION: ["Union President", "Union Secretary", "Union Admin"]
};
const stageToStatus = {
  DESTINATION: "PENDING_DESTINATION_ACCEPTANCE",
  PASTOR: "PENDING_PASTOR_APPROVAL",
  CONFERENCE: "PENDING_CONFERENCE_APPROVAL",
  UNION: "PENDING_UNION_APPROVAL"
};
const seedDir = path.join(process.cwd(), "prisma", "seed");
const defaultSeedPassword = "Password123!";
const conferenceFiles = [
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

function isPlaceholder(value) {
  return !value || value.includes("replace-with") || value.endsWith("@example.org");
}

function cleanText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[\uFEFF\u200B-\u200D\u2060]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseCsv(content) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const next = content[index + 1];

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        cell += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  const [headerRow, ...dataRows] = rows.filter((cells) => cells.some((value) => cleanText(value)));
  if (!headerRow) return [];

  const headers = headerRow.map((header) => cleanText(header).replace(/^\uFEFF/, ""));
  return dataRows.map((cells) => {
    const parsed = {};
    headers.forEach((header, index) => {
      parsed[header] = cleanText(cells[index]);
    });
    return parsed;
  });
}

function normalizeDistrictName(value) {
  return cleanText(value) || "Needs Review District";
}

function normalizeChurchName(value) {
  return (
    cleanText(value)
      .replace(/_/g, " ")
      .replace(/\bS\.?\s*D\.?\s*A\.?\b\.?/gi, "SDA")
      .replace(/\bSDA\s+Church\b/gi, "SDA Church")
      .replace(/\bSDA$/i, "SDA Church")
      .replace(/\s+Church\s+Church$/i, " Church")
      .replace(/\s+/g, " ")
      .trim() || "Needs Review Church"
  );
}

function normalizeZimbabwePhone(value) {
  const raw = cleanText(value);
  if (!raw) return { value: null, needsReview: false };

  let digits = raw.replace(/[^\d]/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("2630")) digits = `263${digits.slice(4)}`;
  if (digits.startsWith("0")) digits = `263${digits.slice(1)}`;
  if (!digits.startsWith("263") && digits.length === 9) digits = `263${digits}`;

  const normalized = digits ? `+${digits}` : null;
  return {
    value: normalized,
    needsReview: Boolean(normalized && !/^\+263[1-9]\d{8}$/.test(normalized))
  };
}

function normalizeEmail(value) {
  const raw = cleanText(value);
  if (!raw) return { value: null, needsReview: false };

  const email = raw
    .replace(/\s+/g, "")
    .replace(/,+$/g, "")
    .replace(/^mailto:/i, "")
    .replace(/@(gmail|yahoo|hotmail|outlook|icloud|aol)com$/i, "@$1.com")
    .replace(/@(gmail|yahoo|hotmail|outlook|icloud|aol)co\.zw$/i, "@$1.co.zw")
    .toLowerCase();

  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  return { value: valid ? email : null, needsReview: !valid };
}

function roleForPosition(position) {
  const normalized = cleanText(position).toLowerCase();
  if (normalized.includes("district coordinator") || normalized.includes("vice coordinator")) {
    return { roleName: "District Coordinator", needsReview: false };
  }
  if (normalized.includes("assistant") || normalized.includes("associate")) {
    return { roleName: "Assistant Church Clerk", needsReview: false };
  }
  if (normalized.includes("secretary/clerk") || normalized.includes("clerk") || normalized.includes("secretary")) {
    return { roleName: "Church Clerk", needsReview: false };
  }
  return { roleName: "Church Clerk", needsReview: true };
}

function normalizeImportRow(row, sourceConferenceCode, sourceRowNumber) {
  const isEzc = sourceConferenceCode === "EZC";
  const rawDistrict = isEzc ? row.DISTRICT : row["District Name"];
  const rawChurch = row.CHURCH ?? row.Church;
  const rawName = isEzc ? row.NAME : row["Full Name"];
  const rawPosition = isEzc ? row.POSITION : row.Role;
  const rawContact1 = isEzc ? row["CONTACT.1"] : row["Contact 1"];
  const rawContact2 = isEzc ? row["CONTACT.2"] : row["Contact 2"];
  const rawChurchEmail = isEzc ? null : row["Church Email"];
  const rawEmail = isEzc ? row.EMAIL : rawChurchEmail;
  const rawPastorEmail = isEzc ? null : row["Pastor Email"];
  const qualityNotes = [];

  const districtName = normalizeDistrictName(rawDistrict);
  const churchName = normalizeChurchName(rawChurch);
  const fullName = cleanText(rawName) || "Unknown Seed User";
  const position = cleanText(rawPosition);
  const phonePrimary = normalizeZimbabwePhone(rawContact1);
  const phoneSecondary = normalizeZimbabwePhone(rawContact2);
  const email = normalizeEmail(rawEmail);
  const churchEmail = normalizeEmail(rawChurchEmail);
  const pastorEmail = normalizeEmail(rawPastorEmail);
  const role = roleForPosition(position);

  if (!cleanText(rawDistrict)) qualityNotes.push("missing_district");
  if (!cleanText(rawChurch)) qualityNotes.push("missing_church");
  if (!cleanText(rawName) || /^unknown$/i.test(fullName)) qualityNotes.push("missing_or_unknown_name");
  if (!position) qualityNotes.push("missing_position");
  if (role.needsReview) qualityNotes.push("unknown_position");
  if (phonePrimary.needsReview) qualityNotes.push("invalid_primary_phone");
  if (phoneSecondary.needsReview) qualityNotes.push("invalid_secondary_phone");
  if (cleanText(rawEmail) && email.needsReview) qualityNotes.push("invalid_email");
  if (!cleanText(rawEmail)) qualityNotes.push("generated_email");
  if (cleanText(rawPastorEmail) && pastorEmail.needsReview) qualityNotes.push("invalid_pastor_email");

  return {
    sourceConferenceCode,
    sourceRowNumber,
    districtName,
    churchName,
    fullName,
    position,
    roleName: role.roleName,
    phonePrimary: phonePrimary.value,
    phoneSecondary: phoneSecondary.value,
    emailCandidate: email.value,
    churchEmail: churchEmail.value,
    pastorEmail: pastorEmail.value,
    qualityNotes
  };
}

function normalizeImportRows(content, sourceConferenceCode) {
  return parseCsv(content).map((row, index) => normalizeImportRow(row, sourceConferenceCode, index + 2));
}

function readSeedRows() {
  const missing = conferenceFiles
    .map(({ fileName }) => path.join(seedDir, fileName))
    .filter((filePath) => !fs.existsSync(filePath));

  if (missing.length > 0) {
    throw new Error(`BOOTSTRAP_IMPORT_SEED_DATA is enabled, but seed CSVs are missing: ${missing.join(", ")}`);
  }

  return conferenceFiles.flatMap(({ code, fileName }) =>
    normalizeImportRows(fs.readFileSync(path.join(seedDir, fileName), "utf8"), code)
  );
}

function duplicateKeyForRow(row) {
  return [
    row.sourceConferenceCode,
    row.districtName,
    row.churchName,
    row.fullName,
    row.position,
    row.phonePrimary ?? "",
    row.phoneSecondary ?? "",
    row.emailCandidate ?? ""
  ]
    .map((value) => cleanText(value).toLowerCase())
    .join("|");
}

function uniqueRows(rows) {
  const seen = new Set();
  const imported = [];
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

function dataQualityStatus(notes) {
  return notes.length > 0 ? "needs_review" : "clean";
}

function generatedEmailForName(fullName, domain = "seed.zeuc.local") {
  const words = cleanText(fullName)
    .toLowerCase()
    .replace(/[^a-z0-9\s.-]/g, "")
    .split(/[\s.]+/)
    .filter(Boolean);
  const first = words[0] ?? "seed";
  const last = words.length > 1 ? words[words.length - 1] : "user";
  return `${first}.${last}@${domain}`;
}

function reserveEmail(candidate, usedEmails) {
  const normalized = candidate.toLowerCase();
  const atIndex = normalized.lastIndexOf("@");
  const localPart = atIndex > 0 ? normalized.slice(0, atIndex) : normalized;
  const domain = atIndex > 0 ? normalized.slice(atIndex + 1) : "seed.zeuc.local";
  let email = `${localPart}@${domain}`;
  let suffix = 2;

  while (usedEmails.has(email)) {
    email = `${localPart}${suffix}@${domain}`;
    suffix += 1;
  }

  usedEmails.add(email);
  return email;
}

function stableHash(value) {
  return crypto.createHash("sha1").update(value).digest("hex").slice(0, 10);
}

function slugifyCode(value, fallback) {
  const slug = cleanText(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toUpperCase();
  return slug || fallback;
}

function uniqueCode(base, usedCodes) {
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

function hierarchyKey(...parts) {
  return parts.map((part) => cleanText(part).toLowerCase()).join("|");
}

function titleFromEmail(email, fallback) {
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

function isPastorRoleName(roleName) {
  return /\bpastor\b/i.test(roleName ?? "");
}

function approvedWhatsAppNumber(input) {
  return normalizeZimbabwePhone(input.whatsappNumber ?? input.phonePrimary ?? input.phoneSecondary).value;
}

function workflowStepForStage(stage, stepOrder, requestingChurch, target = {}, options = {}) {
  if (stage === "DESTINATION") {
    if (!target.church || target.church.id === requestingChurch.id) {
      throw new Error("Destination acceptance requires a target church.");
    }

    return {
      stage,
      stepOrder,
      assignedRoleGroup: approverRoles.DESTINATION.join(", "),
      assignedScopeType: "CHURCH",
      assignedChurchId: target.church.id
    };
  }

  if (stage === "PASTOR") {
    return {
      stage,
      stepOrder,
      assignedRoleGroup: approverRoles.PASTOR.join(", "),
      assignedScopeType: "DISTRICT",
      assignedDistrictId: requestingChurch.district.id
    };
  }

  if (stage === "CONFERENCE") {
    return {
      stage,
      stepOrder,
      assignedRoleGroup: [options.assignedRoleGroupPrefix, approverRoles.CONFERENCE.join(", ")]
        .filter(Boolean)
        .join(": "),
      assignedScopeType: "CONFERENCE",
      assignedConferenceId: options.assignedConferenceId ?? requestingChurch.district.conference.id
    };
  }

  return {
    stage,
    stepOrder,
    assignedRoleGroup: [options.assignedRoleGroupPrefix, approverRoles.UNION.join(", ")]
      .filter(Boolean)
      .join(": "),
    assignedScopeType: "UNION",
    assignedUnionId: options.assignedUnionId ?? requestingChurch.district.conference.union.id
  };
}

function determineApprovalPath(requestingChurch, target = {}) {
  const steps = [];
  const requestDistrictId = requestingChurch.district.id;
  const requestConferenceId = requestingChurch.district.conference.id;
  const requestUnionId = requestingChurch.district.conference.union.id;
  const resolvedTargetDistrictId = target.church?.district.id ?? target.district?.id ?? null;
  const resolvedTargetConferenceId =
    target.church?.district.conference.id ?? target.district?.conference.id ?? target.conference?.id ?? null;
  const resolvedTargetUnionId =
    target.church?.district.conference.union.id ??
    target.district?.conference.union.id ??
    target.conference?.union.id ??
    target.union?.id ??
    null;

  const addRequestingStage = (stage) => {
    const prefix = stage === "CONFERENCE" ? "Requesting Conference" : stage === "UNION" ? "Requesting Union" : undefined;
    steps.push(
      workflowStepForStage(stage, steps.length + 1, requestingChurch, {}, { assignedRoleGroupPrefix: prefix })
    );
  };

  const addDestinationStage = (stage) => {
    if (stage === "UNION" && resolvedTargetUnionId) {
      steps.push(
        workflowStepForStage(stage, steps.length + 1, requestingChurch, {}, {
          assignedRoleGroupPrefix: "Destination Union",
          assignedUnionId: resolvedTargetUnionId
        })
      );
    }

    if (stage === "CONFERENCE" && resolvedTargetConferenceId) {
      steps.push(
        workflowStepForStage(stage, steps.length + 1, requestingChurch, {}, {
          assignedRoleGroupPrefix: "Destination Conference",
          assignedConferenceId: resolvedTargetConferenceId
        })
      );
    }
  };

  const addDestinationChurchAcceptance = () => {
    if (!target.church || target.church.id === requestingChurch.id) return steps;

    steps.push(workflowStepForStage("DESTINATION", steps.length + 1, requestingChurch, { church: target.church }));
    return steps;
  };

  addRequestingStage("PASTOR");

  if (resolvedTargetDistrictId && resolvedTargetDistrictId === requestDistrictId) {
    return addDestinationChurchAcceptance();
  }

  if (resolvedTargetUnionId && resolvedTargetUnionId !== requestUnionId) {
    addRequestingStage("CONFERENCE");
    addRequestingStage("UNION");
    addDestinationStage("UNION");
    addDestinationStage("CONFERENCE");
    return addDestinationChurchAcceptance();
  }

  if (resolvedTargetConferenceId && resolvedTargetConferenceId === requestConferenceId) {
    addRequestingStage("CONFERENCE");
    return addDestinationChurchAcceptance();
  }

  if (resolvedTargetConferenceId && resolvedTargetConferenceId !== requestConferenceId) {
    addRequestingStage("CONFERENCE");
    addRequestingStage("UNION");
    addDestinationStage("CONFERENCE");
    return addDestinationChurchAcceptance();
  }

  return addDestinationChurchAcceptance();
}

async function createRoles() {
  const roleMap = {};
  for (const name of roles) {
    const role = await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name, description: `${name} role` }
    });
    roleMap[name] = role;
  }
  return roleMap;
}

async function createServiceRequestTypes() {
  const requestTypeMap = {};
  for (const name of requestTypes) {
    const requestType = await prisma.serviceRequestType.upsert({
      where: { name },
      update: { active: true },
      create: { name, active: true }
    });
    requestTypeMap[name] = requestType;
  }
  return requestTypeMap;
}

async function createHierarchy(rows) {
  const usedDistrictCodes = new Set();
  const usedChurchCodes = new Set();
  const union = await prisma.union.upsert({
    where: { code: "ZEUC" },
    update: { name: "Zimbabwe East Union Conference", active: true },
    create: {
      name: "Zimbabwe East Union Conference",
      code: "ZEUC"
    }
  });

  const conferences = {};
  for (const { code, name } of conferenceFiles) {
    conferences[code] = await prisma.conference.upsert({
      where: { code },
      update: {
        name,
        unionId: union.id,
        active: true
      },
      create: {
        name,
        code,
        unionId: union.id
      }
    });
  }

  const districtNames = new Map();
  for (const row of rows) {
    districtNames.set(hierarchyKey(row.sourceConferenceCode, row.districtName), {
      conferenceCode: row.sourceConferenceCode,
      districtName: row.districtName
    });
  }

  const districts = new Map();
  for (const item of [...districtNames.values()].sort((a, b) =>
    `${a.conferenceCode}-${a.districtName}`.localeCompare(`${b.conferenceCode}-${b.districtName}`)
  )) {
    const code = uniqueCode(
      `${item.conferenceCode}-${slugifyCode(item.districtName, stableHash(item.districtName))}`,
      usedDistrictCodes
    );
    const district = await prisma.district.upsert({
      where: { code },
      update: {
        name: item.districtName,
        conferenceId: conferences[item.conferenceCode].id,
        active: true
      },
      create: {
        name: item.districtName,
        code,
        conferenceId: conferences[item.conferenceCode].id
      }
    });
    districts.set(hierarchyKey(item.conferenceCode, item.districtName), district);
  }

  const churchNames = new Map();
  for (const row of rows) {
    churchNames.set(hierarchyKey(row.sourceConferenceCode, row.districtName, row.churchName), {
      conferenceCode: row.sourceConferenceCode,
      districtName: row.districtName,
      churchName: row.churchName
    });
  }

  const churches = new Map();
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
    const church = await prisma.church.upsert({
      where: { code },
      update: {
        name: item.churchName,
        districtId: district.id,
        active: true
      },
      create: {
        name: item.churchName,
        code,
        districtId: district.id
      }
    });
    churches.set(hierarchyKey(item.conferenceCode, item.districtName, item.churchName), church);
  }

  return { union, conferences, districts, churches };
}

async function createImportedUsers(input) {
  const existingUsers = await prisma.user.findMany({
    select: { id: true, email: true, isSeedUser: true }
  });
  const userByEmail = new Map(existingUsers.map((user) => [user.email.toLowerCase(), user]));
  const usedEmails = new Set();
  const stats = {
    createdUsers: 0,
    updatedUsers: 0,
    needsReview: 0,
    skippedEmailConflicts: 0,
    pastorEmailConflicts: 0
  };

  async function ensureImportedUser(data) {
    const existing = userByEmail.get(data.email);
    if (existing && !existing.isSeedUser) {
      stats.skippedEmailConflicts += 1;
      return;
    }

    if (data.dataQualityStatus === "needs_review") stats.needsReview += 1;

    const baseData = {
      name: data.name,
      phonePrimary: data.phonePrimary,
      phoneSecondary: data.phoneSecondary,
      whatsappNumber: data.whatsappNumber,
      isSeedUser: true,
      dataQualityStatus: data.dataQualityStatus,
      roleId: data.roleId,
      unionId: data.unionId,
      conferenceId: data.conferenceId,
      districtId: data.districtId,
      churchId: data.churchId
    };

    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: baseData
      });
      stats.updatedUsers += 1;
      return;
    }

    const created = await prisma.user.create({
      data: {
        ...baseData,
        email: data.email,
        passwordHash: input.passwordHash,
        whatsappEnabled: data.whatsappEnabled,
        whatsappEnabledAt: data.whatsappEnabled ? new Date() : null,
        active: true
      },
      select: { id: true, email: true, isSeedUser: true }
    });
    userByEmail.set(created.email.toLowerCase(), created);
    stats.createdUsers += 1;
  }

  for (const row of input.rows) {
    const conference = input.hierarchy.conferences[row.sourceConferenceCode];
    const district = input.hierarchy.districts.get(hierarchyKey(row.sourceConferenceCode, row.districtName));
    const church = input.hierarchy.churches.get(hierarchyKey(row.sourceConferenceCode, row.districtName, row.churchName));
    if (!district || !church) throw new Error(`Missing hierarchy for seed row ${row.sourceRowNumber}`);

    const qualityNotes = [...row.qualityNotes];
    let email = row.emailCandidate;
    if (!email || usedEmails.has(email)) {
      if (email && usedEmails.has(email)) qualityNotes.push("duplicate_email_replaced");
      email = generatedEmailForName(row.fullName);
    }
    email = reserveEmail(email, usedEmails);
    const whatsappNumber = approvedWhatsAppNumber({
      phonePrimary: row.phonePrimary,
      phoneSecondary: row.phoneSecondary
    });
    const whatsappEnabled = Boolean(whatsappNumber && isPastorRoleName(row.roleName));

    await ensureImportedUser({
      name: row.fullName,
      email,
      phonePrimary: row.phonePrimary,
      phoneSecondary: row.phoneSecondary,
      whatsappNumber,
      whatsappEnabled,
      dataQualityStatus: dataQualityStatus(qualityNotes),
      roleId: input.roles[row.roleName].id,
      unionId: input.hierarchy.union.id,
      conferenceId: conference.id,
      districtId: district.id,
      churchId: church.id
    });
  }

  const pastorRowsByDistrict = new Map();
  for (const row of input.rows.filter((item) => item.sourceConferenceCode === "NZC" && item.pastorEmail)) {
    const key = hierarchyKey(row.sourceConferenceCode, row.districtName);
    const existing = pastorRowsByDistrict.get(key);
    if (!existing) {
      pastorRowsByDistrict.set(key, row);
      continue;
    }
    if (existing.pastorEmail !== row.pastorEmail) stats.pastorEmailConflicts += 1;
  }

  for (const row of pastorRowsByDistrict.values()) {
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
    email = reserveEmail(email, usedEmails);

    await ensureImportedUser({
      name: titleFromEmail(row.pastorEmail, row.districtName),
      email,
      phonePrimary: null,
      phoneSecondary: null,
      whatsappNumber: null,
      whatsappEnabled: false,
      dataQualityStatus: dataQualityStatus(qualityNotes),
      roleId: input.roles["District Pastor"].id,
      unionId: input.hierarchy.union.id,
      conferenceId: conference.id,
      districtId: district.id,
      churchId: null
    });
  }

  return stats;
}

async function ensureBootstrapAdmin(roleMap) {
  const adminEmail = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const adminName = process.env.BOOTSTRAP_ADMIN_NAME?.trim() || "System Administrator";

  if (!adminEmail || !adminPassword) {
    const userCount = await prisma.user.count();
    if (userCount === 0) {
      throw new Error(
        "No users exist. Set BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD for the first production deploy."
      );
    }
    console.log("Bootstrap admin not configured; set BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD if needed.");
    return;
  }

  if (isPlaceholder(adminEmail) || isPlaceholder(adminPassword)) {
    throw new Error("Replace BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD before deploying.");
  }

  if (adminPassword.length < 8) {
    throw new Error("BOOTSTRAP_ADMIN_PASSWORD must be at least 8 characters.");
  }

  const existingUser = await prisma.user.findUnique({ where: { email: adminEmail } });

  if (existingUser) {
    await prisma.user.update({
      where: { email: adminEmail },
      data: {
        name: adminName,
        roleId: roleMap["Super Admin"].id,
        active: true
      }
    });
  } else {
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        roleId: roleMap["Super Admin"].id,
        active: true,
        name: adminName
      }
    });
  }

  console.log(`Bootstrap admin ready: ${adminEmail}`);
}

async function importSeedData(roleMap) {
  if ((process.env.BOOTSTRAP_IMPORT_SEED_DATA ?? "true").toLowerCase() === "false") {
    console.log("Production seed data import disabled by BOOTSTRAP_IMPORT_SEED_DATA=false.");
    return;
  }

  const seedPassword =
    process.env.SEED_USER_PASSWORD || (process.env.NODE_ENV === "production" ? "" : defaultSeedPassword);
  if (isPlaceholder(seedPassword) || seedPassword.length < 8) {
    throw new Error("SEED_USER_PASSWORD must be at least 8 characters when production seed import is enabled.");
  }

  const rawRows = readSeedRows();
  const { imported: rows, duplicates } = uniqueRows(rawRows);
  const passwordHash = await bcrypt.hash(seedPassword, 12);
  const hierarchy = await createHierarchy(rows);
  const stats = await createImportedUsers({
    rows,
    roles: roleMap,
    hierarchy,
    passwordHash
  });

  console.log(
    `Production seed import ready: ${rows.length} rows, ${duplicates} duplicates skipped, ${stats.createdUsers} users created, ${stats.updatedUsers} seed users updated, ${stats.needsReview} seed users need review.`
  );
  if (stats.skippedEmailConflicts > 0) {
    console.log(`Skipped ${stats.skippedEmailConflicts} imported users because the email belongs to a non-seed user.`);
  }
  if (stats.pastorEmailConflicts > 0) {
    console.log(`District pastor email conflicts skipped after first district email: ${stats.pastorEmailConflicts}.`);
  }
}

async function createProductionSampleRequests(requestTypeMap) {
  if ((process.env.BOOTSTRAP_CREATE_SAMPLE_REQUESTS ?? "true").toLowerCase() === "false") {
    console.log("Production sample requests disabled by BOOTSTRAP_CREATE_SAMPLE_REQUESTS=false.");
    return;
  }

  const users = await prisma.user.findMany({
    where: {
      active: true,
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
    where: { active: true },
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
    console.log("Production sample requests skipped because imported EZC/NZC church clerk data is not available.");
    return;
  }

  const nzcPeer =
    churches.find(
      (church) => church.districtId === nzcRequester.church.districtId && church.id !== nzcRequester.churchId
    ) ??
    churches.find(
      (church) => church.district.conference.code === "NZC" && church.id !== nzcRequester.churchId
    ) ??
    nzcRequester.church;

  const sampleRequests = [
    {
      number: "ZEUC-2026-00001",
      title: `Music ministry visit to ${nzcPeer.name}`,
      description: `Request for a music group from ${nzcRequester.church.name} to minister at ${nzcPeer.name}.`,
      typeName: "Music Group",
      requestingChurch: nzcRequester.church,
      targetChurch: nzcPeer,
      requester: nzcRequester,
      serviceRequired: "Music ministry",
      nameSuggested: `${nzcRequester.church.name} music group`
    },
    {
      number: "ZEUC-2026-00002",
      title: `Preaching assignment at ${nzcRequester.church.name}`,
      description: `Cross-conference request from ${ezcRequester.church.name} to ${nzcRequester.church.name}.`,
      typeName: "Preaching Assignment",
      requestingChurch: ezcRequester.church,
      targetChurch: nzcRequester.church,
      requester: ezcRequester,
      serviceRequired: "Preaching",
      nameSuggested: ezcRequester.name
    }
  ];

  let created = 0;
  for (const sample of sampleRequests) {
    const existing = await prisma.serviceRequest.findUnique({
      where: { requestNumber: sample.number },
      select: { id: true }
    });
    if (existing) continue;

    const workflow = determineApprovalPath(sample.requestingChurch, { church: sample.targetChurch });
    const firstStep = workflow[0];
    const districtPastor = await prisma.user.findFirst({
      where: {
        active: true,
        districtId: sample.requestingChurch.districtId,
        role: { name: "District Pastor" }
      },
      orderBy: { name: "asc" }
    });
    const fromWhere = `${sample.requestingChurch.name}, ${sample.requestingChurch.district.name}`;
    const whereRequired = `${sample.targetChurch.name}, ${sample.targetChurch.district.name}`;

    await prisma.serviceRequest.create({
      data: {
        requestNumber: sample.number,
        title: sample.title,
        description: sample.description,
        typeId: requestTypeMap[sample.typeName].id,
        requestingChurchId: sample.requestingChurch.id,
        targetChurchId: sample.targetChurch.id,
        proposedDate: new Date("2026-06-06"),
        requesterId: sample.requester.id,
        contactPerson: sample.requester.name,
        contactEmail: sample.requester.email,
        serviceRequired: sample.serviceRequired,
        presentationMethod: "In person",
        nameSuggested: sample.nameSuggested,
        fromWhere,
        whereRequired,
        expensesIncurredBy: sample.requestingChurch.name,
        clericalOfficeName: sample.requester.name,
        clericalOfficePhone: sample.requester.phonePrimary,
        districtPastorName: districtPastor?.name,
        districtPastorPhone:
          districtPastor?.phonePrimary ?? districtPastor?.phoneSecondary ?? districtPastor?.whatsappNumber,
        additionalNotes: "Sample request created during production bootstrap.",
        status: firstStep ? stageToStatus[firstStep.stage] : "DRAFT",
        currentStepOrder: firstStep?.stepOrder,
        approvalSteps: {
          create: workflow.map((step) => ({
            ...step,
            status: "PENDING"
          }))
        },
        comments: {
          create: {
            authorId: sample.requester.id,
            body: "Sample request created during production bootstrap.",
            system: true
          }
        },
        auditLogs: {
          create: {
            actorId: sample.requester.id,
            action: "REQUEST_CREATED",
            entityType: "ServiceRequest",
            entityId: sample.number,
            metadata: JSON.stringify({ seeded: true, source: "production_bootstrap" })
          }
        }
      }
    });
    created += 1;
  }

  console.log(`Production sample requests ready: ${created} created, ${sampleRequests.length - created} already existed.`);
}

async function main() {
  const roleMap = await createRoles();
  const requestTypeMap = await createServiceRequestTypes();
  await ensureBootstrapAdmin(roleMap);
  await importSeedData(roleMap);
  await createProductionSampleRequests(requestTypeMap);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
