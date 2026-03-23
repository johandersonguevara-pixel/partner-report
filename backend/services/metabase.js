const SAMPLE = {
  revenueUsd: 128400,
  activeUsers: 842,
  churnPct: 2.1,
  periodLabel: "last 30 days",
};

/**
 * @param {string} partnerId
 * @param {{ start?: string; end?: string }} [range]
 */
export async function fetchPartnerMetrics(partnerId, range = {}) {
  const base = process.env.METABASE_URL?.replace(/\/$/, "");
  const key = process.env.METABASE_API_KEY;

  if (!base || !key) {
    return {
      source: "sample",
      partnerId,
      range,
      metrics: { ...SAMPLE, partnerId },
    };
  }

  try {
    const res = await fetch(`${base}/api/card/1/query/json`, {
      method: "POST",
      headers: {
        "x-api-key": key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        parameters: {
          partner_id: partnerId,
          start: range.start,
          end: range.end,
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Metabase ${res.status}: ${text.slice(0, 200)}`);
    }

    const rows = await res.json();
    return {
      source: "metabase",
      partnerId,
      range,
      metrics: Array.isArray(rows) ? rows[0] ?? rows : rows,
    };
  } catch (e) {
    console.warn("Metabase fetch failed, using sample metrics:", e.message);
    return {
      source: "sample",
      partnerId,
      range,
      metrics: { ...SAMPLE, partnerId },
    };
  }
}
