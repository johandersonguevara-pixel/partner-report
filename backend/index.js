import "dotenv/config";
import cors from "cors";
import express from "express";
import { partnersRouter } from "./routes/partners.js";
import { generateRouter } from "./routes/generate.js";
import { historyRouter } from "./routes/history.js";

const app = express();
const port = Number(process.env.PORT) || 3001;

app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN || true,
    credentials: true,
  })
);
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "partner-report-backend" });
});

app.use("/api/partners", partnersRouter);
app.use("/api/generate", generateRouter);
app.use("/api/history", historyRouter);

app.use((err, _req, res, _next) => {
  console.error(err);
  const status = err.statusCode || 500;
  res.status(status).json({
    error: err.message || "Internal server error",
  });
});

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
