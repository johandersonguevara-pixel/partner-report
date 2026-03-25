const base = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

if (import.meta.env.PROD && !base) {
  console.warn(
    "[partner-report] Defina VITE_API_URL no build (URL do backend). Sem isso, /api vai para este host e falha se a API for outro serviço."
  );
}

export function apiPath(path) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

export async function fetchJson(path, options = {}) {
  const res = await fetch(apiPath(path), {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text || "Invalid JSON" };
  }
  if (!res.ok) {
    const err = new Error(data?.error || res.statusText || "Request failed");
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

/**
 * POST /api/generate — resposta JSON { success, report, meta }.
 * Com `dataFile`: multipart/form-data (partnerId, partnerName, period, region, generatedBy, file).
 * Opcional `issuesFile`: campo `issues` (CSV Jira).
 * Sem arquivo: application/json (fluxo Metabase/sample).
 *
 * @param {{
 *   partnerId: string
 *   partnerName: string
 *   period: string
 *   region?: string
 *   generatedBy?: string
 *   start?: string
 *   end?: string
 * }} payload
 * @param {File | null | undefined} [dataFile]
 * @param {File | null | undefined} [issuesFile]
 * @returns {Promise<{ success: boolean, report: object, meta: object }>}
 */
export async function generateReport(payload, dataFile, issuesFile) {
  const url = apiPath("/api/generate");

  let res;
  if (dataFile instanceof File || issuesFile instanceof File) {
    const fd = new FormData();
    fd.append("partnerId", payload.partnerId);
    fd.append("partnerName", payload.partnerName);
    fd.append("period", payload.period);
    if (payload.region != null && payload.region !== "") {
      fd.append("region", payload.region);
    }
    if (payload.generatedBy != null && payload.generatedBy !== "") {
      fd.append("generatedBy", payload.generatedBy);
    }
    if (dataFile instanceof File) {
      fd.append("file", dataFile, dataFile.name || "report.csv");
    }
    if (issuesFile instanceof File) {
      fd.append("issues", issuesFile, issuesFile.name || "issues.csv");
    }
    res = await fetch(url, { method: "POST", body: fd });
  } else {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        partnerId: payload.partnerId,
        partnerName: payload.partnerName,
        period: payload.period,
        region: payload.region,
        generatedBy: payload.generatedBy,
        start: payload.start,
        end: payload.end,
      }),
    });
  }

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text || "Invalid JSON" };
  }

  if (!res.ok) {
    const err = new Error(
      data?.error || res.statusText || `Request failed (${res.status})`
    );
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}
