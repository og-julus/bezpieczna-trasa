import { Database } from "bun:sqlite";
import { existsSync, readFileSync } from "fs";

const db = new Database(":memory:");
db.run(`
  CREATE TABLE wypadki (
    miasto TEXT,
    ulica TEXT,
    rok INTEGER,
    liczba_zdarzen INTEGER,
    typ_pojazdu TEXT
  )
`);

const csvPath = existsSync("data/wypadki.csv") ? "data/wypadki.csv" : "data/sample.csv";
const lines = readFileSync(csvPath, "utf-8").trim().split(/\r?\n/).slice(1);
const insert = db.prepare("INSERT INTO wypadki VALUES (?, ?, ?, ?, ?)");

for (const line of lines) {
  const [miasto, ulica, rok, liczba, typ] = line.split(",");
  if (miasto && ulica) {
    insert.run(miasto.trim(), ulica.trim(), Number(rok), Number(liczba), typ.trim());
  }
}

export interface AccidentRow {
  miasto: string;
  ulica: string;
  rok: number;
  liczba_zdarzen: number;
  typ_pojazdu: string;
}

export async function searchAccidents(query: string, type = "all"): Promise<AccidentRow[]> {
  const param = `%${query}%`;
  if (type && type !== "all") {
    return db
      .query(
        `SELECT miasto, ulica, rok, liczba_zdarzen, typ_pojazdu
         FROM wypadki
         WHERE (lower(miasto) LIKE lower(?) OR lower(ulica) LIKE lower(?))
           AND lower(typ_pojazdu) = lower(?)
         ORDER BY liczba_zdarzen DESC`
      )
      .all(param, param, type) as AccidentRow[];
  }
  return db
    .query(
      `SELECT miasto, ulica, rok, liczba_zdarzen, typ_pojazdu
       FROM wypadki
       WHERE lower(miasto) LIKE lower(?) OR lower(ulica) LIKE lower(?)
       ORDER BY liczba_zdarzen DESC`
    )
    .all(param, param) as AccidentRow[];
}

const html = `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Bezpieczna Trasa — Analiza zagrożeń UTO i rowerów</title>
  <style>
    :root {
      --bg: #09090b;
      --surface: #121215;
      --surface-hover: #1a1a1f;
      --border: #26262b;
      --text: #f4f4f5;
      --muted: #a1a1aa;
      --accent: #e11d48;
      --accent-soft: rgba(225, 29, 72, 0.14);
      --warn: #f59e0b;
      --ok: #10b981;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: radial-gradient(circle at top right, #1f0a12 0%, var(--bg) 42%);
      color: var(--text);
      min-height: 100vh;
      padding: 32px 20px 60px;
    }
    .container { max-width: 960px; margin: 0 auto; }

    header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      flex-wrap: wrap;
      gap: 16px;
      margin-bottom: 28px;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--border);
    }
    .brand-tag {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--accent);
      margin-bottom: 8px;
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--accent);
      box-shadow: 0 0 10px var(--accent);
    }
    h1 { font-size: 28px; font-weight: 700; letter-spacing: -0.02em; }
    .subtitle { color: var(--muted); font-size: 14px; margin-top: 4px; }
    .api-badge {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 12px;
      background: var(--surface);
      border: 1px solid var(--border);
      padding: 8px 12px;
      border-radius: 8px;
      color: var(--muted);
    }
    .api-badge strong { color: var(--ok); }

    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
      gap: 14px;
      margin-bottom: 24px;
    }
    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 18px 20px;
    }
    .card-label {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--muted);
      margin-bottom: 8px;
    }
    .card-value {
      font-size: 26px;
      font-weight: 700;
      letter-spacing: -0.02em;
    }
    .card-sub { font-size: 12px; color: var(--muted); margin-top: 4px; }

    .controls {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 18px;
      align-items: center;
    }
    .search-wrap {
      flex: 1;
      min-width: 240px;
      position: relative;
    }
    .search-wrap input {
      width: 100%;
      padding: 12px 16px;
      background: var(--surface);
      color: var(--text);
      border: 1px solid var(--border);
      border-radius: 10px;
      font-size: 15px;
      outline: none;
      transition: border-color 0.15s;
    }
    .search-wrap input:focus { border-color: var(--accent); }

    .pills { display: flex; gap: 8px; flex-wrap: wrap; }
    .pill {
      padding: 10px 16px;
      background: var(--surface);
      color: var(--muted);
      border: 1px solid var(--border);
      border-radius: 10px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s;
    }
    .pill:hover { color: var(--text); border-color: #3f3f46; }
    .pill.active {
      background: var(--accent);
      color: #fff;
      border-color: var(--accent);
    }

    .table-wrap {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
    }
    table { width: 100%; border-collapse: collapse; }
    th {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      color: var(--muted);
      text-align: left;
      padding: 14px 18px;
      border-bottom: 1px solid var(--border);
      background: #0e0e11;
    }
    td {
      padding: 15px 18px;
      border-bottom: 1px solid var(--border);
      font-size: 14px;
      vertical-align: middle;
    }
    tr:last-child td { border-bottom: none; }
    tbody tr:hover { background: var(--surface-hover); }

    .street { font-weight: 600; color: #fff; }
    .city { color: var(--muted); }

    .type-badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
      background: #1f1f25;
      border: 1px solid #32323a;
      text-transform: capitalize;
    }
    .risk-badge {
      display: inline-block;
      padding: 4px 9px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.04em;
    }
    .risk-high { background: var(--accent-soft); color: #fb7185; border: 1px solid rgba(225,29,72,0.35); }
    .risk-mid { background: rgba(245,158,11,0.14); color: #fbbf24; border: 1px solid rgba(245,158,11,0.3); }
    .risk-low { background: rgba(16,185,129,0.14); color: #34d399; border: 1px solid rgba(16,185,129,0.3); }

    .bar-cell { display: flex; align-items: center; gap: 12px; }
    .bar-num {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-weight: 700;
      min-width: 26px;
    }
    .bar-track {
      flex: 1;
      height: 6px;
      background: #232329;
      border-radius: 999px;
      overflow: hidden;
      min-width: 70px;
    }
    .bar-fill {
      height: 100%;
      background: linear-gradient(90deg, #e11d48, #fb7185);
      border-radius: 999px;
    }
    .empty {
      text-align: center;
      padding: 42px 20px;
      color: var(--muted);
    }
    footer {
      margin-top: 20px;
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 10px;
      font-size: 12px;
      color: var(--muted);
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div>
        <div class="brand-tag"><span class="dot"></span> Open Data • dane.gov.pl</div>
        <h1>Bezpieczna Trasa</h1>
        <p class="subtitle">Monitoring niebezpiecznych ulic dla rowerzystów i użytkowników hulajnóg (UTO)</p>
      </div>
      <div class="api-badge">
        Bun + SQLite RAM • Czas API: <strong id="latency">—</strong>
      </div>
    </header>

    <section class="stats">
      <div class="card">
        <div class="card-label">Zdarzenia (widok)</div>
        <div class="card-value" id="stat-total">0</div>
        <div class="card-sub">Suma w aktualnym filtrze</div>
      </div>
      <div class="card">
        <div class="card-label">Lokalizacje</div>
        <div class="card-value" id="stat-count">0</div>
        <div class="card-sub">Znalezionych odcinków</div>
      </div>
      <div class="card">
        <div class="card-label">Najwyższe ryzyko</div>
        <div class="card-value" id="stat-top" style="font-size: 20px; padding-top: 4px;">—</div>
        <div class="card-sub" id="stat-top-sub">Brak danych</div>
      </div>
    </section>

    <section class="controls">
      <div class="search-wrap">
        <input id="q" type="text" placeholder="Szukaj miasta lub ulicy (np. Warszawa, Marszałkowska)..." autocomplete="off" />
      </div>
      <div class="pills">
        <button class="pill active" data-type="all">Wszystkie</button>
        <button class="pill" data-type="hulajnoga">Hulajnoga (UTO)</button>
        <button class="pill" data-type="rower">Rower</button>
      </div>
    </section>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Ulica</th>
            <th>Miasto</th>
            <th>Pojazd</th>
            <th>Ryzyko</th>
            <th>Zdarzenia (2025)</th>
          </tr>
        </thead>
        <tbody id="res"></tbody>
      </table>
    </div>

    <footer>
      <span>Źródło danych: otwarte zbiory dane.gov.pl (próbka analityczna)</span>
      <span>Licencja MIT • Projekt Open Source</span>
    </footer>
  </div>

  <script>
    let currentType = "all";
    const input = document.getElementById("q");

    function getRiskBadge(count) {
      if (count >= 15) return '<span class="risk-badge risk-high">WYSOKIE</span>';
      if (count >= 10) return '<span class="risk-badge risk-mid">ŚREDNIE</span>';
      return '<span class="risk-badge risk-low">NISKIE</span>';
    }

    async function search() {
      const q = input.value.trim();
      const t0 = performance.now();
      const res = await fetch('/api/search?q=' + encodeURIComponent(q) + '&type=' + encodeURIComponent(currentType));
      const data = await res.json();
      const elapsed = (performance.now() - t0).toFixed(1);

      document.getElementById("latency").textContent = elapsed + " ms";

      const total = data.reduce((acc, r) => acc + r.liczba_zdarzen, 0);
      document.getElementById("stat-total").textContent = total;
      document.getElementById("stat-count").textContent = data.length;

      if (data.length > 0) {
        document.getElementById("stat-top").textContent = data[0].ulica;
        document.getElementById("stat-top-sub").textContent = data[0].miasto + " • " + data[0].liczba_zdarzen + " zdarzeń";
      } else {
        document.getElementById("stat-top").textContent = "—";
        document.getElementById("stat-top-sub").textContent = "Brak wyników";
      }

      const maxVal = data.length > 0 ? Math.max(...data.map(d => d.liczba_zdarzen)) : 1;
      const tbody = document.getElementById("res");

      if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty">Brak wyników dla podanego zapytania.</td></tr>';
        return;
      }

      tbody.innerHTML = data.map(r => {
        const pct = Math.max(8, Math.round((r.liczba_zdarzen / maxVal) * 100));
        return \`
          <tr>
            <td class="street">\${r.ulica}</td>
            <td class="city">\${r.miasto}</td>
            <td><span class="type-badge">\${r.typ_pojazdu}</span></td>
            <td>\${getRiskBadge(r.liczba_zdarzen)}</td>
            <td>
              <div class="bar-cell">
                <span class="bar-num">\${r.liczba_zdarzen}</span>
                <div class="bar-track"><div class="bar-fill" style="width:\${pct}%"></div></div>
              </div>
            </td>
          </tr>\`;
      }).join("");
    }

    input.addEventListener("input", search);

    document.querySelectorAll(".pill").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".pill").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        currentType = btn.dataset.type;
        search();
      });
    });

    search();
  </script>
</body>
</html>`;

if (import.meta.main) {
  const port = Number(process.env.PORT) || 3000;
  Bun.serve({
    port,
    async fetch(req) {
      const url = new URL(req.url);
      if (url.pathname === "/api/search") {
        const q = url.searchParams.get("q") || "";
        const type = url.searchParams.get("type") || "all";
        const data = await searchAccidents(q, type);
        return Response.json(data);
      }
      return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    },
  });
  console.log(`Serwer działa na http://localhost:${port}`);
}
