import Anthropic from "@anthropic-ai/sdk";

const client = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

const SYSTEM_PROMPT = `You are a senior Partnership Analyst at Yuno generating a QBR report.
You MUST respond with ONLY a valid JSON object. No markdown, no text before or after.
The JSON must follow EXACTLY the schema below.

STRICT RULES:
1. Only use data explicitly present in the input. Never invent numbers.
2. Every insight must reference a specific data point.
3. Financial loss per decline code = (code_total / total_declined) x total_declined_volume
4. Language: Brazilian partners → pt-BR, LATAM non-Brazil → es, Global → en
5. Approval rate benchmarks: credit ≥70% healthy, 65-70% attention, <65% critical. PIX ≥75% healthy. Boleto ≥38% normal. Debit ≥40% healthy, <20% critical. Wallet ≥55% healthy.

REQUIRED JSON SCHEMA:
{
  "partner": "string",
  "period": "string",
  "language": "pt-BR | es | en",
  "generatedAt": "ISO date string",
  "kpis": {
    "totalTPV": "string (e.g. R$ 971,8M)",
    "totalTransactions": "string (e.g. 2,4M)",
    "approvalRate": "string (e.g. 65,99%)",
    "declinedVolume": "string (e.g. R$ 473,8M)",
    "tpvGrowth": "string (e.g. +28% vs Q4)",
    "topOpportunity": "string (e.g. R$ 21,6M/mês)"
  },
  "executiveSummary": [
    { "label": "string", "value": "string", "context": "string" }
  ],
  "monthlyPerformance": [
    {
      "month": "string",
      "transactions": "string",
      "approved": "string",
      "approvalRate": "number (e.g. 75.18)",
      "totalVolume": "string",
      "approvedVolume": "string"
    }
  ],
  "trendAnalysis": "string (2-3 sentences explaining why approval rate changed)",
  "paymentMethods": [
    {
      "method": "string",
      "transactions": "string",
      "approvalRate": "number",
      "volume": "string",
      "avgTicket": "string",
      "status": "healthy | attention | critical",
      "analysis": "string (only for attention/critical — what the data shows, root cause, suggested action)"
    }
  ],
  "merchants": {
    "highlights": [
      {
        "name": "string",
        "approvalRate": "string",
        "volume": "string",
        "transactions": "string",
        "whyHighlight": "string",
        "opportunity": "string"
      }
    ],
    "alerts": [
      {
        "name": "string",
        "approvalRate": "string",
        "volume": "string",
        "transactions": "string",
        "whyAlert": "string (specific data evidence with numbers)",
        "rootCause": "string",
        "suggestion": "string (concrete action with owner and timeline)",
        "potentialImpact": "string"
      }
    ]
  },
  "declineCodes": [
    {
      "code": "string",
      "total": "string",
      "pctOfDeclines": "number",
      "estimatedLostVolume": "string",
      "type": "soft | hard | operational",
      "action": "string"
    }
  ],
  "top3Opportunities": [
    {
      "code": "string",
      "lostVolume": "string",
      "whatIsHappening": "string",
      "suggestedAction": "string",
      "estimatedRecovery": "string"
    }
  ],
  "growthOpportunities": [
    {
      "title": "string",
      "dataEvidence": "string",
      "revenuePotential": "string",
      "suggestedAction": "string"
    }
  ],
  "nextSteps": [
    {
      "priority": "number (1-7)",
      "action": "string",
      "description": "string",
      "owner": "string",
      "deadline": "string",
      "expectedImpact": "string",
      "category": "urgente | tecnico | comercial"
    }
  ]
}`;

/**
 * Extrai o primeiro objeto JSON `{...}` da resposta e faz parse.
 * @param {string} text
 * @returns {object | null}
 */
function parseClaudeJSON(text) {
  const t = String(text ?? "");
  try {
    const start = t.indexOf("{");
    const end = t.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("No JSON found");
    const clean = t.slice(start, end + 1);
    return JSON.parse(clean);
  } catch (err) {
    console.error("PARSE_ERROR:", err.message);
    console.error("RAW_TEXT:", t.slice(0, 1000));
    return null;
  }
}

function templateReportJSON({ partnerName, period, metrics: _metrics }) {
  const now = new Date().toISOString();
  return {
    partner: partnerName || "Partner",
    period: period || "—",
    language: "pt-BR",
    generatedAt: now,
    kpis: {
      totalTPV: "—",
      totalTransactions: "—",
      approvalRate: "—",
      declinedVolume: "—",
      tpvGrowth: "—",
      topOpportunity: "—",
    },
    executiveSummary: [
      {
        label: "Status",
        value: "—",
        context:
          "Configure ANTHROPIC_API_KEY to enable AI-generated JSON reports from your data.",
      },
    ],
    monthlyPerformance: [],
    trendAnalysis: "",
    paymentMethods: [],
    merchants: { highlights: [], alerts: [] },
    declineCodes: [],
    top3Opportunities: [],
    growthOpportunities: [],
    nextSteps: [],
  };
}

/**
 * @param {{
 *   partnerName: string
 *   partnerId: string
 *   period: string
 *   rawDataText?: string
 *   metrics?: unknown
 * }} input
 * @returns {Promise<object>}
 */
export async function generateReportJSON(input) {
  if (!client) {
    return templateReportJSON(input);
  }

  const userMessage = `Generate a QBR report for partner: ${input.partnerName}
Partner ID: ${input.partnerId}
Period: ${input.period}

RAW DATA FROM DATABASE:
---
${input.rawDataText || JSON.stringify(input.metrics ?? {}, null, 2)}
---

Follow all system instructions. Respond with ONLY the JSON object, no other text.`;

  const msg = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const text = msg.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  if (!text) {
    return templateReportJSON(input);
  }

  const parsed = parseClaudeJSON(text);
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    return parsed;
  }

  return templateReportJSON(input);
}
