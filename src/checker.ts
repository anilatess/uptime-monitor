import { prisma } from "./lib/prisma";

const TIMEOUT_MS = 10_000;

export async function checkMonitor(monitor: { id: number; url: string }) {
  const start = Date.now();
  let statusCode: number | null = null;
  let isUp = false;

  try {
    const response = await fetch(monitor.url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    statusCode = response.status;
    isUp = response.ok; // 200-299 arası ise true
  } catch {
    // Zaman aşımı, DNS hatası, bağlantı reddi: site erişilemiyor
    isUp = false;
  }

  const responseTimeMs = Date.now() - start;

  await prisma.checkResult.create({
    data: { monitorId: monitor.id, statusCode, responseTimeMs, isUp },
  });

  console.log(
    `[check] ${monitor.url} → ${isUp ? "UP" : "DOWN"} (${statusCode ?? "hata"}, ${responseTimeMs}ms)`
  );
}

export async function runDueChecks() {
  const monitors = await prisma.monitor.findMany({
    include: {
      checks: { orderBy: { checkedAt: "desc" }, take: 1 },
    },
  });

  const now = Date.now();

  const due = monitors.filter((m) => {
    const last = m.checks[0];
    if (!last) return true; // hiç kontrol edilmemiş
    const elapsedMs = now - last.checkedAt.getTime();
    // 5 sn tolerans: cron saniye kaymalarında kontrol atlanmasın
    return elapsedMs >= m.intervalMinutes * 60_000 - 5_000;
  });

  await Promise.allSettled(due.map((m) => checkMonitor(m)));
}