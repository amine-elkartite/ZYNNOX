import { createServer } from "node:http";
import { createApp } from "./app.js";
import { assertRuntimeConfig, env } from "./config/env.js";
import { closeDatabase } from "./database/db.js";
import { initializeMemoryService } from "./services/memoryService.js";

assertRuntimeConfig();
await initializeMemoryService();

const server = createServer(createApp());

server.listen(env.port, () => {
  console.log(`ZYNNOX API running on http://localhost:${env.port}`);
});

async function shutdown(signal) {
  console.log(`${signal} received. Closing ZYNNOX API.`);
  server.close(async () => {
    await closeDatabase();
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
