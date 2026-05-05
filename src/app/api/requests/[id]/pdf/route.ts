import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { canViewRequest } from "@/lib/permissions";
import { accessContext, getRequestById } from "@/lib/requests";
import { renderServiceRequestPdf, serviceRequestPdfFilename } from "@/lib/request-pdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  const serviceRequest = await getRequestById(params.id);

  if (!serviceRequest) {
    return NextResponse.json({ error: "Request not found." }, { status: 404 });
  }

  if (!canViewRequest(user, accessContext(serviceRequest))) {
    return NextResponse.json({ error: "You cannot access this request." }, { status: 403 });
  }

  const pdf = await renderServiceRequestPdf(serviceRequest);

  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${serviceRequestPdfFilename(serviceRequest)}"`,
      "Cache-Control": "private, no-store"
    }
  });
}
