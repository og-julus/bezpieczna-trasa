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
    insert.run(miasto, ulica, Number(rok), Number(liczba), typ);
  }
}

export interface AccidentRow {
  miasto: string;
  ulica: string;
  rok: number;
  liczba_zdarzen: number;
  typ_pojazdu: string;
}

export async function searchAccidents(query: string): Promise<AccidentRow[]> {
  const param = `%${query}%`;
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
  <meta charset="UTF-8">
  <title>Bezpieczna Trasa</title>
  <style>
    body { font-family: sans-serif; background: #111; color: #eee; max-width: 720px; margin: 40px auto; padding: 0 20px; }
    input { width: 70%; padding: 10px; background: #222; color: #fff; border: 1px solid #444; }
    button { padding: 10px 20px; background: #e11d48; color: #fff; border: none; cursor: pointer; }
    table { width: 100%; margin-top: 20px; border-collapse: collapse; }
    th, td { padding: 10px; border-bottom: 1px solid #333; text-align: left; }
  </style>
</head>
<body>
  <h1>Bezpieczna Trasa (Rower / UTO)</h1>
  <input id="q" placeholder="Wpisz miasto lub ulicę (np. Warszawa)..." />
  <button onclick="search()">Szukaj</button>
  <table>
    <thead><tr><th>Miasto</th><th>Ulica</th><th>Typ</th><th>Zdarzenia</th></tr></thead>
    <tbody id="res"></tbody>
  </table>
  <script>
    async function search() {
      const q = document.getElementById('q').value;
      const res = await fetch('/api/search?q=' + encodeURIComponent(q));
      const data = await res.json();
      document.getElementById('res').innerHTML = data.map(r =>
        '<tr><td>'+r.miasto+'</td><td>'+r.ulica+'</td><td>'+r.typ_pojazdu+'</td><td>'+r.liczba_zdarzen+'</td></tr>'
      ).join('');
    }
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
        const data = await searchAccidents(q);
        return Response.json(data);
      }
      return new Response(html, { headers: { "Content-Type": "text/html" } });
    },
  });
  console.log(`Serwer działa na http://localhost:${port}`);
}