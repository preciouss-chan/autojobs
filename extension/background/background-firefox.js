// background/background-firefox.js
// Firefox-compatible background script (non-service worker)

import { mergeResume } from "../utils/mergeResume.js";

// Use browser.* API (Firefox native) with chrome.* fallback
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

// Backend URL - update this to your hosted backend URL
const BASE_URL = "http://localhost:3000";

// Get OpenAI API key from settings
async function getOpenAIApiKey() {
  const result = await browserAPI.storage.sync.get(['openaiApiKey']);
  return result.openaiApiKey || null;
}

console.log("🔥 Background script loaded (Firefox).");

// Unicode-safe base64 encoding
function encodeUnicodeToBase64(str) {
  const utf8Bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < utf8Bytes.length; i++) {
    binary += String.fromCharCode(utf8Bytes[i]);
  }
  return btoa(binary);
}

// Unicode-safe base64 decoding
function decodeBase64ToUnicode(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

browserAPI.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.action) return;

  // =========================================
  // MAKE_RESUME
  // =========================================
  if (msg.action === "MAKE_RESUME") {
    (async () => {
      try {
        let baseResume;
        const stored = await browserAPI.storage.local.get(["uploadedResume"]);
        
        if (stored.uploadedResume) {
          baseResume = stored.uploadedResume;
        } else {
          const url = browserAPI.runtime.getURL("data/resume.json");
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`Failed to load default resume: ${response.status}`);
          }
          baseResume = await response.json();
        }

        const apiKey = await getOpenAIApiKey();
        
        if (!apiKey) {
          throw new Error("OpenAI API key not set. Please configure it in the extension settings.");
        }

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
          if (errorText.includes('<html>') || errorText.includes('403')) {
            throw new Error(`Backend returned ${tailorRes.status}. Check that BASE_URL is correct.`);
          }
          try {
            const errorJson = JSON.parse(errorText);
            throw new Error(errorJson.error || errorJson.details || "Backend error");
          } catch {
            throw new Error(errorText.substring(0, 300) || `Backend returned ${tailorRes.status}`);
          }
        }
        
        const edits = await tailorRes.json();

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

        sendResponse({ ok: true });
      } catch (err) {
        console.error("MAKE_RESUME Error:", err);
        sendResponse({ error: String(err) });
      }
    })();

    return true;
  }

  // =========================================
  // FORCE_UPLOAD
  // =========================================
  if (msg.action === "FORCE_UPLOAD") {
    const sendWithRetry = async (retries = 3, delay = 200) => {
      try {
        const resp = await browserAPI.tabs.sendMessage(msg.tabId, { action: "FORCE_UPLOAD" });
        sendResponse(resp || { ok: true });
      } catch (error) {
        if (retries > 0) {
          setTimeout(() => sendWithRetry(retries - 1, delay), delay);
        } else {
          try {
            await browserAPI.scripting.executeScript({
              target: { tabId: msg.tabId },
              files: ["content/content-script.js"]
            });
            setTimeout(async () => {
              try {
                const finalResp = await browserAPI.tabs.sendMessage(msg.tabId, { action: "FORCE_UPLOAD" });
                sendResponse(finalResp || { ok: true });
              } catch (err) {
                sendResponse({ ok: false, error: err.message });
              }
            }, 200);
          } catch (err) {
            sendResponse({ ok: false, error: `Content script not available: ${error}` });
          }
        }
      }
    };
    
    sendWithRetry();
    return true;
  }

  // =========================================
  // CONVERT_COVER_LETTER_TO_PDF
  // =========================================
  if (msg.action === "CONVERT_COVER_LETTER_TO_PDF") {
    (async () => {
      try {
        const { text } = msg;
        if (!text) {
          sendResponse({ ok: false, error: "No text provided" });
          return;
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

        sendResponse({ ok: true, base64: pdfBase64 });
      } catch (err) {
        console.error("Cover letter conversion error:", err);
        sendResponse({ ok: false, error: err.message });
      }
    })();
    return true;
  }

  // =========================================
  // FORCE_UPLOAD_COVER
  // =========================================
  if (msg.action === "FORCE_UPLOAD_COVER") {
    const sendWithRetry = async (retries = 3, delay = 200) => {
      try {
        const resp = await browserAPI.tabs.sendMessage(msg.tabId, { action: "FORCE_UPLOAD_COVER" });
        sendResponse(resp || { ok: true });
      } catch (error) {
        if (retries > 0) {
          setTimeout(() => sendWithRetry(retries - 1, delay), delay);
        } else {
          try {
            await browserAPI.scripting.executeScript({
              target: { tabId: msg.tabId },
              files: ["content/content-script.js"]
            });
            setTimeout(async () => {
              try {
                const finalResp = await browserAPI.tabs.sendMessage(msg.tabId, { action: "FORCE_UPLOAD_COVER" });
                sendResponse(finalResp || { ok: true });
              } catch (err) {
                sendResponse({ ok: false, error: err.message });
              }
            }, 200);
          } catch (err) {
            sendResponse({ ok: false, error: `Content script not available: ${error}` });
          }
        }
      }
    };
    
    sendWithRetry();
    return true;
  }

  // =========================================
  // GET_TAILORED_RESUME
  // =========================================
  if (msg.action === "GET_TAILORED_RESUME") {
    (async () => {
      const res = await browserAPI.storage.local.get(
        ["lastTailoredResumeBase64", "lastTailoredResumeFilename"]
      );
      sendResponse({
        base64: res.lastTailoredResumeBase64 || null,
        filename: res.lastTailoredResumeFilename || "Resume.pdf"
      });
    })();
    return true;
  }

  // =========================================
  // GET_COVER_LETTER
  // =========================================
  if (msg.action === "GET_COVER_LETTER") {
    (async () => {
      const res = await browserAPI.storage.local.get(
        ["lastCoverLetterBase64", "lastCoverLetterFilename"]
      );
      sendResponse({
        base64: res.lastCoverLetterBase64 || null,
        filename: res.lastCoverLetterFilename || "cover_letter.txt"
      });
    })();
    return true;
  }

  // =========================================
  // UPLOAD_RESUME
  // =========================================
  if (msg.action === "UPLOAD_RESUME") {
    (async () => {
      try {
        const { resumeData, filename } = msg;
        
        await browserAPI.storage.local.set({
          uploadedResume: resumeData,
          uploadedResumeFilename: filename || "resume.json"
        });

        sendResponse({ ok: true });
      } catch (err) {
        console.error("UPLOAD_RESUME Error:", err);
        sendResponse({ error: String(err) });
      }
    })();
    return true;
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
