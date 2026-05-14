import React from "react";
export default function EmptyState({ icon: Icon, title, text }) {
  return <div className="empty"><Icon /><h3>{title}</h3><p>{text}</p></div>;
}
