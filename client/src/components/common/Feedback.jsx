import React from "react";
import { Lock } from "lucide-react";

export function UpgradeNotice({ message }) {
  return <div className="error-box"><Lock size={16} /> {message}</div>;
}

export function SuccessNotice({ message }) {
  return <div className="success-box">{message}</div>;
}
