import React, { useState } from "react";
import { Apple, Chrome } from "lucide-react";

export default function AuthPage({ mode, loading, error, onSubmit, setPage = () => {} }) {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const isRegister = mode === "register";
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
        <h1>{isRegister ? "Create your account" : "Welcome back"}</h1>
        {isRegister && <input placeholder="Name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />}
        <input placeholder="Email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
        <input placeholder="Password" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
        {error && <div className="error-box">{error}</div>}
        <button className="primary" disabled={loading}>{loading ? "Processing..." : isRegister ? "Sign up" : "Log in"}</button>
        <div className="auth-divider"><span>OR</span></div>
        <button className="social-button" type="button"><Chrome size={18} /> Continue with Google</button>
        <button className="social-button" type="button"><span className="social-glyph">M</span> Continue with Microsoft</button>
        <button className="social-button" type="button"><Apple size={18} /> Continue with Apple</button>
        <p className="auth-footer">
          {isRegister ? "Already have an account?" : "Don't have an account?"}
          <button type="button" onClick={() => setPage(isRegister ? "login" : "register")}>{isRegister ? "Log in" : "Sign up"}</button>
        </p>
      </form>
    </main>
  );
}
