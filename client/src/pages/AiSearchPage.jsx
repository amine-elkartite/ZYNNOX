import React, { useState } from "react";
import ActionPanel from "../components/common/ActionPanel.jsx";
import { UpgradeNotice } from "../components/common/Feedback.jsx";
import PageTitle from "../components/common/PageTitle.jsx";
import Sources from "../components/common/Sources.jsx";
import { api } from "../services/api.js";

function ResultPanel({ result }) {
  return (
    <div className="panel result-panel">
      <h3>Answer</h3>
      <p>{result.answer}</p>
      <div className="meta-grid"><span>Credits used: {result.creditsUsed}</span><span>Remaining: {result.remainingCredits}</span><span>Confidence: {result.confidence}</span></div>
      <Sources sources={result.sources || []} />
    </div>
  );
}

export default function AiSearchPage({ refreshMe }) {
  const [query, setQuery] = useState("");
  const [depth, setDepth] = useState("quick");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const cost = { quick: 3, standard: 5, deep: 8 }[depth];

  async function run() {
    if (!query.trim()) return;
    setBusy(true);
    setError("");
    try {
      const data = await api("/api/ai-search", { method: "POST", body: { query, depth } });
      setResult(data);
      refreshMe();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page">
      <PageTitle title="AI Search" subtitle="Research assistant with query planning, source collection, and cited synthesis." />
      <ActionPanel cost={cost} busy={busy} onRun={run} button="Run AI Search">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Research question" />
        <select value={depth} onChange={(event) => setDepth(event.target.value)}><option>quick</option><option>standard</option><option>deep</option></select>
      </ActionPanel>
      {error && <UpgradeNotice message={error} />}
      {result && <ResultPanel result={result} />}
    </main>
  );
}
