import { NextResponse } from "next/server";
import { handleWhatsAppCommand } from "@/lib/whatsapp-commands";
import { twimlMessage } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

function unauthorized() {
  return new NextResponse(twimlMessage("WhatsApp webhook is not authorized."), {
    status: 403,
    headers: { "Content-Type": "text/xml; charset=utf-8" }
  });
}

export async function POST(request: Request) {
  const webhookToken = process.env.WHATSAPP_WEBHOOK_TOKEN;
  if (webhookToken) {
    const url = new URL(request.url);
    if (url.searchParams.get("token") !== webhookToken) return unauthorized();
  }

  const formData = await request.formData();
  const reply = await handleWhatsAppCommand({
    from: String(formData.get("From") ?? ""),
    to: String(formData.get("To") ?? ""),
    body: String(formData.get("Body") ?? ""),
    providerMessageId: String(formData.get("MessageSid") ?? "")
  });

  return new NextResponse(twimlMessage(reply), {
    headers: { "Content-Type": "text/xml; charset=utf-8" }
  });
}
