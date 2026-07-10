"use client";

import { useState, useEffect, useCallback } from "react";
import axios from "axios";

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

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

  // Upload a profile picture: push the file to Cloudinary (clients/<slug>/images),
  // persist the returned URL on the user, and keep local state + storage in sync.
  const uploadAvatar = useCallback(async (file) => {
    if (!file) return null;
    if (!file.type?.startsWith("image/")) {
      throw new Error("Please choose an image file");
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new Error("Image must be smaller than 5MB");
    }
    const currentToken = localStorage.getItem("token");
    const headers = currentToken
      ? { Authorization: `Bearer ${currentToken}` }
      : {};
    const stored = JSON.parse(localStorage.getItem("user") || "{}");

    const dataUri = await readAsDataURL(file);
    const { data: uploaded } = await axios.post(
      "/api/upload",
      { file: dataUri, name: file.name, kind: "images" },
      { headers },
    );
    const { data: updated } = await axios.put(
      `/api/users/${stored.id}`,
      { image: uploaded.url },
      { headers },
    );

    const nextUser = { ...stored, image: updated.image ?? uploaded.url };
    localStorage.setItem("user", JSON.stringify(nextUser));
    setUser(nextUser);
    return nextUser.image;
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
    uploadAvatar,
    getAuthHeaders,
    forgotPassword,
    resetPassword,
    verifyEmail,
    resendVerification,
  };
}
