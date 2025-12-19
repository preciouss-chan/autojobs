// popup/popup.js
console.log("🔥 popup.js loaded");

// =============== GENERATE TAILORED RESUME ===============
document.getElementById("generate").addEventListener("click", async () => {
  console.log("👉 Generate Resume clicked");

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  // Inject scraper
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      window.__SCRAPE_JOB__ = () => {
        const sels = [
          ".jobs-description-content__text",
          ".jobs-description__content",
          ".description__text",
          ".jobsearch-JobComponent-description",
          ".jobDescriptionContent",
          "article",
          "main"
        ];
        for (const s of sels) {
          const el = document.querySelector(s);
          if (el && el.innerText.trim().length > 80) return el.innerText;
        }
        return document.body.innerText.slice(0, 3000);
      };
    },
  });

  // Run scraper
  const [res] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => window.__SCRAPE_JOB__?.()
  });
  const jobDescription = res?.result || "";

  if (!jobDescription || jobDescription.length < 50) {
    alert("Could not extract job description.");
    return;
  }

  // Call background
  chrome.runtime.sendMessage(
    {
      action: "MAKE_RESUME",
      jobDescription,
      tabId: tab.id
    },
    (resp) => {
      if (resp?.error) {
        console.error(resp.error);
        alert("Resume generation failed.");
        return;
      }
      alert("Resume tailored and saved! Now go to the apply page.");
    }
  );
});


// =============== UPLOAD RESUME ON THIS PAGE ===============
document.getElementById("uploadResume").addEventListener("click", async () => {
  console.log("👉 Upload Resume clicked");

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  chrome.runtime.sendMessage(
    { action: "FORCE_UPLOAD", tabId: tab.id },
    (resp) => {
      console.log("FORCE_UPLOAD result:", resp);
    }
  );
});

