const DEFAULT_BACKEND_URL = "http://localhost:3000";

export const BACKEND_URL =
  typeof window !== "undefined" && window.__BACKEND_URL__
    ? window.__BACKEND_URL__
    : DEFAULT_BACKEND_URL;
