// content/content-script.js
console.log("🔥 Content script loaded on:", window.location.href);

const FLOATING_UI_ENABLED = true;

function base64ToFile(base64, filename = "resume.pdf", mime = "application/pdf") {
  const parts = base64.split(",");
  const b64 = parts.length === 2 && parts[0].startsWith("data:") ? parts[1] : base64;

  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  return new File([bytes], filename, { type: mime });
}

function findUploadInput() {
  const selectors = [
    "input[type=file]",
    "input[type=file][accept*='pdf']",
    "input[type=file][name*='resume']",
    "input[type=file][id*='resume']",
    "input[type=file][id*='cv']",
    "input[type=file][name*='cv']"
  ];

  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) return el;
  }

  // fallback: any visible file input
  const all = Array.from(document.querySelectorAll("input[type=file]"));
  const visible = all.find(i => i.offsetParent !== null);
  return visible || all[0] || null;
}

function injectFileIntoPage(file) {
  const input = findUploadInput();
  if (!input) {
    console.warn("⚠️ No upload input found on this page.");
    return false;
  }

  const dt = new DataTransfer();
  dt.items.add(file);

  input.files = dt.files;

  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));

  console.log("🔥 Uploaded tailored resume once into:", input);
  return true;
}

// ---------- Small Floating Panel ----------
function createFloatingUI() {
  if (!FLOATING_UI_ENABLED) return;
  if (document.getElementById("__autoapply_panel")) return;

  const div = document.createElement("div");
  div.id = "__autoapply_panel";
  div.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 2147483647;
    background: #fff;
    padding: 12px;
    border-radius: 8px;
    box-shadow: 0 6px 18px rgba(0,0,0,0.15);
    font-family: sans-serif;
    width: 200px;
  `;

  div.innerHTML = `
    <div style="font-weight:600;margin-bottom:8px;">Auto Apply AI</div>
    <button id="__btn_upload" style="width:100%;padding:8px;background:#10b981;color:white;border:none;border-radius:6px;cursor:pointer;margin-bottom:8px;">
      Upload Resume
    </button>
    <button id="__btn_fill" style="width:100%;padding:8px;background:#2563eb;color:white;border:none;border-radius:6px;cursor:pointer;margin-bottom:8px;">
      Fill Form (AI)
    </button>
    <button id="__btn_hide" style="width:100%;padding:6px;background:#eee;border:none;border-radius:6px;cursor:pointer;">
      Hide
    </button>
    <div id="__auto_status" style="margin-top:8px;font-size:12px;color:#555;"></div>
  `;

  document.body.appendChild(div);

  const setStatus = (t) => {
    const el = document.getElementById("__auto_status");
    if (el) el.textContent = t;
  };

  document.getElementById("__btn_upload").onclick = async () => {
    setStatus("Loading resume...");
    const cached = await getTailoredResume();
    if (!cached) return setStatus("No tailored resume. Generate one first.");

    const file = base64ToFile(cached.base64, cached.filename);
    const ok = injectFileIntoPage(file);
    setStatus(ok ? "Resume uploaded." : "Upload failed.");
  };

  document.getElementById("__btn_fill").onclick = async () => {
    setStatus("Filling form...");
    const r = await runAIFillFlow();
    setStatus(r ? "Form filled." : "Fill failed.");
  };

  document.getElementById("__btn_hide").onclick = () => (div.style.display = "none");
}

function getTailoredResume() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: "GET_TAILORED_RESUME" }, (resp) => {
      if (!resp || !resp.base64) return resolve(null);
      resolve(resp);
    });
  });
}

// Simple placeholder; you can improve form AI-fill later
async function runAIFillFlow() {
  // This can be expanded with LLM answer logic
  console.log("⭐ AI fill not implemented yet in this clean version.");
  return false;
}

// ---------- Handle Messages from Background ----------
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.action) return;

  // Manual resume upload from popup
  if (msg.action === "FORCE_UPLOAD") {
    (async () => {
      const cached = await getTailoredResume();
      if (!cached) {
        sendResponse({ ok: false, error: "No resume saved" });
        return;
      }
      const file = base64ToFile(cached.base64, cached.filename);
      const ok = injectFileIntoPage(file);
      sendResponse({ ok });
    })();
    return true;
  }
});

// Init floating UI
createFloatingUI();

console.log("✨ Content script ready — no auto-upload, manual upload only.");

