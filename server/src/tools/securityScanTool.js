import { codeAnalysisTool } from "./codeAnalysisTool.js";

export const securityScanTool = {
  id: "security-scan",
  name: "Security Scan",
  description: "Run security-focused checks against code or architecture text.",
  creditCost: 3,
  async execute({ target }) {
    const analysis = await codeAnalysisTool.execute({ code: target });
    const checklist = [
      "JWT authentication is required for protected routes.",
      "CORS should allow only configured CLIENT_URL origins.",
      "Payments must validate webhook signatures in production.",
      "Credit deduction must happen server-side only.",
      "Secrets must stay in environment variables."
    ];
    return { ...analysis, checklist };
  }
};
