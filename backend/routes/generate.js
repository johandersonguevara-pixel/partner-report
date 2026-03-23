import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { v4 as uuidv4 } from "uuid";
import { generateReportMarkdown } from "../services/claude.js";
import { fetchPartnerMetrics } from "../services/metabase.js";
import { markdownToPdfBuffer } from "../services/pdf.js";
import { appendHistory } from "./history.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const partnersPath = path.join(__dirname, "..", "data", "partners.json");

export const generateRouter = express.Router();

generateRouter.post("/", async (req, res, next) => {
  try {
    const { partnerId, period, start, end, includePdf } = req.body || {};
    if (!partnerId || typeof partnerId !== "string") {
      res.status(400).json({ error: "partnerId is required" });
      return;
    }

    const raw = await readFile(partnersPath, "utf8");
    const partners = JSON.parse(raw);
    const partner = partners.find((p) => p.id === partnerId);
    if (!partner) {
      res.status(404).json({ error: "Unknown partner" });
      return;
    }

    const periodLabel =
      typeof period === "string" && period.trim()
        ? period.trim()
        : "Current period";

    const metricsBundle = await fetchPartnerMetrics(partnerId, { start, end });
    const reportMarkdown = await generateReportMarkdown({
      partnerId,
      partnerName: partner.name,
      period: periodLabel,
      metrics: metricsBundle,
    });

    let pdfBase64;
    if (includePdf) {
      const buf = await markdownToPdfBuffer(reportMarkdown);
      pdfBase64 = buf.toString("base64");
    }

    const id = uuidv4();
    const createdAt = new Date().toISOString();
    const entry = {
      id,
      partnerId,
      partnerName: partner.name,
      period: periodLabel,
      createdAt,
      metricsSource: metricsBundle.source,
      reportMarkdown,
      ...(pdfBase64 ? { pdfBase64 } : {}),
    };

    await appendHistory(entry);

    res.status(201).json({
      id,
      partnerId,
      partnerName: partner.name,
      period: periodLabel,
      createdAt,
      metricsSource: metricsBundle.source,
      reportMarkdown,
      ...(pdfBase64 ? { pdfBase64 } : {}),
    });
  } catch (e) {
    next(e);
  }
});
