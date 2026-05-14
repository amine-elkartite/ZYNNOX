import React from "react";
import { Check } from "lucide-react";
import PageTitle from "../components/common/PageTitle.jsx";

const plans = [
  ["Free", "$0", "25 starter credits", "Basic AI chat", "Limited demo search"],
  ["Starter", "$9", "600 credits/month", "Web search", "Basic website generation"],
  ["Pro", "$29", "2,000 credits/month", "Deep research", "Code and security scans"],
  ["Business", "$79", "6,000 credits/month", "Admin analytics", "Priority workflows"],
  ["Enterprise", "Custom", "Custom credits", "Private deployment", "SLA-ready structure"]
];

export default function PricingPage() {
  return (
    <main className="page public-page">
      <PageTitle title="Pricing" subtitle="Credit-backed plans for individual builders and teams." />
      <div className="pricing-grid">
        {plans.map((plan) => (
          <div className="panel price-card" key={plan[0]}>
            <h3>{plan[0]}</h3>
            <strong>{plan[1]}</strong>
            {plan.slice(2).map((item) => <p key={item}><Check size={15} /> {item}</p>)}
          </div>
        ))}
      </div>
    </main>
  );
}
