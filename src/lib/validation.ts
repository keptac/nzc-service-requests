import { z } from "zod";
import {
  ALLOWED_UPLOAD_TYPES,
  MAX_UPLOAD_BYTES,
  PRIORITIES,
  REQUEST_STATUSES,
  ROLE_NAMES
} from "./constants";

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
  priority: z.enum(PRIORITIES),
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
  users: z.object({
    name: z.string().min(2).max(120),
    email: z.string().email(),
    password: z.string().min(8),
    roleName: z.enum(ROLE_NAMES),
    phonePrimary: z.string().max(60).optional().nullable(),
    phoneSecondary: z.string().max(60).optional().nullable(),
    whatsappNumber: z.string().max(60).optional().nullable(),
    whatsappEnabled: booleanInput.optional(),
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
  users: createEntitySchemas.users
    .omit({ password: true })
    .partial()
    .extend({ active: z.boolean().optional(), password: z.string().min(8).optional() })
};

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
