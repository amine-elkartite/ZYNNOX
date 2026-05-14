import { assertCredits, getBalance } from "../services/creditService.js";

export const creditTool = {
  id: "credit",
  name: "Credit Tool",
  description: "Check balances and validate action affordability.",
  creditCost: 0,
  async execute({ userId, requiredCredits = 0 }) {
    const balance = await getBalance(userId);
    if (requiredCredits) await assertCredits(userId, requiredCredits);
    return { ...balance, requiredCredits };
  }
};
