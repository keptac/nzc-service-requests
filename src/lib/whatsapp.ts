import { prisma } from "./prisma";
import { normalizeWhatsAppNumber } from "./phone";

function twilioConfig() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = normalizeWhatsAppNumber(process.env.TWILIO_WHATSAPP_FROM);

  if (!accountSid || !authToken || !from) return null;
  return {
    accountSid,
    authToken,
    from
  };
}

function whatsappAddress(number: string) {
  return `whatsapp:${number}`;
}

export function whatsappIsConfigured() {
  return Boolean(twilioConfig());
}

export async function sendWhatsAppText(input: {
  to: string;
  body: string;
  userId?: string | null;
  requestId?: string | null;
}) {
  const config = twilioConfig();
  const to = normalizeWhatsAppNumber(input.to);
  if (!config || !to) return { sent: false, skipped: true };

  const form = new URLSearchParams({
    From: whatsappAddress(config.from),
    To: whatsappAddress(to),
    Body: input.body
  });

  let status = "SENT";
  let providerMessageId: string | undefined;
  let error: string | undefined;

  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: form
      }
    );
    const payload = (await response.json().catch(() => null)) as { sid?: string; message?: string } | null;
    providerMessageId = payload?.sid;
    if (!response.ok) {
      status = "FAILED";
      error = payload?.message ?? `Twilio returned ${response.status}`;
    }
  } catch (sendError) {
    status = "FAILED";
    error = sendError instanceof Error ? sendError.message : "Could not send WhatsApp message.";
  }

  await prisma.whatsAppMessage.create({
    data: {
      userId: input.userId,
      requestId: input.requestId,
      direction: "OUTBOUND",
      fromNumber: config.from,
      toNumber: to,
      body: input.body,
      status,
      providerMessageId,
      error
    }
  });

  return { sent: status === "SENT", skipped: false, error };
}

export async function sendWhatsAppNotifications(input: {
  userIds: string[];
  requestId?: string;
  title: string;
  body: string;
}) {
  if (!whatsappIsConfigured()) return;

  const users = await prisma.user.findMany({
    where: {
      id: { in: Array.from(new Set(input.userIds)) },
      active: true,
      whatsappEnabled: true,
      whatsappNumber: { not: null }
    },
    select: {
      id: true,
      whatsappNumber: true
    }
  });

  if (users.length === 0) return;

  const request = input.requestId
    ? await prisma.serviceRequest.findUnique({
        where: { id: input.requestId },
        select: { requestNumber: true }
      })
    : null;
  const link =
    input.requestId && process.env.APP_URL
      ? `\nOpen: ${process.env.APP_URL.replace(/\/$/, "")}/requests/${input.requestId}`
      : "";
  const requestLine = request ? `\nRequest: ${request.requestNumber}` : "";
  const body = `${input.title}\n${input.body}${requestLine}${link}\n\nReply HELP for WhatsApp commands.`;

  await Promise.allSettled(
    users.map((user) =>
      user.whatsappNumber
        ? sendWhatsAppText({
            to: user.whatsappNumber,
            body,
            userId: user.id,
            requestId: input.requestId
          })
        : Promise.resolve()
    )
  );
}

export function twimlMessage(body: string) {
  const escaped = body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escaped}</Message></Response>`;
}
