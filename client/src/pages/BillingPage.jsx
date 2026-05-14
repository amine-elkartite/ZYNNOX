import React, { useState } from "react";
import { SuccessNotice } from "../components/common/Feedback.jsx";
import PageTitle from "../components/common/PageTitle.jsx";
import { useLoad } from "../hooks/useLoad.js";
import { api } from "../services/api.js";

export default function BillingPage({ refreshMe }) {
  const [plansData] = useLoad("/api/billing/plans", { public: true });
  const [subData, reloadSub] = useLoad("/api/billing/subscription");
  const [notice, setNotice] = useState("");

  async function upgrade(planId) {
    const result = await api("/api/billing/demo-upgrade", { method: "POST", body: { planId } });
    setNotice(`Upgraded to ${result.plan.name}. Credits synced to the plan allowance.`);
    refreshMe();
    reloadSub();
  }

  async function buy(packId) {
    const result = await api("/api/billing/buy-credits", { method: "POST", body: { packId } });
    setNotice(`Purchased ${result.pack.name}. Remaining credits: ${result.remainingCredits}.`);
    refreshMe();
  }

  return (
    <main className="page">
      <PageTitle title="Billing" subtitle="Demo mode simulates subscriptions and purchases; production mode can connect Stripe." />
      {notice && <SuccessNotice message={notice} />}
      <div className="pricing-grid">
        {(plansData?.plans || []).map((plan) => (
          <div className="panel price-card" key={plan.id}>
            <h3>{plan.name}</h3>
            <strong>{plan.priceMonthly === null ? "Custom" : `$${plan.priceMonthly}/mo`}</strong>
            <p>{plan.monthlyCredits || "Custom"} credits</p>
            {plan.id !== "enterprise" ? <button className="primary small" onClick={() => upgrade(plan.id)}>Upgrade</button> : <span className="coming-soon">Coming soon</span>}
          </div>
        ))}
      </div>
      <div className="panel">
        <h3>Credit packs</h3>
        <div className="pack-row">{(plansData?.creditPacks || []).map((pack) => <button key={pack.id} className="ghost" onClick={() => buy(pack.id)}>{pack.name} · ${pack.price}</button>)}</div>
      </div>
      <pre>{JSON.stringify(subData?.subscription || {}, null, 2)}</pre>
    </main>
  );
}
