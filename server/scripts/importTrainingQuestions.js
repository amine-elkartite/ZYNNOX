import { fileURLToPath } from "node:url";
import { initializeMemoryService } from "../src/services/memoryService.js";
import { importTrainingQuestionsFromCsv } from "../src/services/trainingQuestionService.js";

const defaultCsvPath = fileURLToPath(new URL("../../archive/python-legacy/data/ai_agent_5000_training_questions_multilingual.csv", import.meta.url));
const csvPath = process.argv[2] || defaultCsvPath;

await initializeMemoryService();
const summary = await importTrainingQuestionsFromCsv(csvPath, { source: "archive/python-legacy/data/ai_agent_5000_training_questions_multilingual.csv" });

console.log(JSON.stringify(summary, null, 2));
