import { format } from "date-fns";
import path from "node:path";
import PDFDocument from "pdfkit/js/pdfkit.standalone.js";
import type { RequestWithRelations } from "./requests";

type ServiceRequestPdfInput = NonNullable<RequestWithRelations>;

const colors = {
  forest: "#355724",
  ming: "#007f98",
  conferenceBlue: "#006f89",
  ink: "#17212b",
  muted: "#667789",
  line: "#c5d2dc",
  subtle: "#f6f8f7"
};

function valueOrBlank(value: string | null | undefined) {
  return value?.trim() || "";
}

function formatLetterDate(value: Date | null | undefined) {
  return format(value ? new Date(value) : new Date(), "dd MMMM yyyy");
}

function formatDateRequired(from: Date | null | undefined, to: Date | null | undefined) {
  if (!from && !to) return "";
  if (!to || (from && new Date(from).getTime() === new Date(to).getTime())) {
    return format(new Date((from ?? to) as Date), "dd MMMM yyyy");
  }
  if (!from) return format(new Date(to), "dd MMMM yyyy");

  const fromDate = new Date(from);
  const toDate = new Date(to);
  if (format(fromDate, "MMMM yyyy") === format(toDate, "MMMM yyyy")) {
    return `${format(fromDate, "dd")} - ${format(toDate, "dd MMMM yyyy")}`;
  }

  return `${format(fromDate, "dd MMMM yyyy")} - ${format(toDate, "dd MMMM yyyy")}`;
}

function churchLocation(request: ServiceRequestPdfInput, kind: "requesting" | "target") {
  const church = kind === "requesting" ? request.requestingChurch : request.targetChurch;
  if (!church) return "";
  return `${church.name}, ${church.district.name}`;
}

function collectPdf(document: PDFKit.PDFDocument) {
  const chunks: Buffer[] = [];

  return new Promise<Buffer>((resolve, reject) => {
    document.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);
  });
}

function drawLetterhead(document: PDFKit.PDFDocument) {
  const pageWidth = document.page.width;
  const pageHeight = document.page.height;
  const bandWidth = 88;
  const bandX = pageWidth - bandWidth;
  const logoSize = 58;
  const logoPath = path.join(process.cwd(), "src/images/adventist-symbol-circle--white.png");

  document.rect(0, 0, pageWidth, pageHeight).fill("#ffffff");
  document.rect(bandX, 0, bandWidth, pageHeight).fill(colors.conferenceBlue);
  document.rect(bandX - 7, 0, 7, pageHeight).fill("#e8f3f5");

  try {
    document.image(logoPath, bandX + 15, 28, { fit: [logoSize, logoSize] });
  } catch {
    document
      .circle(bandX + 44, 56, 28)
      .lineWidth(1)
      .strokeColor("#ffffff")
      .stroke()
      .font("Helvetica-Bold")
      .fontSize(13)
      .fillColor("#ffffff")
      .text("SDA", bandX + 20, 50, { width: 48, align: "center" });
  }

  document
    .fillColor(colors.ming)
    .font("Helvetica-Bold")
    .fontSize(8)
    .text("North Zimbabwe Conference Of the", 54, 36, { width: 210 })
    .text("Seventh-day Adventists", 54, 46, { width: 210 });

  document
    .font("Helvetica")
    .fontSize(7.5)
    .text("468 Sandton Park, Mount Hampden, Harare", 54, 59, { width: 250 })
    .text("Tel: (263) 8677 0049 22/23", 54, 70, { width: 210 })
    .text("Email: secretariat@nzc.adventist.org", 54, 81, { width: 220 });

  document
    .font("Helvetica-Bold")
    .fontSize(8)
    .fillColor(colors.ming)
    .text("SECRETARIAT", 54, 108, { width: 160 });
}

function drawMetaLine(document: PDFKit.PDFDocument, label: string, value: string) {
  const y = document.y;
  document
    .fillColor(colors.ink)
    .font("Helvetica-Bold")
    .fontSize(10)
    .text(label, 68, y, { width: 72 });
  document.font("Helvetica").text(value, 142, y, { width: 315 });
  document.moveDown(0.55);
}

function drawDetailRow(document: PDFKit.PDFDocument, label: string, value: string) {
  const y = document.y;
  document
    .fillColor(colors.ink)
    .font("Helvetica-Bold")
    .fontSize(10)
    .text(label, 92, y, { width: 135 });
  document.font("Helvetica").text(":", 228, y, { width: 10 });
  document.font("Helvetica").text(value || "", 244, y, { width: 236 });
  document.moveDown(0.68);
}

function drawSignatory(
  document: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  input: { name: string; role: string; phone: string }
) {
  document
    .font("Helvetica")
    .fontSize(9)
    .fillColor(colors.ink)
    .text(input.name, x, y - 18, { width, align: "center", lineBreak: false });
  document
    .moveTo(x + 6, y)
    .lineTo(x + width - 6, y)
    .strokeColor(colors.ink)
    .lineWidth(0.7)
    .stroke();
  document
    .font("Helvetica")
    .fontSize(9)
    .fillColor(colors.ink)
    .text(input.role, x, y + 8, { width, align: "center", lineBreak: false });
  document
    .fontSize(8.5)
    .fillColor(colors.muted)
    .text(input.phone, x, y + 24, { width, align: "center", lineBreak: false });
}

export function serviceRequestPdfFilename(request: ServiceRequestPdfInput) {
  return `${request.requestNumber.replace(/[^a-z0-9-]/gi, "_")}.pdf`;
}

export async function renderServiceRequestPdf(request: ServiceRequestPdfInput) {
  const document = new PDFDocument({
    size: "A4",
    margins: { top: 44, right: 54, bottom: 46, left: 54 },
    info: {
      Title: `${request.requestNumber} service request`,
      Author: "SDA Service Request Tracker"
    }
  });
  const completion = collectPdf(document);

  const targetClerk = request.targetChurch ? `${request.targetChurch.name} Clerk` : "Church Clerk";
  const requestFor = valueOrBlank(request.nameSuggested) || request.title;
  const email = valueOrBlank(request.contactEmail) || request.requester.email;
  const fromWhere = valueOrBlank(request.fromWhere) || churchLocation(request, "target");
  const whereRequired = valueOrBlank(request.whereRequired) || churchLocation(request, "requesting");
  const expenses = valueOrBlank(request.expensesIncurredBy) || request.requestingChurch.name;
  const serviceRequired = valueOrBlank(request.serviceRequired) || request.type.name;
  const presentationMethod = valueOrBlank(request.presentationMethod) || "In person";
  const destinationMinuteNumber = request.approvalSteps.find(
    (step) => step.stage === "DESTINATION" && step.minuteNumber
  )?.minuteNumber;
  const boardActionNumber = valueOrBlank(destinationMinuteNumber) || valueOrBlank(request.boardActionNumber);

  drawLetterhead(document);

  document.y = 152;
  document
    .fillColor(colors.ink)
    .font("Helvetica")
    .fontSize(10.5)
    .text(formatLetterDate(request.createdAt), 68);

  document.moveDown(1.5);
  drawMetaLine(document, "TO:", targetClerk.toUpperCase());
  drawMetaLine(document, "FROM:", request.requestingChurch.name.toUpperCase());
  drawMetaLine(document, "RE:", `SERVICE REQUEST FOR ${requestFor.toUpperCase()}`);
  drawMetaLine(document, "EMAIL:", email);

  document.moveDown(1.6);
  document.font("Helvetica").fontSize(10.5).fillColor(colors.ink).text("Dear Church Clerk,", 68);
  document.moveDown(1.2);
  document.text(`We are kindly requesting for the services of ${requestFor} as detailed below:`, 68, document.y, {
    width: 410
  });

  document.moveDown(1.4);
  drawDetailRow(document, "Service Required", serviceRequired);
  drawDetailRow(document, "Event Description", request.description);
  drawDetailRow(document, "Presentation Method", presentationMethod);
  drawDetailRow(document, "Name Suggested", valueOrBlank(request.nameSuggested) || request.contactPerson);
  drawDetailRow(document, "From Where", fromWhere);
  drawDetailRow(document, "Where Required", whereRequired);
  drawDetailRow(document, "Date Required", formatDateRequired(request.proposedDate, request.requiredToDate));
  drawDetailRow(document, "Board Action Number", boardActionNumber);
  drawDetailRow(document, "Expenses Incurred By", expenses);

  document.moveDown(1.3);
  document.font("Helvetica").fontSize(10.5).fillColor(colors.ink).text("Kind regards,", 68);

  const clericalName =
    valueOrBlank(request.clericalOfficeName) || valueOrBlank(request.requester.name) || request.contactPerson;
  const clericalPhone =
    valueOrBlank(request.clericalOfficePhone) ||
    valueOrBlank(request.requester.phonePrimary) ||
    valueOrBlank(request.requester.phoneSecondary) ||
    valueOrBlank(request.requester.whatsappNumber);
  const signatureY = Math.max(document.y + 68, 680);
  drawSignatory(document, 62, signatureY, 128, {
    name: clericalName,
    role: "Clerical Office",
    phone: clericalPhone
  });
  drawSignatory(document, 215, signatureY, 128, {
    name: valueOrBlank(request.firstElderName),
    role: "First Elder",
    phone: valueOrBlank(request.firstElderPhone)
  });
  drawSignatory(document, 368, signatureY, 128, {
    name: valueOrBlank(request.districtPastorName),
    role: "District Pastor",
    phone: valueOrBlank(request.districtPastorPhone)
  });

  document.end();
  return completion;
}
