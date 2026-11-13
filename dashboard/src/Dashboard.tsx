import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, ApiError } from "./api";
import type { CheckResult, Monitor, Stats } from "./api";

function fmtPercent(v: number | null | undefined) {
  return v == null ? "—" : `${v}%`;
}

function fmtMs(v: number | null | undefined) {
  return v == null ? "—" : `${v} ms`;
}

function fmtDate(iso: string | null | undefined) {
  return iso ? new Date(iso).toLocaleString("tr-TR") : "—";
}

const STATUS_LABEL = { up: "Çalışıyor", down: "Çöktü", unknown: "Bekleniyor" } as const;

export default function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [stats, setStats] = useState<Record<number, Stats>>({});
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [checks, setChecks] = useState<CheckResult[]>([]);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [intervalMinutes, setIntervalMinutes] = useState(5);

  const load = useCallback(async () => {
    try {
      const list = await api.listMonitors();
      const statsList = await Promise.all(list.map((m) => api.getStats(m.id)));
      setMonitors(list);
      setStats(Object.fromEntries(statsList.map((s) => [s.monitor.id, s])));
      setError("");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        onLogout();
        return;
      }
      setError(err instanceof Error ? err.message : "Veri alınamadı");
    }
  }, [onLogout]);

  // Listeyi ve istatistikleri 30 saniyede bir yenile
  useEffect(() => {
    load();
    const timer = setInterval(load, 30_000);
    return () => clearInterval(timer);
  }, [load]);

  // Seçili monitor'ün kontrol geçmişini yükle
  useEffect(() => {
    if (selectedId === null) {
      setChecks([]);
      return;
    }

    let cancelled = false;
    const fetchChecks = () =>
      api
        .getChecks(selectedId)
        .then((data) => {
          if (!cancelled) setChecks([...data].reverse()); // eskiden yeniye
        })
        .catch(() => {});

    fetchChecks();
    const timer = setInterval(fetchChecks, 30_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [selectedId]);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api.createMonitor({ name, url, intervalMinutes });
      setName("");
      setUrl("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eklenemedi");
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm("Bu monitor silinsin mi?")) return;
    try {
      await api.deleteMonitor(id);
      if (selectedId === id) setSelectedId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Silinemedi");
    }
  }

  const selected = monitors.find((m) => m.id === selectedId);
  const selectedStats = selectedId !== null ? stats[selectedId] : undefined;

  // Kesinti anlarında çizgide boşluk kalsın diye isUp false ise null veriyoruz
  const chartData = checks.map((c) => ({
    time: new Date(c.checkedAt).toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    ms: c.isUp ? c.responseTimeMs : null,
  }));

  return (
    <div className="container">
      <header>
        <h1>Uptime Monitor</h1>
        <button className="secondary" onClick={onLogout}>
          Çıkış
        </button>
      </header>

      <form className="add-form" onSubmit={handleAdd}>
        <input
          placeholder="İsim (örn. Google)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          placeholder="https://google.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
        />
        <select
          value={intervalMinutes}
          onChange={(e) => setIntervalMinutes(Number(e.target.value))}
        >
          {[1, 5, 10, 30, 60].map((m) => (
            <option key={m} value={m}>
              {m} dk
            </option>
          ))}
        </select>
        <button type="submit">Ekle</button>
      </form>

      {error && <p className="error">{error}</p>}

      {monitors.length === 0 && (
        <p className="muted">Henüz izlenen site yok. Yukarıdan bir tane ekle.</p>
      )}

      <div className="grid">
        {monitors.map((m) => {
          const s = stats[m.id];
          const status = s?.currentStatus ?? "unknown";
          return (
            <div
              key={m.id}
              className={`card ${selectedId === m.id ? "selected" : ""}`}
              onClick={() => setSelectedId(m.id)}
            >
              <div className="card-top">
                <span className={`dot ${status}`} />
                <strong>{m.name}</strong>
                <span className={`badge ${status}`}>{STATUS_LABEL[status]}</span>
              </div>
              <div className="url">{m.url}</div>

              <div className="stats">
                <div>
                  <span className="label">Uptime (24s)</span>
                  <span className="value">{fmtPercent(s?.last24h.uptimePercent)}</span>
                </div>
                <div>
                  <span className="label">Uptime (7g)</span>
                  <span className="value">{fmtPercent(s?.last7d.uptimePercent)}</span>
                </div>
                <div>
                  <span className="label">Ort. yanıt</span>
                  <span className="value">{fmtMs(s?.last24h.avgResponseTimeMs)}</span>
                </div>
              </div>

              <div className="card-bottom">
                <span className="muted">Son kontrol: {fmtDate(s?.lastCheckedAt)}</span>
                <button
                  className="danger"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(m.id);
                  }}
                >
                  Sil
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {selected && (
        <section className="panel">
          <h2>{selected.name}: yanıt süresi</h2>

          {checks.length === 0 ? (
            <p className="muted">
              Henüz kontrol sonucu yok. İlk kontrol için en fazla 1 dakika bekle.
            </p>
          ) : (
            <div style={{ width: "100%", height: 280 }}>
              <ResponsiveContainer>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="time" />
                  <YAxis unit=" ms" />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="ms"
                    name="Yanıt süresi"
                    stroke="#2563eb"
                    dot={false}
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          <h3>Son kesintiler</h3>
          {selectedStats && selectedStats.recentDowns.length > 0 ? (
            <table>
              <thead>
                <tr>
                  <th>Zaman</th>
                  <th>Durum kodu</th>
                  <th>Süre</th>
                </tr>
              </thead>
              <tbody>
                {selectedStats.recentDowns.map((d) => (
                  <tr key={d.id}>
                    <td>{fmtDate(d.checkedAt)}</td>
                    <td>{d.statusCode ?? "Bağlantı hatası"}</td>
                    <td>{fmtMs(d.responseTimeMs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="muted">Kayıtlı kesinti yok.</p>
          )}
        </section>
      )}
    </div>
  );
}