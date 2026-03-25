const PLACEHOLDERS = {
  financial: "[VALOR FINANCEIRO]",
  merchant: "[MERCHANT]",
  internal_url: "[URL INTERNA]",
  connection_id: "[ID-REDACTED]",
  ticket_id: "[TICKET-REDACTED]",
};

/**
 * Substitui ocorrências sensíveis no texto, da direita para a esquerda
 * para manter índices válidos.
 * @param {object} block — com originalValue e sensitiveMatches
 * @returns {string}
 */
export function anonymizeBlock(block) {
  const text = String(block?.originalValue ?? "");
  const matches = Array.isArray(block?.sensitiveMatches)
    ? [...block.sensitiveMatches].sort((a, b) => b.startIndex - a.startIndex)
    : [];
  let out = text;
  for (const m of matches) {
    const ph = PLACEHOLDERS[m.type] || "[REDACTED]";
    out = out.slice(0, m.startIndex) + ph + out.slice(m.endIndex);
  }
  return out;
}
