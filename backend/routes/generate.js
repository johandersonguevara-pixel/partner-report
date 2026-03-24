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
    // Aceita tanto o formato do Cursor como o nosso
    const partnerId   = req.body.partnerId   || req.body.partner_id;
    const period      = req.body.period      || req.body.quarter;
    const partnerName = req.body.partnerName || req.body.partner_name;
    const region      = req.body.region      || "";
    const generatedBy = req.body.generatedBy || req.body.generated_by || "";
    const start       = req.body.start;
    const end         = req.body.end;

    if (!partnerId) {
      return res.status(400).json({ error: "partnerId is required" });
    }

    // Tenta carregar partners do ficheiro, senão usa lista hardcoded
    let partner;
    try {
      const raw = await readFile(partnersPath, "utf8");
      const partners = JSON.parse(raw);
      partner = partners.find((p) => p.id === partnerId);
    } catch {
      const PARTNERS = [
        { id: "mercadopago-br",   name: "Mercado Pago",     region: "Brasil" },
        { id: "getnet-br",        name: "Getnet",           region: "Brasil" },
        { id: "cielo-br",         name: "Cielo",            region: "Brasil" },
        { id: "clearsale-br",     name: "ClearSale",        region: "Brasil" },
        { id: "paypal-braintree", name: "PayPal-Braintree", region: "Global" },
        { id: "picpay-br",        name: "PicPay",           region: "Brasil" },
      ];
      partner = PARTNERS.find((p) => p.id === partnerId);
    }

    if (!partner) {
      return res.status(404).json({ error: "Unknown partner" });
    }

    const periodLabel = period || "Current period";
    const name        = partnerName || partner.name;

    console.log(`📊 Fetching metrics: ${name} | ${periodLabel}`);
    const metricsBundle = await fetchPartnerMetrics(partnerId, { start, end });

    console.log(`🧠 Generating report with Claude...`);
    const reportMarkdown = await generateReportMarkdown({
      partnerId,
      partnerName: name,
      period: periodLabel,
      metrics: metricsBundle,
    });

    console.log(`📄 Generating PDF...`);
    const pdfBuffer = await markdownToPdfBuffer(reportMarkdown);

    // Guardar no histórico
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
      filename: `Yuno_PartnerReport_${name.replace(/\s/g, "_")}_${periodLabel.replace(/\s/g, "_")}.pdf`,
      generated_at: new Date().toLocaleString("pt-BR"),
      createdAt: new Date().toISOString(),
    };

    await appendHistory(entry);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${entry.filename}"`);
    res.send(pdfBuffer);

  } catch (e) {
    console.error("Generate error:", e);
    next(e);
  }
});
