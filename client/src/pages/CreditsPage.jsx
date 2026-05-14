import React from "react";
import { Wallet } from "lucide-react";
import DataList from "../components/common/DataList.jsx";
import PageTitle from "../components/common/PageTitle.jsx";
import { useLoad } from "../hooks/useLoad.js";

export default function CreditsPage({ refreshMe }) {
  const [balance, reloadBalance] = useLoad("/api/credits/balance");
  const [data, reloadTransactions] = useLoad("/api/credits/transactions");

  function refresh() {
    refreshMe();
    reloadBalance();
    reloadTransactions();
  }

  return (
    <main className="page">
      <PageTitle title="Credits" subtitle="Track credit transactions and usage history." action={<button className="primary small" onClick={refresh}>Refresh</button>} />
      <div className="stats-grid">
        <div className="stat-card"><Wallet /><span>Current balance</span><strong>{balance.balance ?? 0}</strong></div>
        <div className="stat-card"><Wallet /><span>Plan</span><strong>{balance.planId || "free"}</strong></div>
        <div className="stat-card"><Wallet /><span>Status</span><strong>{balance.subscriptionStatus || "inactive"}</strong></div>
        <div className="stat-card"><Wallet /><span>Usage rows</span><strong>{data?.usage?.length || 0}</strong></div>
      </div>
      <div className="panel">
        <h3>Transactions</h3>
        <DataList items={data?.transactions || []} render={(item) => <><strong>{item.amount > 0 ? "+" : ""}{item.amount} credits</strong><span>{item.reason} · balance {item.balanceAfter}</span></>} />
      </div>
    </main>
  );
}
