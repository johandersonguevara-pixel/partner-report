const PRIORITY_ORDER = { Highest: 0, High: 1, Medium: 2, Low: 3 };

/**
 * Next steps automáticos a partir de tickets Highest/High abertos.
 * @param {object | null} issuesData
 */
function buildAutoNextStepsFromIssues(issuesData) {
  if (!issuesData?.openTickets?.length) return [];
  const open = issuesData.openTickets.filter(
    (t) =>
      t.isOpen && (t.priority === "Highest" || t.priority === "High")
  );
  open.sort(
    (a, b) =>
      (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99)
  );
  return open.map((ticket) => ({
    priority: ticket.priority === "Highest" ? 1 : 2,
    action: `Resolver ${ticket.ticket}: ${ticket.problem}`,
    description: ticket.impact,
    owner: "Yuno Engineering + MP",
    deadline: ticket.priority === "Highest" ? "Imediato" : "Abr 2026",
    expectedImpact: ticket.impact,
    category: "tecnico",
  }));
}

/**
 * Objeto final do relatório: dados brutos de issues, análise do Claude e next steps mesclados.
 * @param {{ claudeJson: object, issuesData: object | null }} opts
 */
export function buildReport({ claudeJson, issuesData }) {
  const base =
    claudeJson && typeof claudeJson === "object" && !Array.isArray(claudeJson)
      ? { ...claudeJson }
      : {};

  base.issuesData = issuesData ?? null;
  const iaRaw = base.issuesAnalysis ?? base.issues_analysis ?? null;
  delete base.issues_analysis;
  base.issuesAnalysis =
    issuesData?.totalTickets > 0 ? iaRaw : null;

  const auto = buildAutoNextStepsFromIssues(issuesData);
  const existing = Array.isArray(base.nextSteps) ? base.nextSteps : [];
  base.nextSteps = [...auto, ...existing];

  return base;
}
