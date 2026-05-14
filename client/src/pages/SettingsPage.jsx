import React from "react";
import { X } from "lucide-react";
import { useLoad } from "../hooks/useLoad.js";

const categories = ["General", "AI Intelligence", "Personalization", "Speech", "Data Controls", "Security", "Billing"];

function Toggle({ checked = false }) {
  return <span className={checked ? "toggle on" : "toggle"}><span /></span>;
}

export default function SettingsPage() {
  const [data] = useLoad("/api/agent/intelligence");
  const intelligence = data?.intelligence || {};
  const leaderboard = intelligence.leaderboard || [];
  const providerRows = intelligence.configuredProviders || [];
  return (
    <main className="settings-screen">
      <div className="settings-card">
        <aside className="settings-nav">
          <div className="settings-mobile-title">
            <button className="icon-button" type="button"><X size={18} /></button>
            <strong>Settings</strong>
          </div>
          {categories.map((item, index) => (
            <button key={item} className={index === 0 ? "active" : ""} type="button">{item}</button>
          ))}
        </aside>
        <section className="settings-content">
          <header className="settings-header">
            <div>
              <h1>Settings</h1>
              <p>Configure how ZYNNOX behaves across the workspace.</p>
            </div>
            <button className="icon-button" type="button" aria-label="Close settings"><X size={18} /></button>
          </header>
          <h2>General</h2>
          <div className="setting-row"><div><strong>Theme</strong><span>Dark mode only</span></div><select defaultValue="dark"><option value="dark">Dark</option></select></div>
          <div className="setting-row"><div><strong>Model</strong><span>Default agent model</span></div><select defaultValue="zynnox-gpt"><option value="zynnox-gpt">ZYNNOX GPT</option></select></div>
          <div className="setting-row"><div><strong>Web search</strong><span>Allow agents to use configured search providers</span></div><Toggle checked /></div>
          <h2>AI Intelligence</h2>
          <div className="intelligence-summary">
            <span>Total queries: <strong>{intelligence.totalQueries || 0}</strong></span>
            <span>Knowledge base: <strong>{intelligence.knowledgeEntries || 0}</strong></span>
            <span>Learned facts: <strong>{intelligence.knowledgeFacts || 0}</strong></span>
          </div>
          <div className="leaderboard-table">
            <div className="leaderboard-row head"><span>Provider</span><span>Math</span><span>Code</span><span>News</span><span>Creative</span></div>
            {leaderboard.length === 0 && <div className="leaderboard-row"><span>No provider telemetry yet</span><span>-</span><span>-</span><span>-</span><span>-</span></div>}
            {leaderboard.map((row) => (
              <div className="leaderboard-row" key={row.provider}>
                <span>{row.provider}</span><span>{row.math || 0}%</span><span>{row.coding || 0}%</span><span>{row.news || 0}%</span><span>{row.creative || 0}%</span>
              </div>
            ))}
          </div>
          <div className="provider-status-grid">
            {providerRows.map((row) => (
              <div className="provider-status" key={row.provider}>
                <strong>{row.provider}</strong>
                <span>{row.configured ? row.model : "Missing API key"}</span>
              </div>
            ))}
          </div>
          <h2>Personalization</h2>
          <div className="setting-row"><div><strong>Response style</strong><span>Balanced responses for production work</span></div><select defaultValue="balanced"><option value="balanced">Balanced</option><option value="concise">Concise</option></select></div>
          <div className="setting-row"><div><strong>Credit warnings</strong><span>Show low-balance notices before paid actions</span></div><Toggle checked /></div>
          <h2>Security</h2>
          <div className="setting-row"><div><strong>JWT sessions</strong><span>Managed by the server</span></div><button className="ghost" type="button">View status</button></div>
          <h2 className="danger-heading">Danger zone</h2>
          <div className="setting-row danger-row"><div><strong>Clear local session</strong><span>Remove the browser token from this device</span></div><button className="danger-button" type="button">Clear</button></div>
        </section>
      </div>
    </main>
  );
}
