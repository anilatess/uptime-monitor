import { Router } from "express";
import type { Response } from "express";
import { prisma } from "../lib/prisma";
import { createMonitorSchema, updateMonitorSchema } from "../schemas";
import type { AuthRequest } from "../middleware/auth";

const router = Router();

// id'yi okur, monitor'ün bu kullanıcıya ait olup olmadığını kontrol eder
async function findOwnedMonitor(req: AuthRequest, res: Response) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Geçersiz id" });
    return null;
  }

  const monitor = await prisma.monitor.findFirst({
    where: { id, userId: req.userId },
  });
  if (!monitor) {
    res.status(404).json({ error: "Monitor bulunamadı" });
    return null;
  }
  return monitor;
}

// Listele
router.get("/", async (req: AuthRequest, res) => {
  const monitors = await prisma.monitor.findMany({
    where: { userId: req.userId },
    orderBy: { id: "asc" },
  });
  res.json(monitors);
});

// Oluştur
router.post("/", async (req: AuthRequest, res) => {
  const result = createMonitorSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ errors: result.error.issues });
    return;
  }

  const monitor = await prisma.monitor.create({
    data: { ...result.data, userId: req.userId! },
  });
  res.status(201).json(monitor);
});

// Tek kayıt
router.get("/:id", async (req: AuthRequest, res) => {
  const monitor = await findOwnedMonitor(req, res);
  if (!monitor) return;
  res.json(monitor);
});

// Güncelle
router.put("/:id", async (req: AuthRequest, res) => {
  const monitor = await findOwnedMonitor(req, res);
  if (!monitor) return;

  const result = updateMonitorSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ errors: result.error.issues });
    return;
  }

  const updated = await prisma.monitor.update({
    where: { id: monitor.id },
    data: result.data,
  });
  res.json(updated);
});

// Sil
router.delete("/:id", async (req: AuthRequest, res) => {
  const monitor = await findOwnedMonitor(req, res);
  if (!monitor) return;

  await prisma.monitor.delete({ where: { id: monitor.id } });
  res.status(204).send();
});

// Son kontrol sonuçları
router.get("/:id/checks", async (req: AuthRequest, res) => {
  const monitor = await findOwnedMonitor(req, res);
  if (!monitor) return;

  const checks = await prisma.checkResult.findMany({
    where: { monitorId: monitor.id },
    orderBy: { checkedAt: "desc" },
    take: 50,
  });
  res.json(checks);
});

// İstatistikler
router.get("/:id/stats", async (req: AuthRequest, res) => {
  const monitor = await findOwnedMonitor(req, res);
  if (!monitor) return;

  const id = monitor.id;
  const now = Date.now();
  const hour = 60 * 60 * 1000;

  async function periodStats(hours: number) {
    const since = new Date(now - hours * hour);
    const where = { monitorId: id, checkedAt: { gte: since } };

    const [total, up, avg] = await Promise.all([
      prisma.checkResult.count({ where }),
      prisma.checkResult.count({ where: { ...where, isUp: true } }),
      prisma.checkResult.aggregate({
        where: { ...where, isUp: true },
        _avg: { responseTimeMs: true },
      }),
    ]);

    return {
      totalChecks: total,
      uptimePercent: total === 0 ? null : Math.round((up / total) * 10000) / 100,
      avgResponseTimeMs:
        avg._avg.responseTimeMs === null ? null : Math.round(avg._avg.responseTimeMs),
    };
  }

  const [last24h, last7d, last30d, lastCheck, recentDowns] = await Promise.all([
    periodStats(24),
    periodStats(24 * 7),
    periodStats(24 * 30),
    prisma.checkResult.findFirst({
      where: { monitorId: id },
      orderBy: { checkedAt: "desc" },
    }),
    prisma.checkResult.findMany({
      where: { monitorId: id, isUp: false },
      orderBy: { checkedAt: "desc" },
      take: 10,
    }),
  ]);

  res.json({
    monitor: { id: monitor.id, name: monitor.name, url: monitor.url },
    currentStatus: lastCheck ? (lastCheck.isUp ? "up" : "down") : "unknown",
    lastCheckedAt: lastCheck?.checkedAt ?? null,
    last24h,
    last7d,
    last30d,
    recentDowns,
  });
});

export default router;