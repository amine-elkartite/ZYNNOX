import React from "react";
import { Briefcase, FileCode2, MessageSquare, Wallet, Zap } from "lucide-react";
import PageTitle from "../components/common/PageTitle.jsx";
import { useLoad } from "../hooks/useLoad.js";

function Stat({ icon: Icon, label, value }) {
  return <div className="stat-card"><Icon /><span>{label}</span><strong>{value}</strong></div>;
}

export default function DashboardHome({ user }) {
  const [stats] = useLoad("/api/agent/dashboard");
  return (
    <main className="page">
      <PageTitle title="Dashboard" subtitle="Your SaaS AI agent command center." />
      <div className="stats-grid">
        <Stat icon={Wallet} label="Credits" value={stats?.stats?.credits ?? user.credits} />
        <Stat icon={Briefcase} label="Plan" value={stats?.stats?.planId || user.planId} />
        <Stat icon={MessageSquare} label="Conversations" value={stats?.stats?.conversations || 0} />
        <Stat icon={FileCode2} label="Generated websites" value={stats?.stats?.generatedWebsites || 0} />
      </div>
      <div className="panel">
        <h3>Platform capabilities</h3>
        <div className="feature-grid">
          {["Multi-agent chat", "Real web search", "AI Search", "Website Builder", "Credits", "Subscriptions", "Admin analytics", "Security scans"].map((item) => <span key={item}><Zap size={15} /> {item}</span>)}
        </div>
      </div>
    </main>
  );
}
