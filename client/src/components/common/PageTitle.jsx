import React from "react";
export default function PageTitle({ title, subtitle, action }) {
  return (
    <div className="page-title">
      <div>
        <p className="eyebrow">ZYNNOX</p>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {action}
    </div>
  );
}
