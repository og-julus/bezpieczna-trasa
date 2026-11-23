import { copyFileSync, writeFileSync } from "fs";

const API_URL =
  process.env.DATA_API_URL ||
  "https://api.dane.gov.pl/1.4/resources?q=wypadki&per_page=50";

async function fetchData() {
  console.log("Szukanie prawdziwego pliku CSV w API dane.gov.pl...");
  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();

    const csvResource = (json.data || []).find((item: any) => {
      const fmt = String(item.attributes?.format || "").toLowerCase();
      const url = item.attributes?.csv_file_url || item.attributes?.file_url || item.attributes?.download_url;
      return fmt === "csv" && Boolean(url);
    });

    if (!csvResource) throw new Error("Nie znaleziono pliku CSV w odpowiedzi API");

    const downloadUrl =
      csvResource.attributes.csv_file_url ||
      csvResource.attributes.file_url ||
      csvResource.attributes.download_url;
    const title = csvResource.attributes.title || "Zbiór danych dane.gov.pl";

    console.log(`Pobieranie: ${title}`);
    const fileRes = await fetch(downloadUrl);
    if (!fileRes.ok) throw new Error(`Błąd pobierania CSV: HTTP ${fileRes.status}`);

    const csvText = await fileRes.text();
    writeFileSync("data/wypadki.csv", csvText, "utf-8");
    writeFileSync(
      "data/meta.json",
      JSON.stringify({ title, url: downloadUrl, fetchedAt: new Date().toISOString() }, null, 2),
      "utf-8"
    );
    console.log("Sukces! Zapisano prawdziwe dane z dane.gov.pl do data/wypadki.csv");
  } catch (err) {
    console.error("Błąd pobierania z API, używam lokalnej próbki:", err);
    copyFileSync("data/sample.csv", "data/wypadki.csv");
  }
}

fetchData();
