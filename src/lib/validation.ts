import { z } from "zod";
import {
  ALLOWED_UPLOAD_TYPES,
  MAX_UPLOAD_BYTES,
  REQUEST_STATUSES,
  ROLE_NAMES
} from "./constants";
import { LANGUAGE_CODES } from "./languages";

const booleanInput = z.union([z.boolean(), z.enum(["true", "false"])]).transform((value) => value === true || value === "true");

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

export const createRequestSchema = z.object({
  typeId: z.string().min(1),
  title: z.string().min(4).max(160),
  description: z.string().min(10).max(5000),
  requestingChurchId: z.string().min(1),
  targetChurchId: z.string().optional().nullable(),
  targetDistrictId: z.string().optional().nullable(),
  targetConferenceId: z.string().optional().nullable(),
  targetUnionId: z.string().optional().nullable(),
  proposedDate: z.string().optional().nullable(),
  requiredToDate: z.string().optional().nullable(),
  contactPerson: z.string().min(2).max(120),
  contactEmail: z.string().email().max(160).optional().nullable(),
  serviceRequired: z.string().max(120).optional().nullable(),
  presentationMethod: z.string().max(80).optional().nullable(),
  nameSuggested: z.string().max(160).optional().nullable(),
  fromWhere: z.string().max(220).optional().nullable(),
  whereRequired: z.string().max(220).optional().nullable(),
  boardActionNumber: z.string().max(80).optional().nullable(),
  expensesIncurredBy: z.string().max(160).optional().nullable(),
  clericalOfficeName: z.string().max(120).optional().nullable(),
  clericalOfficePhone: z.string().max(60).optional().nullable(),
  firstElderName: z.string().max(120).optional().nullable(),
  firstElderPhone: z.string().max(60).optional().nullable(),
  districtPastorName: z.string().max(120).optional().nullable(),
  districtPastorPhone: z.string().max(60).optional().nullable(),
  additionalNotes: z.string().max(3000).optional().nullable(),
  saveAsDraft: z.boolean().default(false)
});

export const actionSchema = z.object({
  action: z.enum(["APPROVE", "DECLINE", "RETURN", "CANCEL", "RESUBMIT", "ESCALATE"]),
  comment: z.string().max(3000).optional(),
  minuteNumber: z.string().max(80).optional(),
  escalateTo: z.enum(["CONFERENCE", "UNION"]).optional()
});

export const commentSchema = z.object({
  body: z.string().min(1).max(3000)
});

export const notificationSchema = z.object({
  notificationId: z.string().min(1)
});

export const languagePreferenceSchema = z.object({
  preferredLanguage: z.enum(LANGUAGE_CODES)
});

export const createEntitySchemas = {
  unions: z.object({
    name: z.string().min(2).max(120),
    code: z.string().min(2).max(20)
  }),
  conferences: z.object({
    name: z.string().min(2).max(120),
    code: z.string().min(2).max(20),
    unionId: z.string().min(1)
  }),
  districts: z.object({
    name: z.string().min(2).max(120),
    code: z.string().min(2).max(20),
    conferenceId: z.string().min(1)
  }),
  churches: z.object({
    name: z.string().min(2).max(120),
    code: z.string().min(2).max(20),
    districtId: z.string().min(1)
  }),
  requestTypes: z.object({
    name: z.string().min(2).max(80)
  }),
  leaveTypes: z.object({
    name: z.string().min(2).max(80),
    code: z.string().min(2).max(30).regex(/^[A-Z0-9_]+$/, "Use uppercase letters, numbers, and underscores."),
    defaultAnnualDays: z.coerce.number().int().min(0).max(366),
    paid: booleanInput.optional(),
    requiresApproval: booleanInput.optional(),
    description: z.string().max(300).optional().nullable()
  }),
  employees: z.object({
    employeeNumber: z.string().min(1).max(40),
    firstName: z.string().min(1).max(80),
    lastName: z.string().min(1).max(80),
    email: z.string().email().max(160).optional().nullable(),
    phone: z.string().max(60).optional().nullable(),
    jobTitle: z.string().max(120).optional().nullable(),
    department: z.string().max(120).optional().nullable(),
    employmentType: z.string().max(30).optional(),
    hireDate: z.string().optional().nullable(),
    status: z.string().max(30).optional(),
    unionId: z.string().optional().nullable(),
    conferenceId: z.string().optional().nullable(),
    districtId: z.string().optional().nullable(),
    churchId: z.string().optional().nullable(),
    userId: z.string().optional().nullable(),
    supervisorId: z.string().optional().nullable()
  }),
  users: z.object({
    name: z.string().min(2).max(120),
    email: z.string().email(),
    password: z.string().min(8),
    roleName: z.enum(ROLE_NAMES),
    phonePrimary: z.string().max(60).optional().nullable(),
    phoneSecondary: z.string().max(60).optional().nullable(),
    whatsappNumber: z.string().max(60).optional().nullable(),
    whatsappEnabled: booleanInput.optional(),
    preferredLanguage: languagePreferenceSchema.shape.preferredLanguage.optional(),
    unionId: z.string().optional().nullable(),
    conferenceId: z.string().optional().nullable(),
    districtId: z.string().optional().nullable(),
    churchId: z.string().optional().nullable()
  })
};

export const updateEntitySchemas = {
  unions: createEntitySchemas.unions.partial().extend({ active: z.boolean().optional() }),
  conferences: createEntitySchemas.conferences.partial().extend({ active: z.boolean().optional() }),
  districts: createEntitySchemas.districts.partial().extend({ active: z.boolean().optional() }),
  churches: createEntitySchemas.churches.partial().extend({ active: z.boolean().optional() }),
  requestTypes: createEntitySchemas.requestTypes.partial().extend({ active: z.boolean().optional() }),
  leaveTypes: createEntitySchemas.leaveTypes.partial().extend({ active: z.boolean().optional() }),
  employees: createEntitySchemas.employees.partial(),
  users: createEntitySchemas.users
    .omit({ password: true })
    .partial()
    .extend({ active: z.boolean().optional(), password: z.string().min(8).optional() })
};

export const createLeaveApplicationSchema = z.object({
  employeeId: z.string().min(1).optional(),
  leaveTypeId: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  reason: z.string().min(3).max(2000),
  contactWhileAway: z.string().max(200).optional().nullable()
});

export const leaveActionSchema = z.object({
  action: z.enum(["APPROVE", "DECLINE", "RETURN", "CANCEL"]),
  comment: z.string().max(2000).optional(),
  minuteNumber: z.string().max(80).optional()
});

export const leaveBalanceSchema = z.object({
  employeeId: z.string().min(1),
  leaveTypeId: z.string().min(1),
  year: z.coerce.number().int().min(2000).max(2100),
  entitledDays: z.coerce.number().min(0).max(366),
  carriedOverDays: z.coerce.number().min(0).max(366).optional()
});

export function validateUpload(file: File) {
  if (file.size > MAX_UPLOAD_BYTES) {
    return `The file ${file.name} is larger than 10 MB.`;
  }
  if (!ALLOWED_UPLOAD_TYPES.includes(file.type)) {
    return `The file ${file.name} is not an allowed document or image type.`;
  }
  return null;
}

export function validStatus(status: string) {
  return REQUEST_STATUSES.includes(status as (typeof REQUEST_STATUSES)[number]);
}
