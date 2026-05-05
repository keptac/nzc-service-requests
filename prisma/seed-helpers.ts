import crypto from "node:crypto";

export type ImportConferenceCode = "EZC" | "NZC";
export type ImportRoleName = "Church Clerk" | "Assistant Church Clerk" | "District Coordinator";
export type DataQualityStatus = "clean" | "needs_review";

export type NormalizedImportRow = {
  sourceConferenceCode: ImportConferenceCode;
  sourceRowNumber: number;
  districtName: string;
  churchName: string;
  fullName: string;
  position: string;
  roleName: ImportRoleName;
  phonePrimary: string | null;
  phoneSecondary: string | null;
  emailCandidate: string | null;
  churchEmail: string | null;
  pastorEmail: string | null;
  qualityNotes: string[];
};

type CsvRow = Record<string, string>;

const DEFAULT_DISTRICT = "Needs Review District";
const DEFAULT_CHURCH = "Needs Review Church";
const DEFAULT_NAME = "Unknown Seed User";

export function cleanText(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[\uFEFF\u200B-\u200D\u2060]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseCsv(content: string): CsvRow[] {
  const rows: string[][] = [];
  let row: string[] = [];
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
    const parsed: CsvRow = {};
    headers.forEach((header, index) => {
      parsed[header] = cleanText(cells[index]);
    });
    return parsed;
  });
}

export function normalizeDistrictName(value: string | null | undefined) {
  return cleanText(value) || DEFAULT_DISTRICT;
}

export function normalizeChurchName(value: string | null | undefined) {
  return (
    cleanText(value)
      .replace(/_/g, " ")
      .replace(/\bS\.?\s*D\.?\s*A\.?\b\.?/gi, "SDA")
      .replace(/\bSDA\s+Church\b/gi, "SDA Church")
      .replace(/\bSDA$/i, "SDA Church")
      .replace(/\s+Church\s+Church$/i, " Church")
      .replace(/\s+/g, " ")
      .trim() || DEFAULT_CHURCH
  );
}

export function normalizeZimbabwePhone(value: string | null | undefined) {
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

export function normalizeEmail(value: string | null | undefined) {
  const raw = cleanText(value);
  if (!raw) return { value: null, needsReview: false };

  let email = raw
    .replace(/\s+/g, "")
    .replace(/,+$/g, "")
    .replace(/^mailto:/i, "")
    .toLowerCase();

  email = email.replace(/@(gmail|yahoo|hotmail|outlook|icloud|aol)com$/i, "@$1.com");
  email = email.replace(/@(gmail|yahoo|hotmail|outlook|icloud|aol)co\.zw$/i, "@$1.co.zw");

  return {
    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null,
    needsReview: !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  };
}

export function roleForPosition(position: string) {
  const normalized = cleanText(position).toLowerCase();
  if (normalized.includes("district coordinator") || normalized.includes("vice coordinator")) {
    return { roleName: "District Coordinator" as const, needsReview: false };
  }
  if (normalized.includes("assistant") || normalized.includes("associate")) {
    return { roleName: "Assistant Church Clerk" as const, needsReview: false };
  }
  if (normalized.includes("secretary/clerk") || normalized.includes("clerk") || normalized.includes("secretary")) {
    return { roleName: "Church Clerk" as const, needsReview: false };
  }
  return { roleName: "Church Clerk" as const, needsReview: true };
}

export function generatedEmailForName(fullName: string, domain = "seed.zeuc.local") {
  const words = cleanText(fullName)
    .toLowerCase()
    .replace(/[^a-z0-9\s.-]/g, "")
    .split(/[\s.]+/)
    .filter(Boolean);
  const first = words[0] ?? "seed";
  const last = words.length > 1 ? words[words.length - 1] : "user";
  return `${first}.${last}@${domain}`;
}

export function makeUniqueEmail(candidate: string, usedEmails: Set<string>) {
  const [localPart, domain] = candidate.toLowerCase().split("@");
  let email = `${localPart}@${domain}`;
  let suffix = 2;
  while (usedEmails.has(email)) {
    email = `${localPart}${suffix}@${domain}`;
    suffix += 1;
  }
  usedEmails.add(email);
  return email;
}

export function dataQualityStatus(notes: string[]): DataQualityStatus {
  return notes.length > 0 ? "needs_review" : "clean";
}

export function duplicateKeyForRow(row: NormalizedImportRow) {
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

export function stableHash(value: string) {
  return crypto.createHash("sha1").update(value).digest("hex").slice(0, 10);
}

export function slugifyCode(value: string, fallback: string) {
  const slug = cleanText(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toUpperCase();
  return slug || fallback;
}

export function normalizeImportRows(content: string, sourceConferenceCode: ImportConferenceCode) {
  return parseCsv(content).map((row, index) => normalizeImportRow(row, sourceConferenceCode, index + 2));
}

function normalizeImportRow(
  row: CsvRow,
  sourceConferenceCode: ImportConferenceCode,
  sourceRowNumber: number
): NormalizedImportRow {
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
  const qualityNotes: string[] = [];

  const districtName = normalizeDistrictName(rawDistrict);
  const churchName = normalizeChurchName(rawChurch);
  const fullName = cleanText(rawName) || DEFAULT_NAME;
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
