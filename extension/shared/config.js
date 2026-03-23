// shared/config.js
// Backend URL configuration
// This is injected at build time or runtime

const DEFAULT_BACKEND_URL = "https://autojobs-bice.vercel.app";

export const BACKEND_URL =
  typeof window !== "undefined" && window.__BACKEND_URL__
    ? window.__BACKEND_URL__
    : DEFAULT_BACKEND_URL;

