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
 * POST /api/generate — PDF na resposta (application/pdf) ou JSON legado.
 * Com `pdfFile`: multipart/form-data (partnerId, partnerName, period, region, generatedBy, file).
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
 * @param {File | null | undefined} [pdfFile]
 * @returns {Promise<Response>}
 */
export async function generateReport(payload, pdfFile) {
  const url = apiPath("/api/generate");

  if (pdfFile instanceof File) {
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
    fd.append("file", pdfFile, pdfFile.name || "report.pdf");
    return fetch(url, { method: "POST", body: fd });
  }

  return fetch(url, {
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
