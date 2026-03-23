import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");
const historyPath = path.join(dataDir, "history.json");

export const historyRouter = express.Router();

async function readHistory() {
  try {
    const raw = await readFile(historyPath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeHistory(entries) {
  await mkdir(dataDir, { recursive: true });
  await writeFile(historyPath, JSON.stringify(entries, null, 2), "utf8");
}

historyRouter.get("/", async (_req, res, next) => {
  try {
    const entries = await readHistory();
    res.json(
      entries
        .slice()
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .map(({ reportMarkdown, pdfBase64, ...rest }) => ({
          ...rest,
          hasPdf: Boolean(pdfBase64),
        }))
    );
  } catch (e) {
    next(e);
  }
});

historyRouter.get("/:id", async (req, res, next) => {
  try {
    const entries = await readHistory();
    const found = entries.find((e) => e.id === req.params.id);
    if (!found) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(found);
  } catch (e) {
    next(e);
  }
});

export async function appendHistory(entry) {
  const entries = await readHistory();
  entries.push(entry);
  await writeHistory(entries);
}
