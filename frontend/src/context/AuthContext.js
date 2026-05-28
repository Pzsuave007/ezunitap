import { createContext, useContext, useEffect, useState, useCallback } from "react";
import api from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    const token = localStorage.getItem("sf_token");
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch {
      localStorage.removeItem("sf_token");
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("sf_token", data.token);
    setUser(data.user);
    return data.user;
  };

  const register = async (payload) => {
    const { data } = await api.post("/auth/register", payload);
    localStorage.setItem("sf_token", data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem("sf_token");
    localStorage.removeItem("sf_admin_token");
    localStorage.removeItem("sf_admin_email");
    setUser(null);
  };

  // Super-admin only: swap into another user's session.
  // Stashes the admin's own token in localStorage so they can return.
  const impersonate = async (targetUserId) => {
    const adminToken = localStorage.getItem("sf_token");
    const { data } = await api.post(`/admin/users/${targetUserId}/impersonate`);
    if (adminToken) {
      localStorage.setItem("sf_admin_token", adminToken);
      // store current user email so the banner can label "Volver a {admin}"
      if (user?.email) localStorage.setItem("sf_admin_email", user.email);
    }
    localStorage.setItem("sf_token", data.token);
    setUser(data.user);
    return data.user;
  };

  const endImpersonation = async () => {
    const adminToken = localStorage.getItem("sf_admin_token");
    if (!adminToken) return;
    localStorage.setItem("sf_token", adminToken);
    localStorage.removeItem("sf_admin_token");
    localStorage.removeItem("sf_admin_email");
    await fetchMe();
  };

  const isImpersonating = typeof window !== "undefined"
    ? !!localStorage.getItem("sf_admin_token")
    : false;

  const refreshUser = fetchMe;

  return (
    <AuthContext.Provider
      value={{
        user, loading, login, register, logout, refreshUser,
        impersonate, endImpersonation, isImpersonating,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
