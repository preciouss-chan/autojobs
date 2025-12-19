// background/background.js
import { mergeResume } from "../utils/mergeResume.js";

const BASE_URL = "http://localhost:3000"; // <-- change this to your domain

console.log("🔥 Background worker loaded.");

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.action) return;

  // =========================================
  // MAKE_RESUME
  // =========================================
  if (msg.action === "MAKE_RESUME") {
    console.log("📩 MAKE_RESUME triggered");

    (async () => {
      try {
        // Load base resume
        const url = chrome.runtime.getURL("data/resume.json");
        const baseResume = await (await fetch(url)).json();

        // Call tailor API
        const tailorRes = await fetch(`${BASE_URL}/api/tailor`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobDescription: msg.jobDescription })
        });

        if (!tailorRes.ok) throw new Error(await tailorRes.text());
        const edits = await tailorRes.json();

        // Merge
        const mergedResume = mergeResume(baseResume, edits);

        // Call PDF API
        const pdfRes = await fetch(`${BASE_URL}/api/export/pdf`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(mergedResume)
        });

        if (!pdfRes.ok) throw new Error(await pdfRes.text());

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
    console.log("📩 FORCE_UPLOAD → sending to content script");
    chrome.tabs.sendMessage(msg.tabId, { action: "FORCE_UPLOAD" });
    sendResponse({ ok: true });
    return true;
  }

  // =========================================
  // LLM_ANSWER
  // =========================================
  if (msg.action === "LLM_ANSWER") {
    (async () => {
      try {
        const r = await fetch(`${BASE_URL}/api/llm`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(msg)
        });

        if (!r.ok) throw new Error(await r.text());
        const data = await r.json();

        sendResponse({ answer: data.answer });
      } catch (err) {
        sendResponse({ error: String(err) });
      }
    })();
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

