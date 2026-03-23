import PDFDocument from "pdfkit";

/**
 * @param {string} text
 * @returns {Promise<Buffer>}
 */
export function markdownToPdfBuffer(text) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "LETTER" });
    const chunks = [];

    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const lines = text.replace(/\r\n/g, "\n").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("# ")) {
        doc.fontSize(18).font("Helvetica-Bold").text(trimmed.slice(2), { paragraphGap: 8 });
        doc.font("Helvetica");
      } else if (trimmed.startsWith("## ")) {
        doc.fontSize(14).font("Helvetica-Bold").text(trimmed.slice(3), { paragraphGap: 6 });
        doc.font("Helvetica");
      } else if (trimmed.startsWith("### ")) {
        doc.fontSize(12).font("Helvetica-Bold").text(trimmed.slice(4), { paragraphGap: 4 });
        doc.font("Helvetica");
      } else if (trimmed === "") {
        doc.moveDown(0.35);
      } else {
        doc.fontSize(10).font("Helvetica").text(line, { paragraphGap: 2 });
      }
    }

    doc.end();
  });
}
