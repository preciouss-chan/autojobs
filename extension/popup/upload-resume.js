// upload-resume.js - Dedicated resume upload page script

import { BACKEND_URL } from '../shared/config.js';

const browserAPI = typeof browser !== 'undefined' ? browser : chrome;
const statusEl = document.getElementById("status");

function storageGet(areaName, keys) {
  const area = browserAPI.storage[areaName];
  try {
    const result = area.get(keys);
    if (result && typeof result.then === "function") {
      return result;
    }
  } catch (err) {
    console.warn(`Promise storage.${areaName}.get unavailable, using callback API:`, err);
  }

  return new Promise((resolve) => {
    area.get(keys, (result) => {
      resolve(result || {});
    });
  });
}

function sendRuntimeMessage(message) {
  try {
    const result = browserAPI.runtime.sendMessage(message);
    if (result && typeof result.then === "function") {
      return result;
    }
  } catch (err) {
    return Promise.reject(err);
  }

  return new Promise((resolve, reject) => {
    browserAPI.runtime.sendMessage(message, (resp) => {
      const lastError = browserAPI.runtime.lastError;
      if (lastError) {
        reject(lastError);
        return;
      }
      resolve(resp);
    });
  });
}

document.getElementById("resumeFile").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  statusEl.className = "status loading";
  statusEl.style.display = "block";
  statusEl.textContent = "Uploading and parsing PDF...";

  try {
    if (!file.name.endsWith(".pdf") && file.type !== "application/pdf") {
      throw new Error("Resume must be a PDF file");
    }

    // Send PDF to backend for parsing
    const formData = new FormData();
    formData.append("file", file);

    // Get API key from settings
    const apiKeySettings = await storageGet("sync", ["openaiApiKey"]);
    const apiKey = apiKeySettings.openaiApiKey;
    const headers = {};
    if (apiKey) {
      headers["X-OpenAI-API-Key"] = apiKey;
    }

    const response = await fetch(`${BACKEND_URL}/api/parse-resume`, {
      method: "POST",
      headers,
      body: formData
    });

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      throw new Error(`Server returned non-JSON response. Make sure the server is running.`);
    }

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.details || errorData.error || `Failed to parse PDF`);
    }

    const resumeData = await response.json();

    if (!resumeData.name || !resumeData.contact) {
      throw new Error("Invalid resume format. Could not extract name and contact information.");
    }

    // Send parsed resume to background for caching
    await sendRuntimeMessage({
      action: "UPLOAD_RESUME",
      resumeData,
      filename: file.name
    });

    statusEl.className = "status success";
    statusEl.textContent = `Resume cached for this browser session. (${file.name})`;
    
    // Close tab after a delay
    setTimeout(() => {
      window.close();
    }, 2000);
    
  } catch (err) {
    let errorMessage = err.message || "Unknown error occurred";
    
    if (errorMessage.includes("Failed to fetch") || errorMessage.includes("NetworkError")) {
      errorMessage = "Cannot connect to server. Make sure the Next.js server is running.";
    }
    
    statusEl.className = "status error";
    statusEl.textContent = `Error: ${errorMessage}`;
    console.error("Resume upload error:", err);
  }
});
