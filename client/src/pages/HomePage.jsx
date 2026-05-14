import React from "react";
import { Bot, FileCode2, Globe2, Wallet } from "lucide-react";

export default function HomePage({ setPage }) {
  return (
    <main className="home-grid">
      <section className="hero-copy">
        <p className="eyebrow">AI Agent SaaS Platform</p>
        <h1>ZYNNOX builds, researches, reasons, and ships.</h1>
        <p>
          A professional multi-agent workspace with real web search, AI Search, website generation,
          code/security agents, credits, subscriptions, and admin control.
        </p>
        <div className="hero-actions">
          <button className="primary" onClick={() => setPage("register")}>Create account</button>
          <button className="ghost" onClick={() => setPage("pricing")}>View pricing</button>
        </div>
      </section>
      <section className="product-surface">
        <div className="surface-top">
          <span>Agent run</span>
          <span className="status-dot">Live</span>
        </div>
        <div className="agent-row"><Bot /> Router Agent selected Research, Security, UI/UX</div>
        <div className="agent-row"><Globe2 /> Web search returned cited sources</div>
        <div className="agent-row"><FileCode2 /> Website Builder prepared React files</div>
        <div className="agent-row"><Wallet /> Credits checked before execution</div>
      </section>
    </main>
  );
}
