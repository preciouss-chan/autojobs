// background/background.js
import { mergeResume } from "../utils/mergeResume.js";
import { BACKEND_URL } from "../shared/config.js";

// Backend URL from config
const BASE_URL = BACKEND_URL;

console.log("🔥 Background worker loaded.");

// Storage keys
const STORAGE_KEYS = {
  AUTH_TOKEN: "auth_token",
  USER_EMAIL: "user_email"
};

// Helper to get auth token from storage
function getAuthToken() {
  return new Promise((resolve) => {
    try {
      chrome.storage.sync.get([STORAGE_KEYS.AUTH_TOKEN], (result) => {
        resolve(result?.[STORAGE_KEYS.AUTH_TOKEN] || null);
      });
    } catch (err) {
      console.error("Error getting auth token:", err);
      resolve(null);
    }
  });
}

// Unicode-safe base64 encoding
function encodeUnicodeToBase64(str) {
  // First encode to UTF-8 bytes, then to base64
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

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.action) return;

  // =========================================
  // LOGOUT_FROM_DASHBOARD (relay to popup)
  // =========================================
  if (msg.action === "LOGOUT_FROM_DASHBOARD") {
    console.log("📩 LOGOUT_FROM_DASHBOARD received in background");
    
    // Forward to popup if it's open
    try {
      chrome.runtime.sendMessage(
        {
          action: "LOGOUT_FROM_DASHBOARD"
        },
        (resp) => {
          if (chrome.runtime.lastError) {
            console.log("ℹ️  Popup not open, but logout processed in background");
          } else {
            console.log("✅ Logout relayed to popup");
          }
        }
      );
    } catch (err) {
      console.log("ℹ️  Could not relay to popup");
    }
    
    // Also process locally - clear extension storage
    chrome.storage.sync.remove(["auth_token", "user_email"], () => {
      console.log("✅ Extension storage cleared");
    });
    
    sendResponse({ success: true });
    return;
  }

  // =========================================
  // MAKE_RESUME
  // =========================================
  if (msg.action === "MAKE_RESUME") {
    console.log("📩 MAKE_RESUME triggered");
    console.log("📋 Job description length:", msg.jobDescription?.length || 0);

    (async () => {
      try {
        // Try to get uploaded resume first, fallback to default
        let baseResume;
        const stored = await chrome.storage.local.get(["uploadedResume"]);
        
        if (stored.uploadedResume) {
          baseResume = stored.uploadedResume;
          console.log("📄 Using uploaded resume");
        } else {
          // Load default resume from extension data
        const url = chrome.runtime.getURL("data/resume.json");
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`Failed to load default resume: ${response.status}`);
          }
          baseResume = await response.json();
          console.log("📄 Using default resume");
        }

        console.log("🔑 API key managed by backend, calling tailor API...");
        console.log("🌐 Backend URL:", BASE_URL);
        console.log("📋 Request URL will be:", `${BASE_URL}/api/tailor`);

        // Get auth token for extension
        const token = await getAuthToken();
        if (!token) {
          throw new Error("Not authenticated. Please login to the extension first.");
        }
        console.log("🔐 Using auth token for tailor API");

        // Call tailor API with resume data and auth token
        const tailorRes = await fetch(`${BASE_URL}/api/tailor`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({ 
            jobDescription: msg.jobDescription,
            resume: baseResume
          })
        });

        console.log("📡 Tailor API response status:", tailorRes.status);

        if (!tailorRes.ok) {
          const errorText = await tailorRes.text();
          console.error("❌ Tailor API error:", tailorRes.status, errorText.substring(0, 200));
          
          // Check if it's an HTML error page (like 403 from nginx)
          if (errorText.includes('<html>') || errorText.includes('403') || errorText.includes('Forbidden')) {
            // Check if it's actually nginx
            if (errorText.includes('nginx')) {
              throw new Error(`403 Forbidden from nginx server. This usually means:\n1. The backend URL is incorrect (currently: ${BASE_URL})\n2. There's a reverse proxy blocking the request\n3. The Next.js server isn't running\n\nPlease check that your Next.js server is running on port 3000.`);
            }
            throw new Error(`Backend returned ${tailorRes.status} Forbidden. Check that BASE_URL is correct in background.js (currently: ${BASE_URL}) and your backend allows requests from Chrome extensions.`);
          }
          
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
        console.log("✅ Tailor API success, received edits");
        console.log("📋 Edits keys:", Object.keys(edits));
        console.log("📝 Cover letter present:", !!edits.cover_letter);
        console.log("📝 Cover letter length:", edits.cover_letter?.length || 0);

        // Store cover letter if present, otherwise clear old one
        if (edits.cover_letter && edits.cover_letter.trim() !== "") {
          const coverLetterText = edits.cover_letter;
          const coverLetterBase64 = encodeUnicodeToBase64(coverLetterText);
          
          chrome.storage.local.set({
            lastCoverLetterBase64: coverLetterBase64,
            lastCoverLetterFilename: "cover_letter.txt"
          });
          
          console.log("📝 Cover letter saved to storage. Length:", coverLetterText.length);
        } else {
          // Clear old cover letter if new one is not provided
          console.log("⚠️ No cover letter in response, clearing old cover letter");
          chrome.storage.local.remove(["lastCoverLetterBase64", "lastCoverLetterFilename"]);
        }

        // Merge
        const mergedResume = mergeResume(baseResume, edits);

        // Call PDF API (no API key needed for PDF generation)
        console.log("📄 Generating PDF...");
        const pdfRes = await fetch(`${BASE_URL}/api/export/pdf`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(mergedResume)
        });

        if (!pdfRes.ok) {
          const pdfError = await pdfRes.text();
          console.error("❌ PDF generation error:", pdfError);
          throw new Error(`PDF generation failed: ${pdfError.substring(0, 200)}`);
        }
        console.log("✅ PDF generated successfully");

        const buffer = await pdfRes.arrayBuffer();
        const base64 = arrayBufferToBase64(buffer);

        // Save in storage
        chrome.storage.local.set({
          lastTailoredResumeBase64: base64,
          lastTailoredResumeFilename: "Tailored_Resume.pdf",
          lastTailoredResumeTimestamp: Date.now()
        });

        console.log("📥 Tailored resume saved to storage.");

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
    console.log("📩 FORCE_UPLOAD → sending to content script (tabId:", msg.tabId, ")");
    
    // Helper function to send message with retry
    const sendWithRetry = (retries = 3, delay = 200) => {
      chrome.tabs.sendMessage(msg.tabId, { action: "FORCE_UPLOAD" }, (resp) => {
        if (chrome.runtime.lastError) {
          const error = chrome.runtime.lastError.message;
          console.warn(`⚠️ Content script not ready (${retries} retries left):`, error);
          
          if (retries > 0) {
            // Wait and retry - content script might still be loading
            setTimeout(() => sendWithRetry(retries - 1, delay), delay);
          } else {
            // Last resort: try to inject the script
            console.log("🔄 Attempting to inject content script...");
            chrome.scripting.executeScript({
              target: { tabId: msg.tabId },
              files: ["content/content-script.js"]
            }).then(() => {
              console.log("✅ Content script injected, retrying message...");
              setTimeout(() => {
                chrome.tabs.sendMessage(msg.tabId, { action: "FORCE_UPLOAD" }, (finalResp) => {
                  if (chrome.runtime.lastError) {
                    console.error("❌ Still failed after injection:", chrome.runtime.lastError.message);
                    sendResponse({ ok: false, error: chrome.runtime.lastError.message });
                  } else {
                    sendResponse(finalResp || { ok: true });
                  }
                });
              }, 200);
            }).catch((err) => {
              console.error("❌ Failed to inject content script:", err);
              sendResponse({ ok: false, error: `Content script not available: ${error}` });
            });
          }
        } else {
          sendResponse(resp || { ok: true });
        }
      });
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

        console.log("📄 Converting cover letter to PDF via backend:", BASE_URL);
        
        // Convert text to PDF using backend API
        const response = await fetch(`${BASE_URL}/api/export/cover-letter`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text })
        }).catch((fetchErr) => {
          console.error("❌ Fetch error:", fetchErr);
          throw new Error(`Failed to connect to backend at ${BASE_URL}. Is the server running? Error: ${fetchErr.message}`);
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          throw new Error(`Backend returned ${response.status}: ${errorText}`);
        }

        const pdfBlob = await response.blob();
        const pdfArrayBuffer = await pdfBlob.arrayBuffer();
        
        // Convert to base64
        const bytes = new Uint8Array(pdfArrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const pdfBase64 = btoa(binary);

        console.log("✅ Cover letter converted to PDF successfully");
        sendResponse({ ok: true, base64: pdfBase64 });
      } catch (err) {
        console.error("❌ Cover letter conversion error:", err);
        sendResponse({ ok: false, error: err.message });
      }
    })();
    return true;
  }

  // =========================================
  // FORCE_UPLOAD_COVER
  // =========================================
  if (msg.action === "FORCE_UPLOAD_COVER") {
    console.log("📩 FORCE_UPLOAD_COVER → sending to content script (tabId:", msg.tabId, ")");
    
    // Helper function to send message with retry
    const sendWithRetry = (retries = 3, delay = 200) => {
      chrome.tabs.sendMessage(msg.tabId, { action: "FORCE_UPLOAD_COVER" }, (resp) => {
        if (chrome.runtime.lastError) {
          const error = chrome.runtime.lastError.message;
          console.warn(`⚠️ Content script not ready (${retries} retries left):`, error);
          
          if (retries > 0) {
            // Wait and retry - content script might still be loading
            setTimeout(() => sendWithRetry(retries - 1, delay), delay);
          } else {
            // Last resort: try to inject the script
            console.log("🔄 Attempting to inject content script...");
            chrome.scripting.executeScript({
              target: { tabId: msg.tabId },
              files: ["content/content-script.js"]
            }).then(() => {
              console.log("✅ Content script injected, retrying message...");
              setTimeout(() => {
                chrome.tabs.sendMessage(msg.tabId, { action: "FORCE_UPLOAD_COVER" }, (finalResp) => {
                  if (chrome.runtime.lastError) {
                    console.error("❌ Still failed after injection:", chrome.runtime.lastError.message);
                    sendResponse({ ok: false, error: chrome.runtime.lastError.message });
                  } else {
                    sendResponse(finalResp || { ok: true });
                  }
                });
              }, 200);
            }).catch((err) => {
              console.error("❌ Failed to inject content script:", err);
              sendResponse({ ok: false, error: `Content script not available: ${error}` });
            });
          }
        } else {
          sendResponse(resp || { ok: true });
        }
      });
    };
    
    sendWithRetry();
    return true;
  }

  // =========================================
  // GET_TAILORED_RESUME
  // =========================================
  if (msg.action === "GET_TAILORED_RESUME") {
    chrome.storage.local.get(
      ["lastTailoredResumeBase64", "lastTailoredResumeFilename"],
      (res) => {
        sendResponse({
          base64: res.lastTailoredResumeBase64 || null,
          filename: res.lastTailoredResumeFilename || "Resume.pdf"
        });
      }
    );
    return true;
  }

  // =========================================
  // GET_COVER_LETTER
  // =========================================
  if (msg.action === "GET_COVER_LETTER") {
    chrome.storage.local.get(
      ["lastCoverLetterBase64", "lastCoverLetterFilename"],
      (res) => {
        sendResponse({
          base64: res.lastCoverLetterBase64 || null,
          filename: res.lastCoverLetterFilename || "cover_letter.txt"
        });
      }
    );
    return true;
  }

  // =========================================
  // UPLOAD_RESUME
  // =========================================
  if (msg.action === "UPLOAD_RESUME") {
    (async () => {
      try {
        const { resumeData, filename } = msg;
        
        // Store the resume JSON
        chrome.storage.local.set({
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

