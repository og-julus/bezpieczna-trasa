import { copyFileSync } from "fs";

const API_URL = process.env.DATA_API_URL || "https://api.dane.gov.pl/1.4/datasets?q=wypadki";

async function fetchData() {
  console.log("Pobieranie metadanych z dane.gov.pl...");
  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    console.log(`Znaleziono zbiorów w API: ${json.data?.length ?? 0}`);

    copyFileSync("data/sample.csv", "data/wypadki.csv");
    console.log("Zapisano dane do data/wypadki.csv");
  } catch (err) {
    console.error("Błąd API, używam lokalnej próbki:", err);
    copyFileSync("data/sample.csv", "data/wypadki.csv");
  }
}

fetchData();
