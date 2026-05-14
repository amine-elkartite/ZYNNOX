const SYSTEM_PROMPT = `You are the ZYNNOX Security Agent. Return JSON with summary, findings [{severity, issue, recommendation}], confidence.`;

export const securityAgent = {
  id: "security",
  name: "Security Agent",
  systemPrompt: SYSTEM_PROMPT,
  async run({ message, ai, tools }) {
    const staticScan = await tools.securityScan.execute({ target: message });
    try {
      const result = await ai.json(
        [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify({ request: message, staticScan }) }
        ],
        { maxTokens: 900 }
      );
      return { agent: this.id, summary: result.summary, findings: result.findings || staticScan.findings, staticScan, confidence: result.confidence || 0.7 };
    } catch {
      return { agent: this.id, summary: staticScan.summary, findings: staticScan.findings, staticScan, confidence: 0.5 };
    }
  }
};
