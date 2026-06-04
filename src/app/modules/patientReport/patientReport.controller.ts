/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import catchAsync from "../../utilities/catchAsync";
import { PatientReportService } from "./patientReport.service";
import { generateReportPdf } from "./patientReport.pdf";
import { IReportData } from "./patientReport.interface";

const _userId = (req: Request): string => (req.user as any).userId;

// Only 7 or 30 day periods are supported; anything else falls back to 7.
const _days = (req: Request): number => {
  const d = parseInt(req.query.days as string, 10);
  return d === 30 ? 30 : 7;
};

// Build a safe, descriptive filename for the download.
const _fileName = (data: IReportData): string => {
  const safeName = (data.patient.name || "patient")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  const date = data.generatedAt.toISOString().slice(0, 10);
  return `ezygut-report-${safeName}-${data.period.days}d-${date}.pdf`;
};

const _streamPdf = async (res: Response, data: IReportData) => {
  const pdf = await generateReportPdf(data);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${_fileName(data)}"`,
  );
  res.setHeader("Content-Length", pdf.length);
  res.end(pdf);
};

/**
 * GET /api/v1/report/patient/:patientId?days=7|30   (clinician only)
 * Downloads the connected patient's digestive health report as a PDF.
 */
const downloadPatientReport = catchAsync(
  async (req: Request, res: Response) => {
    const data = await PatientReportService.getReportForClinician(
      _userId(req),
      req.params.patientId,
      _days(req),
    );
    await _streamPdf(res, data);
  },
);

/**
 * GET /api/v1/report/me?days=7|30   (patient only)
 * Downloads the authenticated patient's own report as a PDF.
 */
const downloadMyReport = catchAsync(async (req: Request, res: Response) => {
  const data = await PatientReportService.getReportForPatient(
    _userId(req),
    _days(req),
  );
  await _streamPdf(res, data);
});

export const PatientReportController = {
  downloadPatientReport,
  downloadMyReport,
};
