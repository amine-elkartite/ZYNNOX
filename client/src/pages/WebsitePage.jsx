import React, { useState } from "react";
import ActionPanel from "../components/common/ActionPanel.jsx";
import { UpgradeNotice } from "../components/common/Feedback.jsx";
import PageTitle from "../components/common/PageTitle.jsx";
import { api } from "../services/api.js";

function WebsiteResult({ result }) {
  return (
    <div className="panel result-panel">
      <h3>Generated project</h3>
      <p>{result.instructions}</p>
      <div className="meta-grid"><span>{result.creditsUsed} credits used</span><span>{result.remainingCredits} remaining</span><span>{result.files?.length || 0} files</span></div>
      {(result.files || []).map((file) => <details key={file.path}><summary>{file.path}</summary><pre>{file.content}</pre></details>)}
    </div>
  );
}

export default function WebsitePage({ refreshMe }) {
  const [form, setForm] = useState({ prompt: "", type: "landing", style: "modern", pages: "" });
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const cost = form.type === "fullstack" ? 30 : form.type === "dashboard" || form.type === "admin" ? 15 : 10;

  async function run() {
    if (!form.prompt.trim()) return;
    setBusy(true);
    setError("");
    try {
      const data = await api("/api/website/create", {
        method: "POST",
        body: { ...form, pages: form.pages.split(",").map((item) => item.trim()).filter(Boolean) }
      });
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
      <PageTitle title="Website Builder" subtitle="Generate React/Tailwind-ready website structures and files." />
      <ActionPanel cost={cost} busy={busy} onRun={run} button="Generate Website">
        <textarea value={form.prompt} onChange={(event) => setForm({ ...form, prompt: event.target.value })} placeholder="Describe the website..." />
        <div className="inline-fields">
          <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}><option>landing</option><option>dashboard</option><option>ecommerce</option><option>portfolio</option><option>admin</option><option>fullstack</option></select>
          <select value={form.style} onChange={(event) => setForm({ ...form, style: event.target.value })}><option>modern</option><option>dark</option><option>light</option><option>luxury</option><option>minimal</option></select>
        </div>
        <input value={form.pages} onChange={(event) => setForm({ ...form, pages: event.target.value })} placeholder="Optional pages, comma separated" />
      </ActionPanel>
      {error && <UpgradeNotice message={error} />}
      {result && <WebsiteResult result={result} />}
    </main>
  );
}
