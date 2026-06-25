"use client";

import { useState, useEffect, useCallback } from "react";
import axios from "axios";

export function useAuth() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (email, password) => {
    const response = await axios.post("/api/auth/login", { email, password });
    const { token: newToken, user: userData } = response.data;
    localStorage.setItem("token", newToken);
    localStorage.setItem("user", JSON.stringify(userData));
    setToken(newToken);
    setUser(userData);
    return userData;
  }, []);

  const register = useCallback(async (name, email, password) => {
    const response = await axios.post("/api/auth/register", {
      name,
      email,
      password,
    });
    const { token: newToken, user: userData } = response.data;
    localStorage.setItem("token", newToken);
    localStorage.setItem("user", JSON.stringify(userData));
    setToken(newToken);
    setUser(userData);
    return userData;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
  }, []);

  const getAuthHeaders = useCallback(() => {
    // Uvek čitaj iz localStorage za sigurnost
    const currentToken = localStorage.getItem("token");
    return currentToken ? { Authorization: `Bearer ${currentToken}` } : {};
  }, []);

  const forgotPassword = useCallback(async (email) => {
    const res = await axios.post("/api/auth/forgot-password", { email });
    return res.data;
  }, []);

  const resetPassword = useCallback(async (token, password) => {
    const res = await axios.post("/api/auth/reset-password", {
      token,
      password,
    });
    return res.data;
  }, []);

  const verifyEmail = useCallback(async (token) => {
    const res = await axios.post("/api/auth/verify-email", { token });
    // Keep the cached user in sync so the "verify your email" banner clears
    const stored = localStorage.getItem("user");
    if (stored) {
      const u = { ...JSON.parse(stored), emailVerified: true };
      localStorage.setItem("user", JSON.stringify(u));
      setUser(u);
    }
    return res.data;
  }, []);

  const resendVerification = useCallback(async () => {
    const currentToken = localStorage.getItem("token");
    const res = await axios.post(
      "/api/auth/resend-verification",
      {},
      { headers: currentToken ? { Authorization: `Bearer ${currentToken}` } : {} },
    );
    return res.data;
  }, []);

  return {
    user,
    token,
    loading,
    isAuthenticated: !!token,
    isAdmin: user?.isAdmin || false,
    login,
    register,
    logout,
    getAuthHeaders,
    forgotPassword,
    resetPassword,
    verifyEmail,
    resendVerification,
  };
}
