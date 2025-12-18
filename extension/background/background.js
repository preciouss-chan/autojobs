import { mergeResume } from "../utils/mergeResume.js";

console.log("🔥 Background worker loaded.");

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "MAKE_RESUME") {
    console.log("📩 MAKE_RESUME triggered");

    (async () => {
      try {
        const { tabId } = msg;

        // Load base resume from extension
        const resumeURL = chrome.runtime.getURL("data/resume.json");
        const baseResume = await (await fetch(resumeURL)).json();

        // Call your tailor API
        const tailor = await fetch("http://localhost:3000/api/tailor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobDescription: msg.jobDescription })
        });

        if (!tailor.ok) throw new Error(await tailor.text());
        const edits = await tailor.json();

        // Merge edits + base resume
        const mergedResume = mergeResume(baseResume, edits);

        // Call the PDF export API
        const pdfRes = await fetch("http://localhost:3000/api/export/pdf", {

          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(mergedResume)
        });

        if (!pdfRes.ok) throw new Error(await pdfRes.text());

        const buffer = await pdfRes.arrayBuffer();
        const base64 = arrayBufferToBase64(buffer);

        // Save tailored resume globally
        chrome.storage.local.set({
          lastTailoredResumePDF: base64,
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

  if (msg.action === "FORCE_UPLOAD") {
    console.log("📩 FORCE_UPLOAD sent to tab", msg.tabId);
    chrome.tabs.sendMessage(msg.tabId, { action: "FORCE_UPLOAD" });
    sendResponse({ ok: true });
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

