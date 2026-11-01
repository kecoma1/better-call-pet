import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import { money, type Invoice } from "../domain.js";

/** Shared deterministic layout for server PDFs and the explicitly labelled browser demo. */
export async function generateInvoicePdf(
  invoice: Invoice,
  demo = false,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  doc.setTitle(`Draft invoice ${invoice.number}`);
  doc.setAuthor(invoice.seller.name);
  const ink = rgb(0.12, 0.14, 0.16),
    muted = rgb(0.4, 0.43, 0.46);
  let page!: PDFPage;
  let y = 0;
  const addPage = () => {
    page = doc.addPage([595.28, 841.89]);
    y = 790;
    page.drawText(
      "BETTER CALL PET  /  " + (demo ? "DEMO DRAFT" : "DRAFT INVOICE"),
      { x: 44, y, size: 9, font: bold, color: muted },
    );
    y -= 32;
  };
  const ensure = (height: number) => {
    if (y - height < 65) addPage();
  };
  const wrap = (value: string, font: PDFFont, size: number, width: number) => {
    const lines: string[] = [];
    for (const paragraph of value
      .replace(/\r/g, "")
      .replace(/\t/g, "  ")
      .split("\n")) {
      let line = "";
      for (const word of paragraph.split(/\s+/)) {
        const candidate = line ? line + " " + word : word;
        if (font.widthOfTextAtSize(candidate, size) <= width) {
          line = candidate;
          continue;
        }
        if (line) {
          lines.push(line);
          line = "";
        }
        for (const char of word) {
          if (font.widthOfTextAtSize(line + char, size) > width) {
            lines.push(line);
            line = "";
          }
          line += char;
        }
      }
      lines.push(line);
    }
    return lines;
  };
  const text = (value: string, size = 11, font = regular, color = ink) => {
    for (const line of wrap(value, font, size, 507)) {
      ensure(size + 6);
      page.drawText(line, { x: 44, y, size, font, color });
      y -= size + 6;
    }
  };
  const section = (label: string, value: string) => {
    ensure(50);
    y -= 12;
    text(label.toUpperCase(), 9, bold, muted);
    text(value);
  };
  const right = (value: string, edge: number, at: number, font = regular) => {
    page.drawText(value, {
      x: edge - font.widthOfTextAtSize(value, 10),
      y: at,
      size: 10,
      font,
      color: ink,
    });
  };
  const tableHeader = () => {
    ensure(45);
    page.drawRectangle({
      x: 44,
      y: y - 7,
      width: 507,
      height: 24,
      color: rgb(0.94, 0.95, 0.96),
    });
    page.drawText("DESCRIPTION", {
      x: 52,
      y,
      font: bold,
      size: 9,
      color: muted,
    });
    right("QTY", 315, y, bold);
    right("UNIT", 395, y, bold);
    right("VAT", 465, y, bold);
    right("TOTAL", 543, y, bold);
    y -= 32;
  };
  addPage();
  text(`Invoice ${invoice.number}`, 24, bold);
  text(
    `Issued ${invoice.issueDate}   |   Due ${invoice.dueDate}   |   GBP`,
    10,
    regular,
    muted,
  );
  section("From", invoice.seller.name + "\n" + invoice.sellerAddress);
  if (invoice.seller.number)
    text("Company number: " + invoice.seller.number, 10);
  if (invoice.seller.vatRegistered && invoice.seller.vatNumber)
    text("VAT number: " + invoice.seller.vatNumber, 10);
  section("Bill to", invoice.customerName + "\n" + invoice.customerAddress);
  y -= 18;
  tableHeader();
  for (const line of invoice.lines) {
    const lines = wrap(line.description, regular, 10, 235);
    const height = Math.max(30, lines.length * 15 + 12);
    if (y - height < 65) {
      addPage();
      tableHeader();
    }
    const top = y;
    for (const [i, value] of lines.entries())
      page.drawText(value, {
        x: 52,
        y: top - i * 15,
        font: regular,
        size: 10,
        color: ink,
      });
    right(String(line.quantity), 315, top);
    right(money(line.unitPence), 395, top);
    right(money(line.vatPence), 465, top);
    right(money(line.quantity * line.unitPence + line.vatPence), 543, top);
    y -= height;
    page.drawLine({
      start: { x: 44, y: y + 15 },
      end: { x: 551, y: y + 15 },
      thickness: 0.5,
      color: rgb(0.85, 0.87, 0.89),
    });
  }
  ensure(100);
  y -= 10;
  for (const [label, value] of [
    ["Subtotal", invoice.netPence],
    ["VAT", invoice.vatPence],
    ["Total GBP", invoice.totalPence],
  ] as const) {
    page.drawText(label, {
      x: 350,
      y,
      size: 11,
      font: label === "Total GBP" ? bold : regular,
      color: ink,
    });
    right(money(value), 543, y, label === "Total GBP" ? bold : regular);
    y -= 23;
  }
  if (invoice.paymentDetails)
    section("Payment details", invoice.paymentDetails);
  if (invoice.notes) section("Notes", invoice.notes);
  for (const [i, p] of doc.getPages().entries()) {
    p.drawText(
      demo
        ? "DEMO - fictional browser data. No ledger entry or payment recorded."
        : "DRAFT - no ledger entry or payment recorded.",
      { x: 44, y: 33, font: regular, size: 8, color: muted },
    );
    p.drawText(`${i + 1} / ${doc.getPageCount()}`, {
      x: 515,
      y: 33,
      font: regular,
      size: 8,
      color: muted,
    });
  }
  return doc.save();
}
