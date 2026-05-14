import React, { useState } from "react";
import PublicShell from "./components/layout/PublicShell.jsx";
import DashboardShell from "./components/layout/DashboardShell.jsx";
import PageTitle from "./components/common/PageTitle.jsx";
import { useAuth } from "./hooks/useAuth.js";
import HomePage from "./pages/HomePage.jsx";
import PricingPage from "./pages/PricingPage.jsx";
import AuthPage from "./pages/AuthPage.jsx";
import DashboardHome from "./pages/DashboardHome.jsx";
import ChatPage from "./pages/ChatPage.jsx";
import AiSearchPage from "./pages/AiSearchPage.jsx";
import WebsitePage from "./pages/WebsitePage.jsx";
import CreditsPage from "./pages/CreditsPage.jsx";
import BillingPage from "./pages/BillingPage.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";
import AdminPage from "./pages/AdminPage.jsx";
import HistoryPage from "./pages/HistoryPage.jsx";

function StaticPage({ title, text }) {
  return <main className="page public-page"><PageTitle title={title} subtitle={text} /></main>;
}

export default function App() {
  const { user, setUser, tokenState, authed, authLoading, authError, handleAuth, logout, refreshMe } = useAuth();
  const [page, setPage] = useState(tokenState ? "dashboard" : "home");
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!authed) {
    return (
      <PublicShell page={page} setPage={setPage}>
        {page === "pricing" && <PricingPage />}
        {page === "login" && <AuthPage mode="login" loading={authLoading} error={authError} onSubmit={handleAuth} setPage={setPage} />}
        {page === "register" && <AuthPage mode="register" loading={authLoading} error={authError} onSubmit={handleAuth} setPage={setPage} />}
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
      {page === "dashboard" && <DashboardHome user={user} />}
      {page === "chat" && <ChatPage refreshMe={refreshMe} />}
      {page === "ai-search" && <AiSearchPage refreshMe={refreshMe} />}
      {page === "website" && <WebsitePage refreshMe={refreshMe} />}
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
