import Anthropic from "@anthropic-ai/sdk";

const client = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

const SYSTEM_PROMPT = `You are a senior Partnership Analyst at Yuno, a global payment infrastructure company.
Your job is to write a Quarterly Business Review (QBR) report for a specific payment provider partner.

STRICT RULES — follow all of these without exception:
1. Only use data explicitly present in the input. Never invent metrics, percentages, or trends.
2. If a metric is not in the data, omit it — do not estimate or fabricate.
3. Financial loss from declines = declined transactions volume in BRL. Use the data provided. Do not extrapolate beyond what is calculable from the data.
4. Insights must be grounded in numbers. Every claim must reference a specific data point.
5. Tone: professional, direct, partner-facing. This report is shared with the partner.
6. Language: detect from partner name and region. Use Portuguese (pt-BR) for Brazilian partners, Spanish for LATAM (non-Brazil), English for global partners.
7. Do NOT include any section that has no data to support it.
8. Benchmark for approval rate: Credit cards ≥ 70% is healthy. Below 65% is critical. Debit cards below 20% is a known issue to flag. PIX below 65% needs attention. Boleto below 40% is within normal range.

OUTPUT FORMAT — use exactly these H2 sections in order:
## 1. Sumário Executivo (or Executive Summary / Resumen Ejecutivo)
3-5 bullet points. Key numbers only: total TPV, total transactions, overall approval rate, QoQ growth if available, top opportunity.

## 2. Performance Mensal (Monthly Performance / Rendimiento Mensual)
Table: Month | Transactions | Approved | Approval Rate | Volume (BRL/USD/local)
Brief 2-line trend commentary based on the data.

## 3. Performance por Método de Pagamento
Table: Method | Transactions | Approval Rate | Volume | Avg Ticket
Flag any method with approval rate below benchmark.

## 4. Top Merchants — Destaques e Alertas
Two sub-sections:
- Highlights (approval rate > 75% OR strong volume growth)
- Alerts (approval rate critically low OR declining trend)
For each merchant: name, approval rate, volume, one specific action or observation grounded in the data.

## 5. Análise de Rejeições — Códigos e Impacto Financeiro
Table: Decline Code | Total | % of Declines | Estimated Lost Volume (BRL) | Type | Recommended Action
Calculate estimated lost volume per code = (declined txns for that code / total declined txns) × total declined volume.
Classify each: Soft decline (recoverable with retry), Hard decline (not recoverable), Operational (config/integration issue).
Highlight top 3 by financial impact.

## 6. Oportunidades de Crescimento
Only include opportunities that are directly supported by the data. For each:
- What the data shows
- Estimated revenue potential (calculate from data, show formula)
- Suggested joint action

## 7. Próximos Passos
Table: # | Action | Owner | Suggested Timeline
Max 7 items. Only actions that address specific findings from this data.

---
At the end, add a small metadata footer:
_Fonte: [data source from input] | Período: [period] | Gerado por: Yuno Partner Intelligence_`;

/**
 * @param {{ partnerName: string; partnerId: string; period: string; rawDataText: string }} input
 */
export async function generateReportMarkdown(input) {
  if (!client) {
    return templateReport(input);
  }

  const userMessage = `Generate a QBR report for partner: ${input.partnerName}
Period: ${input.period}

RAW DATA FROM DATABASE:
---
${input.rawDataText || JSON.stringify(input.metrics, null, 2)}
---

Follow all system instructions. Output only the markdown report, no preamble.`;

  const msg = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: userMessage,
      },
    ],
  });

  const text = msg.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  return text || templateReport(input);
}

function templateReport({ partnerName, period, metrics }) {
  return [
    `# Partner QBR — ${partnerName}`,
    `_Period: ${period}_`,
    "",
    "## Executive Summary",
    "- Configure `ANTHROPIC_API_KEY` to enable AI-generated reports.",
    "",
    "## Raw Metrics",
    "```json",
    JSON.stringify(metrics, null, 2),
    "```",
  ].join("\n");
}