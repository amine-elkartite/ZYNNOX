import { useEffect, useState } from "react";
import { api, clearToken, getToken, setToken } from "../services/api.js";

export function useAuth() {
  const [tokenState, setTokenState] = useState(getToken());
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");

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
    setAuthLoading(true);
    setAuthError("");
    try {
      const result = await api(`/api/auth/${mode}`, {
        method: "POST",
        body: form
      });
      setToken(result.token);
      setTokenState(result.token);
      setUser(result.user);
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setAuthLoading(false);
    }
  }

  function logout() {
    clearToken();
    setTokenState("");
    setUser(null);
  }

  return {
    user,
    setUser,
    tokenState,
    authed: Boolean(tokenState && user),
    authLoading,
    authError,
    handleAuth,
    logout,
    refreshMe
  };
}
