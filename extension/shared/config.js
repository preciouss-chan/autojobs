// shared/config.js
// Backend URL configuration
// This is injected at build time or runtime

// For development: http://localhost:3000
// For production: Set VITE_BACKEND_URL environment variable
// Example: VITE_BACKEND_URL=https://autojobs.app

// Get the backend URL from environment or use localhost as fallback
export const BACKEND_URL = 
  typeof window !== "undefined" && window.__BACKEND_URL__ 
    ? window.__BACKEND_URL__
    : process.env.VITE_BACKEND_URL || "http://localhost:3000";


