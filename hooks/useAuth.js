"use client";

import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { readAsDataURL } from "@/lib/utils";

const SESSION_CHANGED_EVENT = "dmdevelon:session-changed";
const SESSION_CLEARED_EVENT = "dmdevelon:session-cleared";
let refreshPromise = null;
let authInterceptorInstalled = false;

function readStoredSession() {
  try {
    const token = localStorage.getItem("token");
    const rawUser = localStorage.getItem("user");
    return { token, user: rawUser ? JSON.parse(rawUser) : null };
  } catch {
    return { token: null, user: null };
  }
}

function announceSessionChange() {
  window.dispatchEvent(new Event(SESSION_CHANGED_EVENT));
}

function clearStoredSession() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  announceSessionChange();
  window.dispatchEvent(new Event(SESSION_CLEARED_EVENT));
}

function storeSession(token, user) {
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));
  announceSessionChange();
}

// All existing API calls use axios directly. Install one interceptor on that
// shared client so every protected area (client dashboard and admin alike)
// transparently receives a renewed access token after a 401.
function installAuthRefreshInterceptor() {
  if (authInterceptorInstalled || typeof window === "undefined") return;
  authInterceptorInstalled = true;

  axios.interceptors.response.use(
    (response) => response,
    async (error) => {
      const request = error.config;
      const status = error.response?.status;
      const url = String(request?.url || "");
      // auth/me is intentionally *not* skipped: it is the first protected
      // request on app load and must be able to renew an expired access token.
      const skipRefresh =
        request._dmdevelonSkipRefresh ||
        [
          "/api/auth/refresh",
          "/api/auth/login",
          "/api/auth/register",
          "/api/auth/logout",
          "/api/auth/forgot-password",
          "/api/auth/reset-password",
          "/api/auth/verify-email",
        ].some((path) => url.includes(path));

      if (!request || status !== 401 || skipRefresh) {
        return Promise.reject(error);
      }

      if (request._dmdevelonSessionRetried) {
        return Promise.reject(error);
      }
      request._dmdevelonSessionRetried = true;

      try {
        if (!refreshPromise) {
          refreshPromise = axios
            .post("/api/auth/refresh", {}, { _dmdevelonSkipRefresh: true })
            .then((response) => {
              if (!response.data?.token || !response.data?.user) {
                throw new Error("Invalid refresh response");
              }
              storeSession(response.data.token, response.data.user);
              return response.data.token;
            })
            .finally(() => {
              refreshPromise = null;
            });
        }
        const token = await refreshPromise;
        request.headers = {
          ...(request.headers || {}),
          Authorization: `Bearer ${token}`,
        };
        return axios(request);
      } catch (refreshError) {
        clearStoredSession();
        return Promise.reject(error);
      }
    },
  );
}

export function useAuth() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Pull the latest user from the server and refresh the cached copy. The
  // localStorage user is only written at login, so fields like emailVerified /
  // name / image can go stale (e.g. verified after that login) — this re-syncs.
  const refreshUser = useCallback(async () => {
    const currentToken = localStorage.getItem("token");
    if (!currentToken) return null;
    try {
      const res = await axios.get("/api/auth/me", {
        headers: { Authorization: `Bearer ${currentToken}` },
      });
      const fresh = res.data;
      if (fresh && fresh._id) {
        storeSession(currentToken, fresh);
        setUser(fresh);
        return fresh;
      }
    } catch (e) {
      // Keep the cached user on network/401 errors — non-destructive.
    }
    return null;
  }, []);

  useEffect(() => {
    installAuthRefreshInterceptor();
    const syncSession = () => {
      const stored = readStoredSession();
      setToken(stored.token || null);
      setUser(stored.token && stored.user ? stored.user : null);
    };
    window.addEventListener(SESSION_CHANGED_EVENT, syncSession);
    const { token: storedToken } = readStoredSession();
    syncSession();
    setLoading(false);
    // Background re-sync also renews the access token through the interceptor
    // when the short-lived access token has expired.
    if (storedToken) refreshUser();
    return () => window.removeEventListener(SESSION_CHANGED_EVENT, syncSession);
  }, [refreshUser]);

  const login = useCallback(async (email, password) => {
    const response = await axios.post("/api/auth/login", { email, password });
    const { token: newToken, user: userData } = response.data;
    storeSession(newToken, userData);
    setToken(newToken);
    setUser(userData);
    return userData;
  }, []);

  // `extra` carries fields beyond the base signup form — currently just
  // `inviteToken`, when registration is completing a project invitation
  // (the server ignores `email` in that case and locks it to the invite's
  // own address instead).
  const register = useCallback(async (name, email, password, extra = {}) => {
    const response = await axios.post("/api/auth/register", {
      name,
      email,
      password,
      ...extra,
    });
    const { token: newToken, user: userData } = response.data;
    storeSession(newToken, userData);
    setToken(newToken);
    setUser(userData);
    return userData;
  }, []);

  const logout = useCallback(() => {
    const currentToken = localStorage.getItem("token");
    // Deliberately non-blocking: the UI signs out immediately, while the
    // server invalidates the refresh-token family and clears its cookie.
    axios
      .post(
        "/api/auth/logout",
        {},
        {
          headers: currentToken
            ? { Authorization: `Bearer ${currentToken}` }
            : {},
          _dmdevelonSkipRefresh: true,
        },
      )
      .catch(() => {});
    clearStoredSession();
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
    refreshUser,
  };
}
