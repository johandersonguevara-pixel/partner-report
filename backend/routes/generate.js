import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import { generateReportJSON } from "../services/claude.js";
import { fetchPartnerMetrics } from "../services/metabase.js";
import { appendHistory } from "./history.js";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const partnersPath = path.join(__dirname, "..", "data", "partners.json");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const name = (file.originalname || "").toLowerCase();
    const mt = file.mimetype || "";
    if (mt === "application/pdf" || name.endsWith(".pdf")) {
      return cb(null, true);
    }
    const err = new Error("Invalid file type. Upload a PDF.");
    err.statusCode = 400;
    cb(err);
  },
});

export const generateRouter = express.Router();

function conditionalUpload(req, res, next) {
  const ct = (req.headers["content-type"] || "").toLowerCase();
  if (ct.includes("multipart/form-data")) {
    return upload.single("file")(req, res, (err) => {
      if (err) return next(err);
      next();
    });
  }
  next();
}

async function extractPdfText(buffer) {
  if (!buffer?.length) return "";
  try {
    const data = await pdfParse(buffer);
    return typeof data.text === "string" ? data.text.trim() : "";
  } catch (e) {
    console.error("PDF parse error:", e);
    const err = new Error(
      e?.message?.includes("password") || e?.message?.includes("encrypted")
        ? "PDF is encrypted or password-protected"
        : "Failed to extract text from PDF"
    );
    err.statusCode = 400;
    throw err;
  }
}

generateRouter.post("/", conditionalUpload, async (req, res, next) => {
  try {
    const partnerId =
      req.body.partnerId || req.body.partner_id;
    const period = req.body.period || req.body.quarter;
    const partnerName = req.body.partnerName || req.body.partner_name;
    const region = req.body.region || "";
    const generatedBy =
      req.body.generatedBy || req.body.generated_by || "";
    const start = req.body.start;
    const end = req.body.end;

    if (!partnerId) {
      return res.status(400).json({ error: "partnerId is required" });
    }

    let partner;
    try {
      const raw = await readFile(partnersPath, "utf8");
      const partners = JSON.parse(raw);
      partner = partners.find((p) => p.id === partnerId);
    } catch {
      const PARTNERS = [
        { id: "mercadopago-br", name: "Mercado Pago", region: "Brasil" },
        { id: "getnet-br", name: "Getnet", region: "Brasil" },
        { id: "cielo-br", name: "Cielo", region: "Brasil" },
        { id: "clearsale-br", name: "ClearSale", region: "Brasil" },
        { id: "paypal-braintree", name: "PayPal-Braintree", region: "Global" },
        { id: "picpay-br", name: "PicPay", region: "Brasil" },
      ];
      partner = PARTNERS.find((p) => p.id === partnerId);
    }

    if (!partner) {
      return res.status(404).json({ error: "Unknown partner" });
    }

    const periodLabel = period || "Current period";
    const name = partnerName || partner.name;

    const file = req.file;
    const hasPdfUpload = Boolean(file?.buffer?.length);

    let rawDataText = "";
    let metricsBundle = {};

    if (hasPdfUpload) {
      console.log(`📄 Extracting text from uploaded PDF (${file.size} bytes)`);
      rawDataText = await extractPdfText(file.buffer);
      if (!rawDataText) {
        return res.status(400).json({
          error:
            "No text could be extracted from the PDF (empty or image-only document)",
        });
      }
    } else {
      console.log(`📊 Fetching metrics: ${name} | ${periodLabel}`);
      metricsBundle = await fetchPartnerMetrics(partnerId, { start, end });
    }

    console.log(`🧠 Generating QBR JSON with Claude...`);
    const reportJSON = await generateReportJSON({
      partnerId,
      partnerName: name,
      period: periodLabel,
      rawDataText,
      metrics: metricsBundle,
    });

    const generatedAt = new Date().toISOString();
    const id = uuidv4();
    const entry = {
      id,
      partnerId,
      partnerName: name,
      partner: name,
      region: region || partner.region || "",
      period: periodLabel,
      quarter: periodLabel,
      generated_by: generatedBy,
      filename: `Yuno_QBR_${name.replace(/\s/g, "_")}_${periodLabel.replace(/\s/g, "_")}.json`,
      generated_at: new Date().toLocaleString("pt-BR"),
      createdAt: generatedAt,
      dataSource: hasPdfUpload ? "pdf_upload" : metricsBundle.source || "metabase_or_sample",
    };

    try {
      await appendHistory(entry);
    } catch (histErr) {
      console.error("History write failed (response still sent):", histErr);
    }

    res.json({
      success: true,
      report: reportJSON,
      meta: {
        partnerId,
        partnerName: name,
        period: periodLabel,
        generatedAt,
        historyId: id,
      },
    });
  } catch (e) {
    console.error("Generate error:", e?.stack || e);
    next(e);
  }
});
