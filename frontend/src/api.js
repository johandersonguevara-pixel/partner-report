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
