// upload-resume.js - Dedicated resume upload page script

import { BACKEND_URL } from '../shared/config.js';

const statusEl = document.getElementById("status");

async function getAuthToken() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(["auth_token"], (result) => {
      resolve(result?.auth_token || null);
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
    const apiKeySettings = await chrome.storage.sync.get(['openaiApiKey']);
    const apiKey = apiKeySettings.openaiApiKey;
    const authToken = await getAuthToken();

    if (!authToken) {
      throw new Error("Not authenticated. Please sign in from the extension first.");
    }

    const response = await fetch(`${BACKEND_URL}/api/parse-resume`, {
      method: "POST",
      headers: {
        ...(apiKey ? { "X-OpenAI-API-Key": apiKey } : {}),
        "Authorization": `Bearer ${authToken}`
      },
      body: formData
    });

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      throw new Error(`Server returned non-JSON response. Make sure the server is running.`);
    }

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || errorData.details || `Failed to parse PDF`);
    }

    const resumeData = await response.json();

    if (!resumeData.name || !resumeData.contact) {
      throw new Error("Invalid resume format. Could not extract name and contact information.");
    }

    // Send parsed resume to background for caching
    await chrome.runtime.sendMessage({
      action: "UPLOAD_RESUME",
      resumeData,
      filename: file.name
    });

    statusEl.className = "status success";
    statusEl.textContent = `✓ Resume parsed and cached successfully! (${file.name})`;
    
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
