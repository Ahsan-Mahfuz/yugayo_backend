/* eslint-disable @typescript-eslint/no-explicit-any */
import PDFDocument from "pdfkit";
import { IReportData } from "./patientReport.interface";

// ─── Theme ──────────────────────────────────────────────────────────────────
const TEAL = "#1AA6A6";
const TEXT = "#333333";
const MUTED = "#666666";
const ROW_ALT = "#F2F8F8"; // very light teal-gray for zebra striping
const BORDER = "#DDE6E6";

const PAGE_MARGIN = 40;
const FONT = "Helvetica";
const FONT_BOLD = "Helvetica-Bold";

interface Column {
  header: string;
  /** key into the row object, OR a function returning the cell text */
  get: (row: any) => string;
  width: number; // absolute points
  align?: "left" | "center" | "right";
}

// ─── Table renderer ───────────────────────────────────────────────────────────
const drawTable = (
  doc: PDFKit.PDFDocument,
  columns: Column[],
  rows: any[],
  emptyText: string,
) => {
  const startX = PAGE_MARGIN;
  const totalWidth = columns.reduce((s, c) => s + c.width, 0);
  const cellPadX = 6;
  const cellPadY = 5;
  const fontSize = 9;
  const headerFontSize = 9;

  const pageBottom = () => doc.page.height - PAGE_MARGIN;

  // ── header row ──
  const drawHeader = () => {
    const headerHeight = 22;
    let x = startX;
    doc.rect(startX, doc.y, totalWidth, headerHeight).fill(TEAL);
    const hy = doc.y;
    columns.forEach((col) => {
      doc
        .fillColor("#FFFFFF")
        .font(FONT_BOLD)
        .fontSize(headerFontSize)
        .text(col.header, x + cellPadX, hy + 6, {
          width: col.width - cellPadX * 2,
          align: col.align ?? "left",
          lineBreak: false,
          ellipsis: true,
        });
      x += col.width;
    });
    doc.y = hy + headerHeight;
  };

  drawHeader();

  const renderRows = rows.length
    ? rows
    : [{ __empty: true }];

  renderRows.forEach((row, idx) => {
    const isEmpty = (row as any).__empty;

    // measure row height from tallest wrapped cell
    doc.font(FONT).fontSize(fontSize);
    let rowHeight = 16;
    if (isEmpty) {
      rowHeight = 18;
    } else {
      columns.forEach((col) => {
        const text = col.get(row) ?? "";
        const h = doc.heightOfString(String(text), {
          width: col.width - cellPadX * 2,
        });
        rowHeight = Math.max(rowHeight, h + cellPadY * 2);
      });
    }

    // page break
    if (doc.y + rowHeight > pageBottom()) {
      doc.addPage();
      drawHeader();
    }

    const rowY = doc.y;

    // zebra background
    if (!isEmpty && idx % 2 === 1) {
      doc.rect(startX, rowY, totalWidth, rowHeight).fill(ROW_ALT);
    }

    if (isEmpty) {
      doc
        .fillColor(MUTED)
        .font(FONT)
        .fontSize(fontSize)
        .text(emptyText, startX + cellPadX, rowY + cellPadY, {
          width: totalWidth - cellPadX * 2,
          align: "left",
        });
    } else {
      let x = startX;
      columns.forEach((col) => {
        doc
          .fillColor(TEXT)
          .font(FONT)
          .fontSize(fontSize)
          .text(String(col.get(row) ?? ""), x + cellPadX, rowY + cellPadY, {
            width: col.width - cellPadX * 2,
            align: col.align ?? "left",
          });
        x += col.width;
      });
    }

    // bottom border
    doc
      .moveTo(startX, rowY + rowHeight)
      .lineTo(startX + totalWidth, rowY + rowHeight)
      .lineWidth(0.5)
      .strokeColor(BORDER)
      .stroke();

    doc.y = rowY + rowHeight;
  });

  doc.y += 6;
};

// ─── Section heading ──────────────────────────────────────────────────────────
const sectionHeading = (doc: PDFKit.PDFDocument, text: string) => {
  if (doc.y + 60 > doc.page.height - PAGE_MARGIN) doc.addPage();
  doc.moveDown(0.4);
  doc.fillColor(TEAL).font(FONT_BOLD).fontSize(13).text(text, PAGE_MARGIN, doc.y);
  doc.moveDown(0.3);
};

// ─── Body paragraph ───────────────────────────────────────────────────────────
const paragraph = (doc: PDFKit.PDFDocument, text: string, color = TEXT) => {
  doc
    .fillColor(color)
    .font(FONT)
    .fontSize(9.5)
    .text(text, PAGE_MARGIN, doc.y, {
      width: doc.page.width - PAGE_MARGIN * 2,
      align: "left",
    });
  doc.moveDown(0.4);
};

// ─── Main builder ─────────────────────────────────────────────────────────────
export const generateReportPdf = (data: IReportData): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margin: PAGE_MARGIN,
        bufferPages: true,
        info: {
          Title: `EzyGut Digestive Health Report - ${data.patient.name}`,
          Author: "EzyGut",
        },
      });

      const chunks: Buffer[] = [];
      doc.on("data", (c: Buffer) => chunks.push(c));
      doc.on("end", () =>
        resolve(Buffer.concat(chunks as unknown as Uint8Array[])),
      );
      doc.on("error", reject);

      const contentWidth = doc.page.width - PAGE_MARGIN * 2;

      // ── Title ──
      doc
        .fillColor(TEAL)
        .font(FONT_BOLD)
        .fontSize(22)
        .text("EzyGut Digestive Health Report", PAGE_MARGIN, doc.y, {
          width: contentWidth,
          align: "center",
        });
      doc
        .fillColor(MUTED)
        .font(FONT)
        .fontSize(10)
        .text(
          `Digestive health summary — ${data.period.label}`,
          PAGE_MARGIN,
          doc.y + 2,
          { width: contentWidth, align: "center" },
        );
      doc.moveDown(1);

      // ── 1. Summary ──
      sectionHeading(doc, "1. Summary");
      drawTable(
        doc,
        [
          { header: "Patient", get: (r) => r.patient, width: 100 },
          { header: "Report Period", get: (r) => r.period, width: 78 },
          { header: "Gut Balance", get: (r) => r.gut, width: 92 },
          { header: "Meals", get: (r) => r.meals, width: 42, align: "center" },
          { header: "Symptoms", get: (r) => r.symptoms, width: 64, align: "center" },
          { header: "Most Common Symptom", get: (r) => r.common, width: 139 },
        ],
        [
          {
            patient: data.patient.name,
            period: data.period.label,
            gut: data.summary.gutBalance,
            meals: String(data.summary.totalMeals),
            symptoms: String(data.summary.totalSymptoms),
            common: data.summary.mostCommonSymptom,
          },
        ],
        "No summary data.",
      );
      paragraph(doc, `Summary: ${data.summary.text}`);

      // ── 2. Food Logs ──
      sectionHeading(doc, "2. Food Logs");
      drawTable(
        doc,
        [
          { header: "Date/Time", get: (r) => r.dateTime, width: 95 },
          { header: "Meal", get: (r) => r.mealType, width: 70 },
          { header: "Foods", get: (r) => r.foods, width: 190 },
          {
            header: "Estimated Gut Flare Risk",
            get: (r) => r.flareRisk.display,
            width: 160,
          },
        ],
        data.foodLogs,
        "No food logs in this period.",
      );

      // ── 3. Symptom Logs ──
      sectionHeading(doc, "3. Symptom Logs");
      drawTable(
        doc,
        [
          { header: "Date/Time", get: (r) => r.dateTime, width: 160 },
          { header: "Symptom", get: (r) => r.symptom, width: 200 },
          { header: "Severity", get: (r) => r.severity, width: 155 },
        ],
        data.symptomLogs,
        "No symptoms logged in this period.",
      );
      paragraph(doc, `Frequency: ${data.symptomFrequency}`, MUTED);

      // ── 4. Food–Symptom Associations ──
      sectionHeading(doc, "4. Food-Symptom Associations");
      drawTable(
        doc,
        [
          { header: "Food", get: (r) => r.food, width: 110 },
          { header: "Symptom", get: (r) => r.symptom, width: 90 },
          { header: "Observed Pattern", get: (r) => r.observedPattern, width: 230 },
          { header: "Level", get: (r) => r.level, width: 85 },
        ],
        data.associations,
        "No food–symptom associations found in this period.",
      );
      paragraph(
        doc,
        'Associations describe foods "associated with" or that "appeared before" a symptom. They do not imply the food caused or triggered the symptom.',
        MUTED,
      );

      // ── 5. Safe Foods ──
      sectionHeading(doc, "5. Safe Foods");
      drawTable(
        doc,
        [
          { header: "Food", get: (r) => r.food, width: 200 },
          { header: "Times Logged", get: (r) => String(r.timesLogged), width: 115, align: "center" },
          { header: "Symptoms After Consumption", get: (r) => r.symptomsAfter, width: 200 },
        ],
        data.safeFoods,
        "No safe foods identified yet for this period.",
      );

      // ── 6. Progress ──
      sectionHeading(doc, "6. Progress");
      drawTable(
        doc,
        [
          { header: "Metric", get: (r) => r.metric, width: 235 },
          { header: "Current Period", get: (r) => r.current, width: 140, align: "center" },
          { header: "Previous Period", get: (r) => r.previous, width: 140, align: "center" },
        ],
        data.progress.rows,
        "No progress data.",
      );
      paragraph(doc, `Progress Summary: ${data.progress.text}`);

      // ── 7. Disclaimer ──
      sectionHeading(doc, "7. Disclaimer");
      paragraph(doc, data.disclaimer, MUTED);

      // ── Footer (generated date) on every page ──
      const range = doc.bufferedPageRange();
      const generated = data.generatedAt.toISOString().slice(0, 10);
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        // Drop the bottom margin so writing into the footer band does not
        // trigger pdfkit to spill onto a fresh (blank) page.
        const prevBottom = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;
        doc
          .fillColor(MUTED)
          .font(FONT)
          .fontSize(8)
          .text(
            `Generated ${generated}  •  Page ${i - range.start + 1} of ${range.count}`,
            PAGE_MARGIN,
            doc.page.height - PAGE_MARGIN + 8,
            { width: contentWidth, align: "center", lineBreak: false },
          );
        doc.page.margins.bottom = prevBottom;
      }

      doc.end();
    } catch (err) {
      reject(err as Error);
    }
  });
};
