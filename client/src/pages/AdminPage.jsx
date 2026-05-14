import React from "react";
import DataList from "../components/common/DataList.jsx";
import PageTitle from "../components/common/PageTitle.jsx";
import { useLoad } from "../hooks/useLoad.js";

const adminViews = {
  overview: {
    title: "Admin Overview",
    subtitle: "Inspect recent agent runs and operational activity.",
    endpoint: "/api/admin/agent-runs",
    key: "agentRuns"
  },
  users: {
    title: "Admin Users",
    subtitle: "Review registered users and account state.",
    endpoint: "/api/admin/users",
    key: "users"
  },
  usage: {
    title: "Admin Usage",
    subtitle: "Review usage logs and credit activity.",
    endpoint: "/api/admin/usage",
    key: "usage"
  },
  websites: {
    title: "Generated Websites",
    subtitle: "Inspect generated website projects.",
    endpoint: "/api/admin/generated-websites",
    key: "generatedWebsites"
  }
};

function labelFor(item) {
  return item.email || item.actionType || item.input || item.prompt || item.id;
}

function detailFor(item) {
  return item.role || item.status || item.createdAt || `${item.creditsUsed || 0} credits`;
}

export default function AdminPage({ kind }) {
  const view = adminViews[kind] || adminViews.overview;
  const [data] = useLoad(view.endpoint);
  const items = data?.[view.key] || [];
  return (
    <main className="page">
      <PageTitle title={view.title} subtitle={view.subtitle} />
      <div className="panel">
        <DataList items={items} render={(item) => <><strong>{labelFor(item)}</strong><span>{detailFor(item)}</span></>} />
      </div>
    </main>
  );
}
