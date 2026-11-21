import { expect, test } from "bun:test";
import { searchAccidents } from "../src/index";

test("wyszukuje zdarzenia w Warszawie", async () => {
  const results = await searchAccidents("Warszawa");
  expect(results.length).toBeGreaterThan(0);
  expect(results[0].miasto).toBe("Warszawa");
});

test("zwraca pustą tablicę dla nieistniejącego miasta", async () => {
  const results = await searchAccidents("NieistniejaceMiastoXYZ");
  expect(results.length).toBe(0);
});
