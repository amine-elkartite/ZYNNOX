import React from "react";
import {
  Activity,
  ChevronDown,
  Code2,
  Edit3,
  CreditCard,
  FileCode2,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  MoreHorizontal,
  Search,
  Settings,
  Shield,
  User,
  Users,
  Wallet,
  X
} from "lucide-react";

const nav = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "chat", label: "AI Agent Chat", icon: MessageSquare },
  { id: "ai-search", label: "AI Search", icon: Search },
  { id: "website", label: "Website Builder", icon: FileCode2 },
  { id: "history", label: "Conversations", icon: Activity },
  { id: "credits", label: "Credits", icon: Wallet },
  { id: "billing", label: "Billing", icon: CreditCard },
  { id: "profile", label: "Profile", icon: User },
  { id: "settings", label: "Settings", icon: Settings }
];

const adminNav = [
  { id: "admin", label: "Admin Overview", icon: Shield },
  { id: "admin-users", label: "Users", icon: Users },
  { id: "admin-usage", label: "Usage Analytics", icon: Activity },
  { id: "admin-websites", label: "Generated Websites", icon: Code2 }
];

function SidebarSection({ label, items, page, setPage }) {
  if (!items.length) return null;
  return (
    <section className="sidebar-section">
      <p>{label}</p>
      {items.map((item) => {
        const Icon = item.icon;
        return <button key={item.id} className={page === item.id ? "active" : ""} onClick={() => setPage(item.id)}><Icon size={18} /> {item.label}</button>;
      })}
    </section>
  );
}

export default function DashboardShell({ user, page, setPage, logout, mobileOpen, setMobileOpen, children }) {
  const adminLinks = user?.role === "admin" ? adminNav : [];
  return (
    <div className="app-shell">
      {mobileOpen && <button className="sidebar-backdrop" aria-label="Close menu" onClick={() => setMobileOpen(false)} />}
      <aside className={mobileOpen ? "sidebar open" : "sidebar"}>
        <div className="sidebar-head">
          <button className="brand-block" onClick={() => setPage("dashboard")}><span className="brand-mark">Z</span><strong>ZYNNOX</strong></button>
          <button className="icon-button new-chat-button" onClick={() => setPage("chat")} aria-label="New chat" title="New chat"><Edit3 size={18} /></button>
        </div>
        <div className="account-pill"><Wallet size={16} /> {user.credits} credits <span>{user.planId}</span></div>
        <nav className="side-nav">
          <SidebarSection label="Today" items={nav.slice(0, 5)} page={page} setPage={setPage} />
          <SidebarSection label="Yesterday" items={nav.slice(5, 8)} page={page} setPage={setPage} />
          <SidebarSection label="Previous 7 days" items={[nav[8], ...adminLinks]} page={page} setPage={setPage} />
        </nav>
        <div className="sidebar-user">
          <div className="avatar">{user.name?.[0]?.toUpperCase() || "Z"}</div>
          <div><strong>{user.name}</strong><span>{user.role}</span></div>
          <button className="icon-button" onClick={() => setPage("settings")} aria-label="Settings"><MoreHorizontal size={19} /></button>
        </div>
        <button className="logout" onClick={logout}><LogOut size={17} /> Logout</button>
      </aside>
      <section className="main-shell">
        <header className="topbar">
          <button className="icon-button mobile-only" onClick={() => setMobileOpen(!mobileOpen)}>{mobileOpen ? <X /> : <Menu />}</button>
          <div className="topbar-spacer" />
          <button className="model-selector" type="button">
            ZYNNOX GPT <ChevronDown size={16} />
          </button>
          <div className="top-actions">
            <span>{user.email}</span>
            <span className="role-pill">{user.role}</span>
          </div>
        </header>
        {children}
      </section>
    </div>
  );
}
