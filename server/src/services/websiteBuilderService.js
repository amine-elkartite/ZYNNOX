import { websiteBuilderAgent } from "../agents/websiteBuilderAgent.js";
import { websiteCost } from "../config/creditCosts.js";
import { aiProviderService } from "./aiProviderService.js";
import { assertCredits, chargeForAction } from "./creditService.js";
import { saveGeneratedWebsite } from "./memoryService.js";

export async function createWebsite({ userId, prompt, type, style, pages }) {
  const credits = websiteCost(type);
  await assertCredits(userId, credits);
  const generated = await websiteBuilderAgent.run({ prompt, type, style, pages, ai: aiProviderService });
  const saved = await saveGeneratedWebsite({
    userId,
    prompt,
    type,
    style,
    projectStructure: generated.projectStructure,
    files: generated.files,
    instructions: generated.instructions,
    previewNotes: generated.previewNotes,
    creditsUsed: credits
  });
  const charge = await chargeForAction({
    userId,
    credits,
    actionType: `website_${type}`,
    referenceType: "generated_website",
    referenceId: saved.id,
    metadata: { type, style, pages }
  });
  return {
    projectStructure: generated.projectStructure,
    files: generated.files,
    instructions: generated.instructions,
    previewNotes: generated.previewNotes,
    creditsUsed: credits,
    remainingCredits: charge.user.credits,
    websiteId: saved.id
  };
}
