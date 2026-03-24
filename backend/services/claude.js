import Anthropic from "@anthropic-ai/sdk";

const client = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

/**
 * @param {{ partnerName: string; partnerId: string; period: string; metrics: unknown }} input
 */
export async function generateReportMarkdown(input) {
  if (!client) {
    return templateReport(input);
  }

  const userPayload = JSON.stringify(
    {
      partnerId: input.partnerId,
      partnerName: input.partnerName,
      period: input.period,
      metrics: input.metrics,
    },
    null,
    2
  );

  const msg = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `You are writing a concise partner business report for an internal audience.

Use clear markdown with: title (H1), Executive summary (short bullets), Metrics snapshot (table or bullets), Highlights, Risks / asks, Next steps.

Data (JSON):\n${userPayload}`,
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
    `# Partner report — ${partnerName}`,
    "",
    `_Period: ${period}_`,
    "",
    "## Executive summary",
    "- Configure `ANTHROPIC_API_KEY` for AI-generated narrative.",
    "- Metrics below are from Metabase when configured, otherwise sample data.",
    "",
    "## Metrics snapshot",
    "```json",
    JSON.stringify(metrics, null, 2),
    "```",
    "",
    "## Next steps",
    "- Connect Metabase card/query for live partner KPIs.",
    "- Regenerate from the app once keys are set.",
  ].join("\n");
}
