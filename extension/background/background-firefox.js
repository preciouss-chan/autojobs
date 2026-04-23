// background/background-firefox.js
// Firefox-compatible background script (non-service worker)

import { mergeResume } from "../utils/mergeResume.js";
import { BACKEND_URL } from "../shared/config.js";

// Use browser.* API (Firefox native) with chrome.* fallback
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

// Backend URL from config
const BASE_URL = BACKEND_URL;

// Storage keys
const STORAGE_KEYS = {
  OPENAI_API_KEY: "openaiApiKey"
};

console.log("🔥 Background script loaded (Firefox).");

function getStoredApiKey() {
  return new Promise((resolve) => {
    try {
      browserAPI.storage.sync.get([STORAGE_KEYS.OPENAI_API_KEY], (result) => {
        resolve(result?.[STORAGE_KEYS.OPENAI_API_KEY] || null);
      });
    } catch (err) {
      console.error("Error getting stored API key:", err);
      resolve(null);
    }
  });
}

// Unicode-safe base64 encoding
function encodeUnicodeToBase64(str) {
  const utf8Bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < utf8Bytes.length; i++) {
    binary += String.fromCharCode(utf8Bytes[i]);
  }
  return btoa(binary);
}

async function handleMakeResume(msg) {
  try {
    let baseResume;
    const stored = await browserAPI.storage.local.get(["uploadedResume"]);
    
    if (stored.uploadedResume) {
      baseResume = stored.uploadedResume;
      console.log("📄 Using uploaded resume");
    } else {
      const url = browserAPI.runtime.getURL("data/resume.json");
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to load default resume: ${response.status}`);
      }
      baseResume = await response.json();
      console.log("📄 Using default resume");
    }

    console.log("🔑 Using stored API key for tailor API...");
    console.log("🌐 Backend URL:", BASE_URL);

    const apiKey = await getStoredApiKey();
    if (!apiKey) {
      throw new Error("No OpenAI API key found. Save one in the extension or dashboard first.");
    }
    console.log("🔐 Sending stored API key to tailor API");

    const tailorRes = await fetch(`${BASE_URL}/api/tailor`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "X-OpenAI-API-Key": apiKey
      },
      body: JSON.stringify({ 
        jobDescription: msg.jobDescription,
        resume: baseResume
      })
    });

    if (!tailorRes.ok) {
      const errorText = await tailorRes.text();
      console.error("❌ Tailor API error:", tailorRes.status, errorText.substring(0, 200));
      
      // Try to parse as JSON for better error messages
      try {
        const errorJson = JSON.parse(errorText);
        throw new Error(errorJson.error || errorJson.details || "Backend error");
      } catch {
        // If not JSON, extract meaningful text
        let cleanError = errorText.replace(/<[^>]*>/g, '').trim();
        if (cleanError.length > 300) {
          cleanError = cleanError.substring(0, 300) + "...";
        }
        throw new Error(cleanError || `Backend returned ${tailorRes.status}`);
      }
    }
    
    const edits = await tailorRes.json();
    console.log("✅ Tailor API success");
    console.log("📝 Cover letter present:", !!edits.cover_letter);

    if (edits.cover_letter && edits.cover_letter.trim() !== "") {
      const coverLetterBase64 = encodeUnicodeToBase64(edits.cover_letter);
      await browserAPI.storage.local.set({
        lastCoverLetterBase64: coverLetterBase64,
        lastCoverLetterFilename: "cover_letter.txt"
      });
    } else {
      await browserAPI.storage.local.remove(["lastCoverLetterBase64", "lastCoverLetterFilename"]);
    }

    const mergedResume = mergeResume(baseResume, edits);

    const pdfRes = await fetch(`${BASE_URL}/api/export/pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mergedResume)
    });

    if (!pdfRes.ok) {
      const pdfError = await pdfRes.text();
      throw new Error(`PDF generation failed: ${pdfError.substring(0, 200)}`);
    }

    const buffer = await pdfRes.arrayBuffer();
    const base64 = arrayBufferToBase64(buffer);

    await browserAPI.storage.local.set({
      lastTailoredResumeBase64: base64,
      lastTailoredResumeFilename: "Tailored_Resume.pdf",
      lastTailoredResumeTimestamp: Date.now()
    });

    return { ok: true };
  } catch (err) {
    console.error("MAKE_RESUME Error:", err);
    return { error: String(err) };
  }
}

async function sendMessageWithRetry(tabId, message, retries = 3, delay = 200) {
  try {
    const resp = await browserAPI.tabs.sendMessage(tabId, message);
    return resp || { ok: true };
  } catch {
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return sendMessageWithRetry(tabId, message, retries - 1, delay);
    }
    try {
      await browserAPI.scripting.executeScript({
        target: { tabId },
        files: ["content/content-script.js"]
      });
      await new Promise(resolve => setTimeout(resolve, 200));
      const finalResp = await browserAPI.tabs.sendMessage(tabId, message);
      return finalResp || { ok: true };
    } catch (err) {
      return { ok: false, error: err.message || String(err) };
    }
  }
}

async function handleConvertCoverLetterToPdf(msg) {
  try {
    const { text } = msg;
    if (!text) {
      return { ok: false, error: "No text provided" };
    }

    const response = await fetch(`${BASE_URL}/api/export/cover-letter`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Backend returned ${response.status}: ${errorText}`);
    }

    const pdfBlob = await response.blob();
    const pdfArrayBuffer = await pdfBlob.arrayBuffer();
    
    const bytes = new Uint8Array(pdfArrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const pdfBase64 = btoa(binary);

    return { ok: true, base64: pdfBase64 };
  } catch (err) {
    console.error("Cover letter conversion error:", err);
    return { ok: false, error: err.message };
  }
}

async function handleUploadResume(msg) {
  try {
    const { resumeData, filename } = msg;
    
    await browserAPI.storage.local.set({
      uploadedResume: resumeData,
      uploadedResumeFilename: filename || "resume.json"
    });

    return { ok: true };
  } catch (err) {
    console.error("UPLOAD_RESUME Error:", err);
    return { error: String(err) };
  }
}

async function handleGetTailoredResume() {
  const res = await browserAPI.storage.local.get(
    ["lastTailoredResumeBase64", "lastTailoredResumeFilename"]
  );
  return {
    base64: res.lastTailoredResumeBase64 || null,
    filename: res.lastTailoredResumeFilename || "Resume.pdf"
  };
}

async function handleGetCoverLetter() {
  const res = await browserAPI.storage.local.get(
    ["lastCoverLetterBase64", "lastCoverLetterFilename"]
  );
  return {
    base64: res.lastCoverLetterBase64 || null,
    filename: res.lastCoverLetterFilename || "cover_letter.txt"
  };
}

browserAPI.runtime.onMessage.addListener((msg) => {
  if (!msg || !msg.action) return;

  // Firefox expects a Promise for async responses.
  if (msg.action === "MAKE_RESUME") {
    return handleMakeResume(msg);
  }

  if (msg.action === "FORCE_UPLOAD") {
    return sendMessageWithRetry(msg.tabId, { action: "FORCE_UPLOAD" });
  }

  if (msg.action === "CONVERT_COVER_LETTER_TO_PDF") {
    return handleConvertCoverLetterToPdf(msg);
  }

  if (msg.action === "FORCE_UPLOAD_COVER") {
    return sendMessageWithRetry(msg.tabId, { action: "FORCE_UPLOAD_COVER" });
  }

  if (msg.action === "GET_TAILORED_RESUME") {
    return handleGetTailoredResume();
  }

  if (msg.action === "GET_COVER_LETTER") {
    return handleGetCoverLetter();
  }

  if (msg.action === "UPLOAD_RESUME") {
    return handleUploadResume(msg);
  }
});

function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;

  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
