// popup/popup.js

console.log("🔥 popup.js loaded");

// ===============================
// 1) GENERATE TAILORED RESUME
// ===============================
document.getElementById("generate")?.addEventListener("click", async () => {
  console.log("👉 Generate Resume clicked");

  // Get active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) {
    alert("No active tab found.");
    return;
  }

  //
  // 1️⃣ Inject scraper into the page (page-context)
  //
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      window.__SCRAPE_JOB__ = () => {
        const selectors = [
          ".jobs-description-content__text",
          ".jobs-description__content",
          ".description__text",
          ".jobsearch-JobComponent-description",
          ".jobDescriptionContent",
          "article",
          "main"
        ];

        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el && el.innerText.trim().length > 80) return el.innerText;
        }

        return document.body.innerText.slice(0, 3000);
      };
    },
  });

  //
  // 2️⃣ Execute scraper to extract job description text
  //
  const scraped = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => window.__SCRAPE_JOB__?.(),
  });

  const jobDescription = scraped?.[0]?.result || "";

  if (!jobDescription || jobDescription.length < 50) {
    console.warn("❗ Scraped too little. Got:", jobDescription);
    alert("Could not extract a valid job description on this page.");
    return;
  }

  console.log("📝 Job description scraped:", jobDescription.length, "chars.");

  //
  // 3️⃣ Pass jobDescription to background to generate resume
  //
  chrome.runtime.sendMessage(
    {
      action: "MAKE_RESUME",
      jobDescription,
      tabId: tab.id,
    },
    (resp) => {
      if (chrome.runtime.lastError) {
        console.error("Background error:", chrome.runtime.lastError.message);
        alert("Extension error. Check console.");
        return;
      }

      if (resp?.error) {
        console.error("MAKE_RESUME error:", resp.error);
        alert("Resume generation failed. Check console.");
        return;
      }

      console.log("✅ Resume tailored & saved to storage.");
      alert("Tailored resume saved! Go to the apply page and click UPLOAD RESUME.");
    }
  );
});


// ===============================
// 2) UPLOAD RESUME ON THIS PAGE (MANUAL)
// ===============================
document.getElementById("uploadResume")?.addEventListener("click", async () => {
  console.log("👉 Upload Resume clicked");

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) {
    alert("No active tab found.");
    return;
  }

  chrome.runtime.sendMessage(
    {
      action: "FORCE_UPLOAD",
      tabId: tab.id,
    },
    (resp) => {
      if (chrome.runtime.lastError) {
        console.error("Upload error:", chrome.runtime.lastError.message);
        alert("Failed to upload resume.");
        return;
      }

      console.log("📨 FORCE_UPLOAD response:", resp);
    }
  );
});

