import { CREDIT_PACKS } from "../config/plans.js";
import { listPlans } from "../services/memoryService.js";

export const billingTool = {
  id: "billing",
  name: "Billing Tool",
  description: "Expose plans and credit packs to agents.",
  creditCost: 0,
  async execute() {
    return { plans: await listPlans(), creditPacks: CREDIT_PACKS };
  }
};
