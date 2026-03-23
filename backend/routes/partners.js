import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const partnersPath = path.join(__dirname, "..", "data", "partners.json");

export const partnersRouter = express.Router();

partnersRouter.get("/", async (_req, res, next) => {
  try {
    const raw = await readFile(partnersPath, "utf8");
    const list = JSON.parse(raw);
    res.json(Array.isArray(list) ? list : []);
  } catch (e) {
    next(e);
  }
});
