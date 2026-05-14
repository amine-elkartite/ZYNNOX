import React from "react";
import { Sparkles } from "lucide-react";
import EmptyState from "./EmptyState.jsx";

export default function DataList({ items, render }) {
  if (!items.length) {
    return <EmptyState icon={Sparkles} title="Nothing here yet" text="Run an agent workflow to populate this view." />;
  }
  return <div className="data-list">{items.map((item, index) => <div className="data-row" key={item.id || index}>{render(item)}</div>)}</div>;
}
