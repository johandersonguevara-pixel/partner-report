/**
 * Monta o bloco de contexto de issues para o prompt do Claude.
 * @param {object | null} issuesData — resultado de parseIssuesCSV
 */
export function generateInsights({ issuesData }) {
  if (!issuesData || !issuesData.totalTickets) {
    return { issuesPromptSection: "" };
  }

  const { summary, openTickets } = issuesData;
  const openSorted = [...(openTickets || [])].sort((a, b) => {
    const order = { Highest: 0, High: 1, Medium: 2, Low: 3 };
    return (order[a.priority] ?? 99) - (order[b.priority] ?? 99);
  });

  const lines = openSorted.slice(0, 25).map(
    (t) =>
      `  - [${t.priority}] ${t.ticket}: ${t.problem} (Merchant: ${t.merchant}, Impacto: ${t.impact})`
  );

  const section = `
OPEN ISSUES SUMMARY:
- Total open: ${summary.totalOpen} (${summary.highestOpen} Highest, ${summary.highOpen} High)
- Total closed (in export): ${summary.totalClosed}
- Merchants affected (unique): ${issuesData.merchantsAffected?.length ?? 0}
- Top open issues by priority (problems):
${summary.topIssues.map((p, i) => `  ${i + 1}. ${p}`).join("\n")}

OPEN TICKETS (ordered by priority, sample):
${lines.join("\n")}
`.trim();

  return { issuesPromptSection: section };
}
