import fs from "node:fs/promises";
import { cleanText } from "../utils/validation.js";
import { upsertTrainingQuestions } from "./memoryService.js";

const QUESTION_FIELDS = ["question", "question_en", "question_fr", "question_ar", "question_de", "question_pt", "question_es"];

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (quoted) {
      if (char === "\"" && next === "\"") {
        value += "\"";
        index += 1;
      } else if (char === "\"") {
        quoted = false;
      } else {
        value += char;
      }
      continue;
    }

    if (char === "\"") {
      quoted = true;
    } else if (char === ",") {
      row.push(value);
      value = "";
    } else if (char === "\n") {
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else if (char !== "\r") {
      value += char;
    }
  }

  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }

  return rows.filter((item) => item.some((cell) => String(cell || "").trim()));
}

function normalizeHeader(value) {
  return String(value || "").replace(/^\uFEFF/u, "").trim();
}

function splitLanguages(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function translationsFromRow(row) {
  return {
    en: cleanText(row.question_en || row.question || "", 1000),
    fr: cleanText(row.question_fr || "", 1000),
    ar: cleanText(row.question_ar || "", 1000),
    de: cleanText(row.question_de || "", 1000),
    pt: cleanText(row.question_pt || "", 1000),
    es: cleanText(row.question_es || "", 1000)
  };
}

export function parseTrainingQuestionsCsv(text, { source = "training-csv" } = {}) {
  const rows = parseCsv(text);
  const [headerRow, ...dataRows] = rows;
  if (!headerRow) return [];

  const headers = headerRow.map(normalizeHeader);
  return dataRows
    .map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] || ""])))
    .map((row, index) => {
      const translations = translationsFromRow(row);
      const question = cleanText(row.question || translations.en || QUESTION_FIELDS.map((field) => row[field]).find(Boolean) || "", 1200);
      return {
        source,
        sourceId: cleanText(row.id || `row-${index + 1}`, 120),
        domain: cleanText(row.domain || "general", 120),
        topic: cleanText(row.topic || "", 180),
        questionType: cleanText(row.question_type || "", 120),
        difficulty: cleanText(row.difficulty || "", 60),
        question,
        translations,
        languages: splitLanguages(row.languages),
        metadata: {
          importedFrom: source,
          rowNumber: index + 2
        }
      };
    })
    .filter((entry) => entry.question);
}

export async function importTrainingQuestionsFromCsv(filePath, options = {}) {
  const source = options.source || filePath;
  const raw = await fs.readFile(filePath, "utf8");
  const entries = parseTrainingQuestionsCsv(raw, { source });
  const summary = await upsertTrainingQuestions(entries, { source });
  return {
    source,
    parsed: entries.length,
    ...summary
  };
}
