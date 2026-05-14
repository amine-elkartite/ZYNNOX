import React, { useState } from "react";
import { SuccessNotice } from "../components/common/Feedback.jsx";
import PageTitle from "../components/common/PageTitle.jsx";
import { api } from "../services/api.js";

export default function ProfilePage({ user, setUser }) {
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
        <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        <input value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })} placeholder="Company" />
        <input value={form.timezone} onChange={(event) => setForm({ ...form, timezone: event.target.value })} />
        <button className="primary" onClick={submit}>Save profile</button>
        {saved && <SuccessNotice message="Profile saved." />}
      </div>
    </main>
  );
}
