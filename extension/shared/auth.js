// extension/shared/auth.js
// Authentication helper for extension

import { fetchWithTimeout, API_TIMEOUTS } from './api-utils.js';
import { BACKEND_URL } from './config.js';

const API_BASE_URL = `${BACKEND_URL}/api`;
const STORAGE_KEYS = {
  AUTH_TOKEN: "auth_token",
  USER_EMAIL: "user_email",
  CREDITS: "user_credits"
};

const browserAPI = typeof browser !== "undefined" ? browser : chrome;

/**
 * Open OAuth login window
 */
export async function openLoginWindow() {
  return new Promise((resolve, reject) => {
    const width = 500;
    const height = 600;
    const left = Math.round(screen.width / 2 - width / 2);
    const top = Math.round(screen.height / 2 - height / 2);

    const windowFeatures = `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`;
    const authWindow = window.open(
      `${BACKEND_URL}/extension-auth`,
      "AutoJobsAuth",
      windowFeatures
    );

    if (!authWindow) {
      reject(new Error("Failed to open login window. Check popup blocker."));
      return;
    }

    // Listen for message from auth window
    const handleMessage = (event) => {
      if (event.source !== authWindow) return;
      if (event.data.type === "AUTH_SUCCESS") {
        window.removeEventListener("message", handleMessage);
        authWindow.close();
        resolve(event.data);
      } else if (event.data.type === "AUTH_ERROR") {
        window.removeEventListener("message", handleMessage);
        authWindow.close();
        reject(new Error(event.data.error || "Authentication failed"));
      }
    };

    window.addEventListener("message", handleMessage);

    // Timeout after 5 minutes
    setTimeout(() => {
      window.removeEventListener("message", handleMessage);
      if (authWindow && !authWindow.closed) {
        authWindow.close();
      }
      reject(new Error("Login timeout"));
    }, 5 * 60 * 1000);
  });
}

/**
 * Store auth token in extension storage
 */
export async function storeAuthToken(token, email) {
  return new Promise((resolve) => {
    browserAPI.storage.sync.set(
      {
        [STORAGE_KEYS.AUTH_TOKEN]: token,
        [STORAGE_KEYS.USER_EMAIL]: email
      },
      resolve
    );
  });
}

/**
 * Get auth token from storage
 */
export async function getAuthToken() {
  return new Promise((resolve) => {
    browserAPI.storage.sync.get([STORAGE_KEYS.AUTH_TOKEN], (result) => {
      resolve(result[STORAGE_KEYS.AUTH_TOKEN] || null);
    });
  });
}

/**
 * Get user email from storage
 */
export async function getUserEmail() {
  return new Promise((resolve) => {
    browserAPI.storage.sync.get([STORAGE_KEYS.USER_EMAIL], (result) => {
      resolve(result[STORAGE_KEYS.USER_EMAIL] || null);
    });
  });
}

/**
 * Check if user is logged in
 */
export async function isLoggedIn() {
  const token = await getAuthToken();
  return !!token;
}

/**
 * Fetch user's credit balance
 */
export async function getCreditsBalance() {
  const token = await getAuthToken();
  if (!token) {
    throw new Error("Not authenticated");
  }

  const response = await fetchWithTimeout(`${API_BASE_URL}/credits/balance`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    }
  }, API_TIMEOUTS.CREDITS);

  if (!response.ok) {
    throw new Error(`Failed to fetch credits: ${response.statusText}`);
  }

  const data = await response.json();
  return data.balance;
}

/**
 * Deduct credits after job application
 */
export async function deductCredits(amount = 1) {
  const token = await getAuthToken();
  if (!token) {
    throw new Error("Not authenticated");
  }

  const response = await fetchWithTimeout(`${API_BASE_URL}/credits/deduct`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ amount })
  }, API_TIMEOUTS.CREDITS);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to deduct credits");
  }

  const data = await response.json();
  return data.newBalance;
}

/**
 * Logout and clear stored auth
 */
export async function logout() {
  return new Promise((resolve) => {
    browserAPI.storage.sync.remove(
      [STORAGE_KEYS.AUTH_TOKEN, STORAGE_KEYS.USER_EMAIL],
      resolve
    );
  });
}

/**
 * Refresh credentials display in popup
 */
export async function refreshCreditsDisplay() {
  try {
    const balance = await getCreditsBalance();
    const creditDisplay = document.getElementById("creditDisplay");
    const creditCount = document.getElementById("creditCount");

    if (creditDisplay && creditCount) {
      creditCount.textContent = balance;
      creditDisplay.style.display = "inline";
    }

    return balance;
  } catch (err) {
    console.error("Failed to refresh credits:", err);
    return 0;
  }
}

/**
 * Sync auth token from dashboard via postMessage
 * Called when dashboard sends a token after login
 */
export async function syncTokenFromDashboard(token, email) {
  if (!token || !email) {
    console.error("❌ Invalid token or email received from dashboard");
    return false;
  }

  try {
    await storeAuthToken(token, email);
    console.log("✅ Token synced from dashboard to extension");
    return true;
  } catch (err) {
    console.error("❌ Failed to sync token from dashboard:", err);
    return false;
  }
}
