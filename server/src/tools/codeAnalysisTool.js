import { cleanText } from "../utils/validation.js";

const PATTERNS = [
  { type: "private-key", severity: "critical", pattern: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/i },
  { type: "jwt-token", severity: "high", pattern: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
  { type: "hardcoded-secret", severity: "high", pattern: /(api[_-]?key|secret|token|password)\s*[:=]\s*["'][^"']{12,}["']/i },
  { type: "wildcard-cors", severity: "medium", pattern: /Access-Control-Allow-Origin["']?\s*[:,]\s*["']\*/i },
  { type: "unsafe-eval", severity: "high", pattern: /\beval\s*\(|new Function\s*\(/ }
];

export const codeAnalysisTool = {
  id: "code-analysis",
  name: "Code Analysis",
  description: "Detect common code quality and secret risks.",
  creditCost: 2,
  async execute({ code }) {
    const content = cleanText(code, 50000);
    const findings = PATTERNS.filter((pattern) => pattern.pattern.test(content)).map((pattern) => ({
      type: pattern.type,
      severity: pattern.severity,
      recommendation: `Review ${pattern.type} and move risky values or behavior behind safer controls.`
    }));
    return {
      summary: findings.length ? `${findings.length} issue(s) detected.` : "No common high-risk patterns detected.",
      findings
    };
  }
};
