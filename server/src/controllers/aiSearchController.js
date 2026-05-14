import { z } from "zod";
import { runAiSearch } from "../services/aiSearchService.js";

export const aiSearchSchema = z.object({
  query: z.string().min(1).max(1000),
  depth: z.enum(["quick", "standard", "deep"]).default("quick")
});

export async function aiSearch(request, response) {
  response.json({ ok: true, ...(await runAiSearch({ userId: request.user.id, query: request.body.query, depth: request.body.depth })) });
}
