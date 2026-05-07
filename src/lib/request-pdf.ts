import { format } from "date-fns";
import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit/js/pdfkit.standalone.js";
import type { RequestWithRelations } from "./requests";

type ServiceRequestPdfInput = NonNullable<RequestWithRelations>;

type PdfFonts = {
  regular: string;
  semibold: string;
};

const colors = {
  forest: "#355724",
  ming: "#007f98",
  conferenceBlue: "#006f89",
  ink: "#17212b",
  muted: "#667789",
  line: "#c5d2dc",
  subtle: "#f6f8f7"
};

const fallbackPdfFonts: PdfFonts = {
  regular: "Helvetica",
  semibold: "Helvetica-Bold"
};

function valueOrBlank(value: string | null | undefined) {
  return value?.trim() || "";
}

function readAssetBytes(...segments: string[]) {
  const buffer = fs.readFileSync(path.join(process.cwd(), ...segments));
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

function registerPdfFonts(document: PDFKit.PDFDocument): PdfFonts {
  try {
    document.registerFont("Poppins", readAssetBytes("src/fonts/Poppins-Regular.ttf") as unknown as Buffer);
    document.registerFont("Poppins-SemiBold", readAssetBytes("src/fonts/Poppins-SemiBold.ttf") as unknown as Buffer);
    return {
      regular: "Poppins",
      semibold: "Poppins-SemiBold"
    };
  } catch {
    return fallbackPdfFonts;
  }
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

function drawLogoFallback(
  document: PDFKit.PDFDocument,
  fonts: PdfFonts,
  x: number,
  y: number,
  size: number,
  color: string,
  strokeColor: string = color
) {
  document
    .circle(x + size / 2, y + size / 2, size / 2 - 1)
    .lineWidth(1)
    .strokeColor(strokeColor)
    .stroke()
    .font(fonts.semibold)
    .fontSize(size * 0.22)
    .fillColor(color)
    .text("SDA", x, y + size * 0.38, { width: size, align: "center" });
}

function drawLogo(
  document: PDFKit.PDFDocument,
  fonts: PdfFonts,
  filename: string,
  x: number,
  y: number,
  size: number,
  fallbackColor: string,
  fallbackStrokeColor?: string
) {
  try {
    const imageBytes = readAssetBytes("src/images", filename);
    document.image(imageBytes as unknown as Buffer, x, y, { fit: [size, size] });
  } catch {
    drawLogoFallback(document, fonts, x, y, size, fallbackColor, fallbackStrokeColor);
  }
}

function drawLetterhead(document: PDFKit.PDFDocument, fonts: PdfFonts) {
  const pageWidth = document.page.width;
  const pageHeight = document.page.height;
  const bandWidth = 88;
  const bandX = pageWidth - bandWidth;
  const sideLogoSize = 58;
  const headerLogoSize = 44;
  const headerTextX = 112;

  document.rect(0, 0, pageWidth, pageHeight).fill("#ffffff");
  document.rect(bandX, 0, bandWidth, pageHeight).fill(colors.conferenceBlue);
  document.rect(bandX - 7, 0, 7, pageHeight).fill("#e8f3f5");

  drawLogo(document, fonts, "adventist-symbol-circle--white.png", bandX + 15, 28, sideLogoSize, "#ffffff");
  drawLogo(document, fonts, "adventist-symbol-circle--forest.png", 54, 34, headerLogoSize, colors.forest);

  document
    .fillColor(colors.ming)
    .font(fonts.semibold)
    .fontSize(8)
    .text("North Zimbabwe Conference Of the", headerTextX, 36, { width: 250 })
    .text("Seventh-day Adventists", headerTextX, 46, { width: 250 });

  document
    .font(fonts.regular)
    .fontSize(7.5)
    .text("468 Sandton Park, Mount Hampden, Harare", headerTextX, 59, { width: 270 })
    .text("Tel: (263) 8677 0049 22/23", headerTextX, 70, { width: 240 })
    .text("Email: secretariat@nzc.adventist.org", headerTextX, 81, { width: 260 });

  document
    .font(fonts.semibold)
    .fontSize(8)
    .fillColor(colors.ming)
    .text("SECRETARIAT", headerTextX, 108, { width: 160 });
}

function drawMetaLine(document: PDFKit.PDFDocument, fonts: PdfFonts, label: string, value: string) {
  const y = document.y;
  document
    .fillColor(colors.ink)
    .font(fonts.semibold)
    .fontSize(10)
    .text(label, 68, y, { width: 72 });
  document.font(fonts.regular).text(value, 142, y, { width: 315 });
  document.moveDown(0.55);
}

function drawDetailRow(document: PDFKit.PDFDocument, fonts: PdfFonts, label: string, value: string) {
  const y = document.y;
  document
    .fillColor(colors.ink)
    .font(fonts.semibold)
    .fontSize(10)
    .text(label, 92, y, { width: 135 });
  document.font(fonts.regular).text(":", 228, y, { width: 10 });
  document.font(fonts.regular).text(value || "", 244, y, { width: 236 });
  document.moveDown(0.68);
}

function drawSignatory(
  document: PDFKit.PDFDocument,
  fonts: PdfFonts,
  x: number,
  y: number,
  width: number,
  input: { name: string; role: string; phone: string }
) {
  document
    .font(fonts.regular)
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
    .font(fonts.regular)
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
  const fonts = registerPdfFonts(document);

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

  drawLetterhead(document, fonts);

  document.y = 152;
  document
    .fillColor(colors.ink)
    .font(fonts.regular)
    .fontSize(10.5)
    .text(formatLetterDate(request.createdAt), 68);

  document.moveDown(1.5);
  drawMetaLine(document, fonts, "TO:", targetClerk.toUpperCase());
  drawMetaLine(document, fonts, "FROM:", request.requestingChurch.name.toUpperCase());
  drawMetaLine(document, fonts, "RE:", `SERVICE REQUEST FOR ${requestFor.toUpperCase()}`);
  drawMetaLine(document, fonts, "EMAIL:", email);

  document.moveDown(1.6);
  document.font(fonts.regular).fontSize(10.5).fillColor(colors.ink).text("Dear Church Clerk,", 68);
  document.moveDown(1.2);
  document.text(`We are kindly requesting for the services of ${requestFor} as detailed below:`, 68, document.y, {
    width: 410
  });

  document.moveDown(1.4);
  drawDetailRow(document, fonts, "Service Required", serviceRequired);
  drawDetailRow(document, fonts, "Event Description", request.description);
  drawDetailRow(document, fonts, "Presentation Method", presentationMethod);
  drawDetailRow(document, fonts, "Name Suggested", valueOrBlank(request.nameSuggested) || request.contactPerson);
  drawDetailRow(document, fonts, "From Where", fromWhere);
  drawDetailRow(document, fonts, "Where Required", whereRequired);
  drawDetailRow(document, fonts, "Date Required", formatDateRequired(request.proposedDate, request.requiredToDate));
  drawDetailRow(document, fonts, "Board Action Number", boardActionNumber);
  drawDetailRow(document, fonts, "Expenses Incurred By", expenses);

  document.moveDown(1.3);
  document.font(fonts.regular).fontSize(10.5).fillColor(colors.ink).text("Kind regards,", 68);

  const clericalName =
    valueOrBlank(request.clericalOfficeName) || valueOrBlank(request.requester.name) || request.contactPerson;
  const clericalPhone =
    valueOrBlank(request.clericalOfficePhone) ||
    valueOrBlank(request.requester.phonePrimary) ||
    valueOrBlank(request.requester.phoneSecondary) ||
    valueOrBlank(request.requester.whatsappNumber);
  const signatureY = Math.max(document.y + 68, 680);
  drawSignatory(document, fonts, 62, signatureY, 128, {
    name: clericalName,
    role: "Clerical Office",
    phone: clericalPhone
  });
  drawSignatory(document, fonts, 215, signatureY, 128, {
    name: valueOrBlank(request.firstElderName),
    role: "First Elder",
    phone: valueOrBlank(request.firstElderPhone)
  });
  drawSignatory(document, fonts, 368, signatureY, 128, {
    name: valueOrBlank(request.districtPastorName),
    role: "District Pastor",
    phone: valueOrBlank(request.districtPastorPhone)
  });

  document.end();
  return completion;
}
