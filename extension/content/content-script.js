console.log("🔥 Content script loaded on:", window.location.href);

// =======================
// Helpers
// =======================

// Convert base64 → File
function base64ToFile(base64, filename = "Resume.pdf") {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return new File([bytes], filename, { type: "application/pdf" });
}

// Find input in main DOM or same-origin iframes
function findUploadInput() {
  let input = document.querySelector("input[type=file]");
  if (input) return input;

  for (const frame of document.querySelectorAll("iframe")) {
    try {
      const doc = frame.contentDocument || frame.contentWindow.document;
      const found = doc.querySelector("input[type=file]");
      if (found) return found;
    } catch {}
  }

  return null;
}

function injectFileIntoPage(file) {
  const input = findUploadInput();
  if (!input) {
    //console.warn("⚠️ No upload input found on this page.");
    return false;
  }

  const dt = new DataTransfer();
  dt.items.add(file);
  input.files = dt.files;

  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));

  console.log("🔥 Resume uploaded into:", input);
  return true;
}

// ===============================
// Listen for FORCE_UPLOAD
// ===============================
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action !== "FORCE_UPLOAD") return;

  console.log("📩 FORCE_UPLOAD received in content script");

  chrome.storage.local.get(
    ["lastTailoredResumePDF", "lastTailoredResumeFilename"],
    (data) => {
      const base64 = data.lastTailoredResumePDF;
      const filename = data.lastTailoredResumeFilename || "Resume.pdf";

      if (!base64) {
        console.warn("⚠️ No tailored resume found in storage.");
        sendResponse({ error: "no_resume" });
        return;
      }

      const file = base64ToFile(base64, filename);
      const ok = injectFileIntoPage(file);

      sendResponse({ ok });
    }
  );

  return true;
});

