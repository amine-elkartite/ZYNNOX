import React from "react";
import { Wallet } from "lucide-react";

export default function ActionPanel({ cost, busy, onRun, button, children }) {
  return (
    <div className="panel action-panel">
      <div className="cost-pill"><Wallet size={15} /> Estimated cost: {cost} credits</div>
      {children}
      <button className="primary" disabled={busy} onClick={onRun}>{busy ? "Working..." : button}</button>
    </div>
  );
}
