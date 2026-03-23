export function simpleMarkdownToHtml(md) {
  const esc = (s) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let inCode = false;
  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      if (inCode) {
        out.push("</code></pre>");
        inCode = false;
      } else {
        out.push("<pre><code>");
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      out.push(esc(line) + "\n");
      continue;
    }
    const t = line.trim();
    if (t.startsWith("# ")) {
      out.push(`<h1>${esc(t.slice(2))}</h1>`);
    } else if (t.startsWith("## ")) {
      out.push(`<h2>${esc(t.slice(3))}</h2>`);
    } else if (t.startsWith("### ")) {
      out.push(`<h3>${esc(t.slice(4))}</h3>`);
    } else if (t === "") {
      out.push("<br/>");
    } else {
      out.push(`<p>${esc(line)}</p>`);
    }
  }
  if (inCode) out.push("</code></pre>");
  return out.join("");
}
