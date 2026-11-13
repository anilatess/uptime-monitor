import "dotenv/config";
import express from "express";
import cors from "cors";
import cron from "node-cron";
import authRouter from "./routes/auth";
import monitorsRouter from "./routes/monitors";
import { requireAuth } from "./middleware/auth";
import { runDueChecks } from "./checker";

const app = express();
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/auth", authRouter);
app.use("/monitors", requireAuth, monitorsRouter);

// Her dakikanın başında zamanı gelen kontrolleri çalıştır
cron.schedule("* * * * *", () => {
  runDueChecks().catch((err) => console.error("[cron] hata:", err));
});

app.listen(3000, () => {
  console.log("Server http://localhost:3000 adresinde çalışıyor");
});