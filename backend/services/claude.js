import Anthropic from "@anthropic-ai/sdk";

const client = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

const SYSTEM_PROMPT = `You are a senior Partnership Analyst at Yuno presenting a QBR to a payment partner.
This report will be presented BY the Yuno Partner Manager TO the partner's team.
The goal is to celebrate wins, flag problems WITH context and explanations, and arrive
with a clear action plan that both sides can commit to.

STRICT DATA RULES:
1. Only use metrics explicitly present in the input data. Never invent numbers.
2. Every insight must reference a specific data point from the input.
3. Financial loss = declined volume in BRL. Calculate from data provided.
4. If a metric is missing, omit that section entirely.

LANGUAGE: Auto-detect from partner region.
- Brazilian partners → Portuguese pt-BR
- LATAM non-Brazil → Spanish
- Global → English

APPROVAL RATE BENCHMARKS:
- Credit card: ≥70% healthy, 65-70% needs attention, <65% critical
- PIX: ≥75% healthy, 65-75% attention, <65% critical
- Boleto: ≥38% normal
- Debit card: ≥40% healthy, <20% critical
- Wallet: ≥55% healthy, <50% critical

OUTPUT — use exactly these sections in order:

## 1. Sumário Executivo
5 bullet points max. Format: **Métrica:** valor — o que isso significa para a parceria.

## 2. Performance Mensal
Table: Mês | Transações | Aprovadas | Taxa Aprov. | Volume Total | Volume Aprovado
After table: 2-3 lines explaining WHY approval rate changed and what drove volume shifts.

## 3. Performance por Método de Pagamento
Table: Método | Transações | Taxa Aprov. | Volume | Ticket Médio | Status
Status: use Saudável / Atenção / Crítico based on benchmarks.
After table: for each Atenção or Crítico method write one paragraph with:
- What the data shows
- Likely root cause
- Specific action suggested to the partner

## 4. Top Merchants — Destaques e Alertas

### Destaques
For each merchant with approval rate > 75% OR strong growth:
**[Name]** — [rate]% | R$ [volume] | [txns] transações
> Por que está em destaque: [specific reason from data]
> Oportunidade: [concrete upsell or expansion idea]

### Alertas
For each merchant below benchmark OR with declining trend:
**[Name]** — [rate]% | R$ [volume] | [txns] transações
> Por que está em alerta: [specific data evidence with numbers]
> Causa provável: [root cause based on decline codes, transaction type, ticket size]
> O que sugerimos: [concrete action with owner and timeline]
> Impacto potencial: [estimated recovery calculated from data]

## 5. Análise de Rejeições — Códigos e Impacto Financeiro
Table: Código | Total | % Rejeições | Volume Perdido Est. BRL | Tipo | Ação
- Volume perdido por código = (total_codigo / total_rejeicoes) x volume_total_recusado
- Tipo: Soft Decline / Hard Decline / Operacional

After table, Top 3 oportunidades de recuperação imediata:
For each:
**[Código]** — R$ [volume]M em risco
- O que está acontecendo: [explanation from data]
- Ação conjunta sugerida: [specific action with owner and timeline]
- Recuperação estimada: [conservative estimate]

## 6. Oportunidades de Crescimento
For each opportunity found in data:
### [Title]
- O que os dados mostram: [specific numbers]
- Receita potencial: R$ [calculated value] — [show the calculation]
- Ação sugerida: [who does what, by when]

## 7. Próximos Passos
Table: # | Ação | Responsável | Prazo Sugerido | Impacto Esperado
Max 7 rows. Prioritize by financial impact.

Footer: Fonte: [source] | Período: [period] | Preparado por: Yuno Partner Intelligence`;

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