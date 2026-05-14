import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  Bot,
  Briefcase,
  Check,
  Code2,
  CreditCard,
  FileCode2,
  Globe2,
  Home,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  MessageSquare,
  Search,
  Settings,
  Shield,
  Sparkles,
  User,
  Users,
  Wallet,
  X,
  Zap
} from "lucide-react";
import { api, clearToken, getToken, setToken } from "./services/api.js";
import "./styles.css";

const nav = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "chat", label: "AI Agent Chat", icon: MessageSquare },
  { id: "ai-search", label: "AI Search", icon: Search },
  { id: "website", label: "Website Builder", icon: FileCode2 },
  { id: "research", label: "Research", icon: Globe2 },
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

function App() {
  const [tokenState, setTokenState] = useState(getToken());
  const [user, setUser] = useState(null);
  const [page, setPage] = useState(tokenState ? "dashboard" : "home");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const authed = Boolean(tokenState && user);

  async function refreshMe() {
    if (!getToken()) return;
    try {
      const result = await api("/api/auth/me");
      setUser(result.user);
    } catch {
      clearToken();
      setTokenState("");
      setUser(null);
    }
  }

  useEffect(() => {
    refreshMe();
  }, []);

  async function handleAuth(mode, form) {
    setLoading(true);
    setError("");
    try {
      const result = await api(`/api/auth/${mode}`, {
        method: "POST",
        body: form
      });
      setToken(result.token);
      setTokenState(result.token);
      setUser(result.user);
      setPage("dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    clearToken();
    setTokenState("");
    setUser(null);
    setPage("home");
  }

  if (!authed) {
    return (
      <PublicShell page={page} setPage={setPage}>
        {page === "pricing" && <PricingPage />}
        {page === "login" && <AuthPage mode="login" loading={loading} error={error} onSubmit={handleAuth} />}
        {page === "register" && <AuthPage mode="register" loading={loading} error={error} onSubmit={handleAuth} />}
        {page === "forgot" && <StaticPage title="Forgot Password" text="Password reset is ready at the API architecture level and can be connected to email delivery." />}
        {page === "terms" && <StaticPage title="Terms" text="Use ZYNNOX responsibly. Production deployments should add legal review and tenant-specific terms." />}
        {page === "privacy" && <StaticPage title="Privacy" text="ZYNNOX stores conversations, usage, credits, and generated websites for account functionality." />}
        {page === "home" && <HomePage setPage={setPage} />}
      </PublicShell>
    );
  }

  return (
    <DashboardShell
      user={user}
      page={page}
      setPage={(next) => {
        setPage(next);
        setMobileOpen(false);
      }}
      logout={logout}
      mobileOpen={mobileOpen}
      setMobileOpen={setMobileOpen}
    >
      {page === "dashboard" && <DashboardHome user={user} refreshMe={refreshMe} />}
      {page === "chat" && <ChatPage refreshMe={refreshMe} />}
      {page === "ai-search" && <AiSearchPage refreshMe={refreshMe} />}
      {page === "website" && <WebsitePage refreshMe={refreshMe} />}
      {page === "research" && <ResearchPage />}
      {page === "history" && <HistoryPage />}
      {page === "credits" && <CreditsPage refreshMe={refreshMe} />}
      {page === "billing" && <BillingPage refreshMe={refreshMe} />}
      {page === "profile" && <ProfilePage user={user} setUser={setUser} />}
      {page === "settings" && <SettingsPage />}
      {page === "admin" && <AdminPage kind="overview" />}
      {page === "admin-users" && <AdminPage kind="users" />}
      {page === "admin-usage" && <AdminPage kind="usage" />}
      {page === "admin-websites" && <AdminPage kind="websites" />}
    </DashboardShell>
  );
}

function PublicShell({ children, page, setPage }) {
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

function HomePage({ setPage }) {
  return (
    <main className="home-grid">
      <section className="hero-copy">
        <p className="eyebrow">AI Agent SaaS Platform</p>
        <h1>ZYNNOX builds, researches, reasons, and ships.</h1>
        <p>
          A professional multi-agent workspace with real web search, AI Search, website generation,
          code/security agents, credits, subscriptions, and admin control.
        </p>
        <div className="hero-actions">
          <button className="primary" onClick={() => setPage("register")}>Create account</button>
          <button className="ghost" onClick={() => setPage("pricing")}>View pricing</button>
        </div>
      </section>
      <section className="product-surface">
        <div className="surface-top">
          <span>Agent run</span>
          <span className="status-dot">Live</span>
        </div>
        <div className="agent-row"><Bot /> Router Agent selected Research, Security, UI/UX</div>
        <div className="agent-row"><Globe2 /> Web search returned cited sources</div>
        <div className="agent-row"><FileCode2 /> Website Builder prepared React files</div>
        <div className="agent-row"><Wallet /> Credits checked before execution</div>
      </section>
    </main>
  );
}

function PricingPage() {
  const plans = [
    ["Free", "$0", "25 starter credits", "Basic AI chat", "Limited demo search"],
    ["Starter", "$9", "600 credits/month", "Web search", "Basic website generation"],
    ["Pro", "$29", "2,000 credits/month", "Deep research", "Code and security scans"],
    ["Business", "$79", "6,000 credits/month", "Admin analytics", "Priority workflows"],
    ["Enterprise", "Custom", "Custom credits", "Private deployment", "SLA-ready structure"]
  ];
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

function AuthPage({ mode, loading, error, onSubmit }) {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  return (
    <main className="auth-wrap">
      <form
        className="auth-card"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(mode, form);
        }}
      >
        <span className="brand-mark large">Z</span>
        <h1>{mode === "register" ? "Create your account" : "Welcome back"}</h1>
        {mode === "register" && <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}
        <input placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input placeholder="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        {error && <div className="error-box">{error}</div>}
        <button className="primary" disabled={loading}>{loading ? "Processing..." : mode === "register" ? "Register" : "Login"}</button>
      </form>
    </main>
  );
}

function DashboardShell({ user, page, setPage, logout, mobileOpen, setMobileOpen, children }) {
  const links = user?.role === "admin" ? [...nav, ...adminNav] : nav;
  return (
    <div className="app-shell">
      <aside className={mobileOpen ? "sidebar open" : "sidebar"}>
        <div className="brand-block"><span className="brand-mark">Z</span><strong>ZYNNOX</strong></div>
        <div className="account-pill"><Wallet size={16} /> {user.credits} credits <span>{user.planId}</span></div>
        <nav className="side-nav">
          {links.map((item) => {
            const Icon = item.icon;
            return <button key={item.id} className={page === item.id ? "active" : ""} onClick={() => setPage(item.id)}><Icon size={18} /> {item.label}</button>;
          })}
        </nav>
        <button className="logout" onClick={logout}><LogOut size={17} /> Logout</button>
      </aside>
      <section className="main-shell">
        <header className="topbar">
          <button className="icon-button mobile-only" onClick={() => setMobileOpen(!mobileOpen)}>{mobileOpen ? <X /> : <Menu />}</button>
          <div>
            <p className="eyebrow">Workspace</p>
            <h2>{user.name}</h2>
          </div>
          <div className="top-actions"><span>{user.email}</span><span className="role-pill">{user.role}</span></div>
        </header>
        {children}
      </section>
    </div>
  );
}

function PageTitle({ title, subtitle, action }) {
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

function DashboardHome({ user }) {
  const [stats, setStats] = useLoad("/api/agent/dashboard");
  return (
    <main className="page">
      <PageTitle title="Dashboard" subtitle="Your SaaS AI agent command center." />
      <div className="stats-grid">
        <Stat icon={Wallet} label="Credits" value={user.credits} />
        <Stat icon={Briefcase} label="Plan" value={user.planId} />
        <Stat icon={MessageSquare} label="Conversations" value={stats?.stats?.conversations || 0} />
        <Stat icon={FileCode2} label="Generated websites" value={stats?.stats?.generatedWebsites || 0} />
      </div>
      <div className="panel">
        <h3>Platform capabilities</h3>
        <div className="feature-grid">
          {["Multi-agent chat", "Real web search", "AI Search", "Website Builder", "Credits", "Subscriptions", "Admin analytics", "Security scans"].map((item) => <span key={item}><Zap size={15} /> {item}</span>)}
        </div>
      </div>
    </main>
  );
}

function Stat({ icon: Icon, label, value }) {
  return <div className="stat-card"><Icon /><span>{label}</span><strong>{value}</strong></div>;
}

function ChatPage({ refreshMe }) {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit() {
    if (!message.trim()) return;
    const current = message;
    setMessages((items) => [...items, { role: "user", content: current }]);
    setMessage("");
    setBusy(true);
    setError("");
    try {
      const result = await api("/api/agent/chat", { method: "POST", body: { message: current } });
      setMessages((items) => [...items, { role: "assistant", content: result.answer, meta: result }]);
      refreshMe();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="page chat-page">
      <PageTitle title="AI Agent Chat" subtitle="Estimated cost: 1 credit, or 2 credits when web search is needed." />
      <div className="chat-window">
        {messages.length === 0 && <EmptyState icon={Bot} title="Ask ZYNNOX anything" text="The router will choose specialized agents and search the web when needed." />}
        {messages.map((item, index) => <MessageBubble key={index} message={item} />)}
        {busy && <div className="typing">Agents are thinking, searching, and checking credits...</div>}
      </div>
      {error && <UpgradeNotice message={error} />}
      <div className="composer">
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Ask for research, code help, security review, strategy, or website creation..." />
        <button className="primary" onClick={submit} disabled={busy}>Send</button>
      </div>
    </main>
  );
}

function MessageBubble({ message }) {
  return (
    <div className={`message ${message.role}`}>
      <strong>{message.role === "user" ? "You" : "ZYNNOX"}</strong>
      <p>{message.content}</p>
      {message.meta && (
        <div className="meta-grid">
          <span>Credits used: {message.meta.creditsUsed}</span>
          <span>Remaining: {message.meta.remainingCredits}</span>
          <span>Agents: {message.meta.usedAgents?.join(", ")}</span>
        </div>
      )}
      {message.meta?.sources?.length > 0 && <Sources sources={message.meta.sources} />}
    </div>
  );
}

function AiSearchPage({ refreshMe }) {
  const [query, setQuery] = useState("");
  const [depth, setDepth] = useState("quick");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const cost = { quick: 3, standard: 5, deep: 8 }[depth];
  async function run() {
    setBusy(true);
    setError("");
    try {
      const data = await api("/api/ai-search", { method: "POST", body: { query, depth } });
      setResult(data);
      refreshMe();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="page">
      <PageTitle title="AI Search" subtitle="Research assistant with query planning, source collection, and cited synthesis." />
      <ActionPanel cost={cost} busy={busy} onRun={run} button="Run AI Search">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Research question" />
        <select value={depth} onChange={(e) => setDepth(e.target.value)}><option>quick</option><option>standard</option><option>deep</option></select>
      </ActionPanel>
      {error && <UpgradeNotice message={error} />}
      {result && <ResultPanel result={result} />}
    </main>
  );
}

function WebsitePage({ refreshMe }) {
  const [form, setForm] = useState({ prompt: "", type: "landing", style: "modern", pages: "" });
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const cost = form.type === "fullstack" ? 30 : form.type === "dashboard" || form.type === "admin" ? 15 : 10;
  async function run() {
    setBusy(true);
    setError("");
    try {
      const data = await api("/api/website/create", {
        method: "POST",
        body: { ...form, pages: form.pages.split(",").map((item) => item.trim()).filter(Boolean) }
      });
      setResult(data);
      refreshMe();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="page">
      <PageTitle title="Website Builder" subtitle="Generate React/Tailwind-ready website structures and files." />
      <ActionPanel cost={cost} busy={busy} onRun={run} button="Generate Website">
        <textarea value={form.prompt} onChange={(e) => setForm({ ...form, prompt: e.target.value })} placeholder="Describe the website..." />
        <div className="inline-fields">
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}><option>landing</option><option>dashboard</option><option>ecommerce</option><option>portfolio</option><option>admin</option><option>fullstack</option></select>
          <select value={form.style} onChange={(e) => setForm({ ...form, style: e.target.value })}><option>modern</option><option>dark</option><option>light</option><option>luxury</option><option>minimal</option></select>
        </div>
        <input value={form.pages} onChange={(e) => setForm({ ...form, pages: e.target.value })} placeholder="Optional pages, comma separated" />
      </ActionPanel>
      {error && <UpgradeNotice message={error} />}
      {result && <WebsiteResult result={result} />}
    </main>
  );
}

function ResearchPage() {
  const [history] = useLoad("/api/conversations");
  return (
    <main className="page">
      <PageTitle title="Research Dashboard" subtitle="Review conversations and sourced agent outputs." />
      <DataList items={history?.conversations || []} render={(item) => <><strong>{item.title}</strong><span>{item.messages?.length || 0} messages</span></>} />
    </main>
  );
}

function HistoryPage() {
  const [runs] = useLoad("/api/agent/runs");
  return (
    <main className="page">
      <PageTitle title="Agent Activity" subtitle="Inspect agent runs, steps, credits, and sources." />
      <DataList items={runs?.runs || []} render={(item) => <><strong>{item.input}</strong><span>{item.status} · {item.creditsUsed} credits · {item.usedAgents?.join(", ")}</span></>} />
    </main>
  );
}

function CreditsPage({ refreshMe }) {
  const [data, reload] = useLoad("/api/credits/transactions");
  return (
    <main className="page">
      <PageTitle title="Credits" subtitle="Track credit transactions and usage history." action={<button className="primary small" onClick={refreshMe}>Refresh</button>} />
      <div className="panel">
        <h3>Transactions</h3>
        <DataList items={data?.transactions || []} render={(item) => <><strong>{item.amount > 0 ? "+" : ""}{item.amount} credits</strong><span>{item.reason} · balance {item.balanceAfter}</span></>} />
      </div>
    </main>
  );
}

function BillingPage({ refreshMe }) {
  const [plansData, reloadPlans] = useLoad("/api/billing/plans", { public: true });
  const [subData, reloadSub] = useLoad("/api/billing/subscription");
  const [notice, setNotice] = useState("");
  async function upgrade(planId) {
    const result = await api("/api/billing/demo-upgrade", { method: "POST", body: { planId } });
    setNotice(`Upgraded to ${result.plan.name}. Credits refreshed.`);
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
      {notice && <div className="success-box">{notice}</div>}
      <div className="pricing-grid">
        {(plansData?.plans || []).map((plan) => <div className="panel price-card" key={plan.id}><h3>{plan.name}</h3><strong>{plan.priceMonthly === null ? "Custom" : `$${plan.priceMonthly}/mo`}</strong><p>{plan.monthlyCredits || "Custom"} credits</p><button className="primary small" onClick={() => upgrade(plan.id)}>Upgrade</button></div>)}
      </div>
      <div className="panel">
        <h3>Credit packs</h3>
        <div className="pack-row">{(plansData?.creditPacks || []).map((pack) => <button key={pack.id} className="ghost" onClick={() => buy(pack.id)}>{pack.name} · ${pack.price}</button>)}</div>
      </div>
      <pre>{JSON.stringify(subData?.subscription || {}, null, 2)}</pre>
    </main>
  );
}

function ProfilePage({ user, setUser }) {
  const [form, setForm] = useState({ name: user.name, company: "", timezone: "UTC" });
  const [saved, setSaved] = useState(false);
  async function submit() {
    const result = await api("/api/auth/profile", { method: "PUT", body: form });
    setUser(result.user);
    setSaved(true);
  }
  return (
    <main className="page">
      <PageTitle title="Profile" subtitle="Manage account information." />
      <div className="panel form-panel">
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="Company" />
        <input value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} />
        <button className="primary" onClick={submit}>Save profile</button>
        {saved && <div className="success-box">Profile saved.</div>}
      </div>
    </main>
  );
}

function SettingsPage() {
  return (
    <main className="page">
      <PageTitle title="Settings" subtitle="Production mode, search providers, billing, and database are configured server-side via environment variables." />
      <div className="panel"><pre>{`AI_MODE=demo|production
SEARCH_MODE=demo|production
BILLING_MODE=demo|production
Never expose API keys in the frontend.`}</pre></div>
    </main>
  );
}

function AdminPage({ kind }) {
  const endpoint = kind === "users" ? "/api/admin/users" : kind === "usage" ? "/api/admin/usage" : kind === "websites" ? "/api/admin/generated-websites" : "/api/admin/agent-runs";
  const [data] = useLoad(endpoint);
  const key = Object.keys(data || {}).find((item) => item !== "ok");
  return (
    <main className="page">
      <PageTitle title={`Admin ${kind}`} subtitle="Manage users, usage, subscriptions, agent runs, and generated websites." />
      <div className="panel"><pre>{JSON.stringify(data?.[key] || [], null, 2)}</pre></div>
    </main>
  );
}

function ActionPanel({ cost, busy, onRun, button, children }) {
  return (
    <div className="panel action-panel">
      <div className="cost-pill"><Wallet size={15} /> Estimated cost: {cost} credits</div>
      {children}
      <button className="primary" disabled={busy} onClick={onRun}>{busy ? "Working..." : button}</button>
    </div>
  );
}

function ResultPanel({ result }) {
  return (
    <div className="panel result-panel">
      <h3>Answer</h3>
      <p>{result.answer}</p>
      <div className="meta-grid"><span>Credits used: {result.creditsUsed}</span><span>Remaining: {result.remainingCredits}</span><span>Confidence: {result.confidence}</span></div>
      <Sources sources={result.sources || []} />
    </div>
  );
}

function WebsiteResult({ result }) {
  return (
    <div className="panel result-panel">
      <h3>Generated project</h3>
      <p>{result.instructions}</p>
      <div className="meta-grid"><span>{result.creditsUsed} credits used</span><span>{result.remainingCredits} remaining</span><span>{result.files?.length || 0} files</span></div>
      {(result.files || []).map((file) => <details key={file.path}><summary>{file.path}</summary><pre>{file.content}</pre></details>)}
    </div>
  );
}

function Sources({ sources }) {
  if (!sources?.length) return null;
  return <div className="sources">{sources.map((source, index) => <a key={source.url || index} href={source.url} target="_blank" rel="noreferrer">{index + 1}. {source.title || source.url}</a>)}</div>;
}

function EmptyState({ icon: Icon, title, text }) {
  return <div className="empty"><Icon /><h3>{title}</h3><p>{text}</p></div>;
}

function UpgradeNotice({ message }) {
  return <div className="error-box"><Lock size={16} /> {message}</div>;
}

function DataList({ items, render }) {
  if (!items.length) return <EmptyState icon={Sparkles} title="Nothing here yet" text="Run an agent workflow to populate this view." />;
  return <div className="data-list">{items.map((item, index) => <div className="data-row" key={item.id || index}>{render(item)}</div>)}</div>;
}

function StaticPage({ title, text }) {
  return <main className="page public-page"><PageTitle title={title} subtitle={text} /></main>;
}

function useLoad(endpoint, options = {}) {
  const [data, setData] = useState(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let active = true;
    api(endpoint, { public: options.public }).then((result) => active && setData(result)).catch(() => active && setData(null));
    return () => {
      active = false;
    };
  }, [endpoint, tick]);
  return [data || {}, () => setTick((value) => value + 1)];
}

createRoot(document.getElementById("root")).render(<App />);
