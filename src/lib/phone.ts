export function cleanPhoneText(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[\uFEFF\u200B-\u200D\u2060]/g, "")
    .replace(/^whatsapp:/i, "")
    .replace(/\s+/g, "")
    .trim();
}

export function normalizeWhatsAppNumber(value: string | null | undefined) {
  const raw = cleanPhoneText(value);
  if (!raw) return null;

  let digits = raw.replace(/[^\d]/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("2630")) digits = `263${digits.slice(4)}`;
  if (digits.startsWith("0")) digits = `263${digits.slice(1)}`;
  if (!digits.startsWith("263") && digits.length === 9) digits = `263${digits}`;

  return digits ? `+${digits}` : null;
}

export function isPastorRoleName(roleName: string | null | undefined) {
  return /\bpastor\b/i.test(roleName ?? "");
}

export function approvedWhatsAppNumber(input: {
  whatsappNumber?: string | null;
  phonePrimary?: string | null;
  phoneSecondary?: string | null;
}) {
  return (
    normalizeWhatsAppNumber(input.whatsappNumber) ??
    normalizeWhatsAppNumber(input.phonePrimary) ??
    normalizeWhatsAppNumber(input.phoneSecondary)
  );
}
