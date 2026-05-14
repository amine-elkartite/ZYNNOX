import { z } from "zod";
import { createWebsite } from "../services/websiteBuilderService.js";
import { listGeneratedWebsites } from "../services/memoryService.js";

export const websiteSchema = z.object({
  prompt: z.string().min(5).max(4000),
  type: z.enum(["landing", "dashboard", "ecommerce", "portfolio", "admin", "fullstack"]).default("landing"),
  style: z.enum(["modern", "dark", "light", "luxury", "minimal"]).default("modern"),
  pages: z.array(z.string().max(80)).max(20).default([])
});

export async function create(request, response) {
  response.json({ ok: true, ...(await createWebsite({ userId: request.user.id, ...request.body })) });
}

export async function generated(request, response) {
  response.json({ ok: true, websites: await listGeneratedWebsites(request.user.id) });
}
