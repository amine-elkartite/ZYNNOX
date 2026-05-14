import { assertCredits } from "../services/creditService.js";

export function requireCredits(costResolver) {
  return async (request, _response, next) => {
    try {
      const requiredCredits = typeof costResolver === "function" ? costResolver(request) : Number(costResolver || 0);
      const creditInfo = await assertCredits(request.user.id, requiredCredits);
      request.creditInfo = { ...creditInfo, requiredCredits };
      next();
    } catch (error) {
      next(error);
    }
  };
}
