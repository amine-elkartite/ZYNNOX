import React from "react";
export default function PublicShell({ children, page, setPage }) {
  return (
    <div className="public-shell">
      <header className="public-header">
        <button className="brand-inline" onClick={() => setPage("home")}>
          <span className="brand-mark">Z</span>
          <span>ZYNNOX</span>
        </button>
        <nav>
          <button className={page === "pricing" ? "active" : ""} onClick={() => setPage("pricing")}>Pricing</button>
          <button onClick={() => setPage("login")}>Login</button>
          <button className="primary small" onClick={() => setPage("register")}>Start free</button>
        </nav>
      </header>
      {children}
    </div>
  );
}
