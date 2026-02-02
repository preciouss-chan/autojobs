// popup/popup.js
console.log("🔥 popup.js loaded");

const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

// Detect Firefox (popup closes on file picker)
const isFirefox = typeof browser !== 'undefined' && browser.runtime && browser.runtime.getBrowserInfo;

function sendRuntimeMessage(message) {
  try {
    const result = browserAPI.runtime.sendMessage(message);
    if (result && typeof result.then === "function") {
      return result;
    }
  } catch (err) {
    return Promise.reject(err);
  }
  return new Promise((resolve, reject) => {
    browserAPI.runtime.sendMessage(message, (resp) => {
      const lastError = browserAPI.runtime.lastError;
      if (lastError) {
        reject(lastError);
        return;
      }
      resolve(resp);
    });
  });
}

// =============== CHECK FOR CACHED RESUME ON LOAD ===============
async function checkCachedResume() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["uploadedResume", "uploadedResumeFilename"], (result) => {
      resolve({
        hasResume: !!result.uploadedResume,
        filename: result.uploadedResumeFilename || null,
        name: result.uploadedResume?.name || null
      });
    });
  });
}

// Display cached resume status when popup opens
(async () => {
  const cached = await checkCachedResume();
  const statusEl = document.getElementById("resumeStatus");
  const clearBtn = document.getElementById("clearResume");
  
  if (cached.hasResume) {
    statusEl.style.display = "block";
    statusEl.textContent = `Cached: ${cached.filename || cached.name || "resume.pdf"}`;
    statusEl.className = "status success";
    clearBtn.style.display = "block";
  }

  // Check API key status
  const apiKeySettings = await new Promise((resolve) => {
    chrome.storage.sync.get(['openaiApiKey'], (result) => {
      resolve(result);
    });
  });

  if (!apiKeySettings.openaiApiKey) {
    const generateBtn = document.getElementById("generate");
    generateBtn.style.opacity = "0.6";
    generateBtn.title = "OpenAI API key not set. Click Settings to configure.";
  }
})();

// =============== OPEN SETTINGS ===============
document.getElementById("openSettings").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

// =============== OPEN CHATBOT ===============
document.getElementById("openChatbot").addEventListener("click", async () => {
  // Get current tab to extract job description
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  // Try to get job description from storage or scrape it
  let jobDescription = "";
  const stored = await chrome.storage.local.get(['lastJobDescription']);
  if (stored.lastJobDescription) {
    jobDescription = stored.lastJobDescription;
  } else {
    // Try to scrape it
    try {
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
      
      const [res] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.__SCRAPE_JOB__?.()
      });
      jobDescription = res?.result || "";
      
      if (jobDescription && jobDescription.length >= 50) {
        chrome.storage.local.set({ lastJobDescription: jobDescription });
      }
    } catch (e) {
      console.warn("Could not scrape job description:", e);
    }
  }
  
  // Open chatbot page with job description as URL param
  const chatbotUrl = chrome.runtime.getURL('chatbot/chatbot.html') + 
    (jobDescription ? `?jobDescription=${encodeURIComponent(jobDescription)}` : '');
  chrome.tabs.create({ url: chatbotUrl });
});

// =============== CLEAR CACHED RESUME ===============
document.getElementById("clearResume").addEventListener("click", async () => {
  chrome.storage.local.remove(["uploadedResume", "uploadedResumeFilename"], () => {
    const statusEl = document.getElementById("resumeStatus");
    const clearBtn = document.getElementById("clearResume");
    statusEl.style.display = "none";
    clearBtn.style.display = "none";
    
    // Reset file input
    document.getElementById("resumeFile").value = "";
  });
});

// =============== GENERATE TAILORED RESUME ===============
document.getElementById("generate").addEventListener("click", async () => {
  console.log("👉 Generate Resume clicked");

  // Check if API key is set
  const apiKeySettings = await new Promise((resolve) => {
    chrome.storage.sync.get(['openaiApiKey'], (result) => {
      resolve(result);
    });
  });
  
  if (!apiKeySettings.openaiApiKey) {
    if (confirm("OpenAI API key not set. Would you like to open settings to configure it?")) {
      chrome.runtime.openOptionsPage();
    }
    return;
  }

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

  // Store job description for chatbot
  if (jobDescription && jobDescription.length >= 50) {
    chrome.storage.local.set({ lastJobDescription: jobDescription });
  }

  if (!jobDescription || jobDescription.length < 50) {
    alert("Could not extract job description.");
    return;
  }

  // Get preferences
  const preferences = await new Promise((resolve) => {
    chrome.storage.sync.get(['showNotifications', 'confirmBeforeUpload'], (result) => {
      resolve(result);
    });
  });

  // Show loading state
  const generateBtn = document.getElementById("generate");
  const originalText = generateBtn.textContent;
  generateBtn.disabled = true;
  generateBtn.textContent = "Generating...";

  // Call background
  try {
    const resp = await sendRuntimeMessage({
      action: "MAKE_RESUME",
      jobDescription,
      tabId: tab.id
    });

    // Reset button
    generateBtn.disabled = false;
    generateBtn.textContent = originalText;

    // Check if response exists
    if (!resp) {
      console.error("No response received from background script");
      alert("No response received. Check the console for errors.");
      return;
    }

    if (resp.error) {
      console.error("Resume generation error:", resp.error);
      
      // Clean up error message - remove HTML tags if present
      let errorMsg = String(resp.error || "Unknown error");
      if (errorMsg.includes('<html>')) {
        // Extract meaningful text from HTML error
        const match = errorMsg.match(/<title>(.*?)<\/title>/i) || errorMsg.match(/<h1>(.*?)<\/h1>/i);
        errorMsg = match ? match[1] : "Backend server error (403 Forbidden)";
      }
      errorMsg = errorMsg.substring(0, 200); // Limit length
      
      if (preferences.showNotifications && errorMsg) {
        try {
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            title: 'Resume Generation Failed',
            message: errorMsg
          }, (notificationId) => {
            if (chrome.runtime.lastError) {
              console.error("Notification error:", chrome.runtime.lastError);
              alert("Resume generation failed: " + errorMsg);
            }
          });
        } catch (notifErr) {
          // Fallback to alert if notifications fail
          alert("Resume generation failed: " + errorMsg);
        }
      } else {
        alert("Resume generation failed: " + errorMsg);
      }
      return;
    }
    
    const message = "Resume tailored and saved!";
    
    if (preferences.showNotifications) {
      try {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          title: 'Resume Generated',
          message: message
        });
      } catch (notifErr) {
        alert(message + " Now go to the apply page.");
      }
    } else {
      alert(message + " Now go to the apply page.");
    }
  } catch (err) {
    // Reset button on runtime error
    generateBtn.disabled = false;
    generateBtn.textContent = originalText;
    console.error("Runtime error:", err);
    alert("Error: " + (err?.message || String(err)));
  }
});


// =============== PREVIEW TAILORED RESUME ===============
document.getElementById("previewResume").addEventListener("click", async () => {
  try {
    const resp = await sendRuntimeMessage({ action: "GET_TAILORED_RESUME" });
    if (!resp || !resp.base64) {
      alert("No tailored resume found. Generate one first!");
      return;
    }

    // Open using a blob URL (Firefox disallows long data: URLs)
    const binary = atob(resp.base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: "application/pdf" });
    const blobUrl = URL.createObjectURL(blob);
    chrome.tabs.create({ url: blobUrl });
    // Revoke after a short delay to allow the tab to load
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
  } catch (err) {
    alert("Error: " + (err?.message || String(err)));
  }
});

// =============== PREVIEW COVER LETTER ===============
document.getElementById("previewCoverLetter").addEventListener("click", async () => {
  try {
    const resp = await sendRuntimeMessage({ action: "GET_COVER_LETTER" });
    if (!resp || !resp.base64) {
      alert("No cover letter found. Generate a tailored resume first!");
      return;
    }

    const statusEl = document.getElementById("downloadStatus");
    statusEl.style.display = "block";
    statusEl.textContent = "Converting to PDF...";
    statusEl.className = "status";

    try {
      // Convert base64 text to actual text (Unicode-safe)
      const binary = atob(resp.base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const coverLetterText = new TextDecoder().decode(bytes);
      
      // Use backend URL (update in background.js when deploying)
      const backendUrl = "http://localhost:3000"; // Update this to match your hosted backend
      
      // Convert to PDF using backend
      const response = await fetch(`${backendUrl}/api/export/cover-letter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: coverLetterText })
      });

      if (!response.ok) {
        throw new Error("Failed to convert cover letter to PDF");
      }

      const blob = await response.blob();
      
      // Open using a blob URL (Firefox disallows long data: URLs)
      const blobUrl = URL.createObjectURL(blob);
      chrome.tabs.create({ url: blobUrl });
      // Revoke after a short delay to allow the tab to load
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
      
      statusEl.textContent = "Cover letter opened in new tab!";
      statusEl.className = "status success";
      setTimeout(() => {
        statusEl.style.display = "none";
      }, 2000);
    } catch (err) {
      statusEl.textContent = `Error: ${err.message}`;
      statusEl.className = "status error";
      console.error("Cover letter preview error:", err);
    }
  } catch (err) {
    alert("Error: " + (err?.message || String(err)));
  }
});

// =============== UPLOAD RESUME ON THIS PAGE ===============
document.getElementById("uploadResume").addEventListener("click", async () => {
  console.log("👉 Upload Resume clicked");

  // Check if confirmation is required
  const preferences = await new Promise((resolve) => {
    chrome.storage.sync.get(['confirmBeforeUpload', 'showNotifications'], (result) => {
      resolve(result);
    });
  });

  if (preferences.confirmBeforeUpload) {
    if (!confirm("Upload resume to the current page?")) {
      return;
    }
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  try {
    const resp = await sendRuntimeMessage({ action: "FORCE_UPLOAD", tabId: tab.id });
    if (resp?.error) {
      const errorMsg = String(resp.error || "Unknown error").substring(0, 200);
      if (preferences.showNotifications && errorMsg) {
        try {
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            title: 'Upload Failed',
            message: errorMsg
          }, (notificationId) => {
            if (chrome.runtime.lastError) {
              alert("Failed to upload resume: " + errorMsg);
            }
          });
        } catch (notifErr) {
          alert("Failed to upload resume: " + errorMsg);
        }
      } else {
        alert("Failed to upload resume: " + errorMsg);
      }
    } else {
      if (preferences.showNotifications) {
        try {
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            title: 'Resume Uploaded',
            message: 'Resume uploaded successfully!'
          });
        } catch (notifErr) {
          alert("Resume uploaded successfully!");
        }
      } else {
        alert("Resume uploaded successfully!");
      }
    }
  } catch (err) {
    alert("Failed to upload resume: " + (err?.message || String(err)));
  }
});

// =============== UPLOAD COVER LETTER ON THIS PAGE ===============
document.getElementById("uploadCoverLetter").addEventListener("click", async () => {
  console.log("👉 Upload Cover Letter clicked");

  // Check if confirmation is required
  const preferences = await new Promise((resolve) => {
    chrome.storage.sync.get(['confirmBeforeUpload', 'showNotifications'], (result) => {
      resolve(result);
    });
  });

  if (preferences.confirmBeforeUpload) {
    if (!confirm("Upload cover letter to the current page?")) {
      return;
    }
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  try {
    const resp = await sendRuntimeMessage({ action: "FORCE_UPLOAD_COVER", tabId: tab.id });
    if (resp?.error) {
      const errorMsg = String(resp.error || "Unknown error").substring(0, 200);
      if (preferences.showNotifications && errorMsg) {
        try {
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            title: 'Upload Failed',
            message: errorMsg
          }, (notificationId) => {
            if (chrome.runtime.lastError) {
              alert("Failed to upload cover letter: " + errorMsg);
            }
          });
        } catch (notifErr) {
          alert("Failed to upload cover letter: " + errorMsg);
        }
      } else {
        alert("Failed to upload cover letter: " + errorMsg);
      }
    } else {
      if (preferences.showNotifications) {
        try {
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            title: 'Cover Letter Uploaded',
            message: 'Cover letter uploaded successfully!'
          });
        } catch (notifErr) {
          alert("Cover letter uploaded successfully!");
        }
      } else {
        alert("Cover letter uploaded successfully!");
      }
    }
  } catch (err) {
    alert("Failed to upload cover letter: " + (err?.message || String(err)));
  }
});

// =============== UPLOAD RESUME FILE (PDF) ===============
// For Firefox: intercept click and open a small popup window (popup closes on file picker)
if (isFirefox) {
  document.getElementById("resumeFile").addEventListener("click", (e) => {
    e.preventDefault();
    // Open dedicated upload page in a small popup window
    chrome.windows.create({
      url: chrome.runtime.getURL('popup/upload-resume.html'),
      type: 'popup',
      width: 500,
      height: 400,
      left: Math.round((screen.width - 500) / 2),
      top: Math.round((screen.height - 400) / 2)
    });
    // Close the popup since we opened a window
    window.close();
  });
}

document.getElementById("resumeFile").addEventListener("change", async (e) => {
  // Skip if Firefox (handled by dedicated window)
  if (isFirefox) return;
  const file = e.target.files[0];
  if (!file) return;

  const statusEl = document.getElementById("resumeStatus");
  statusEl.style.display = "block";
  statusEl.textContent = "Uploading and parsing PDF...";
  statusEl.className = "status";

  try {
    if (!file.name.endsWith(".pdf") && file.type !== "application/pdf") {
      throw new Error("Resume must be a PDF file");
    }

    // Send PDF to backend for parsing
    const formData = new FormData();
    formData.append("file", file);

    // Get API key from settings
    const apiKeySettings = await new Promise((resolve) => {
      chrome.storage.sync.get(['openaiApiKey'], (result) => {
        resolve(result);
      });
    });
    const apiKey = apiKeySettings.openaiApiKey;

    // Use backend URL (update in background.js when deploying)
    const backendUrl = "http://localhost:3000"; // Update this to match your hosted backend
    
    const response = await fetch(`${backendUrl}/api/parse-resume`, {
      method: "POST",
      headers: apiKey ? { "X-OpenAI-API-Key": apiKey } : {},
      body: formData
    });

    // Check content type to ensure we got JSON, not HTML
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const text = await response.text();
      throw new Error(`Server returned non-JSON response. Status: ${response.status}. Make sure the server is running.`);
    }

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || errorData.details || `Failed to parse PDF (Status: ${response.status})`);
    }

    const resumeData = await response.json();

    // Validate basic structure
    if (!resumeData.name || !resumeData.contact) {
      throw new Error("Invalid resume format. Could not extract name and contact information.");
    }

    // Send parsed resume to background for caching
    try {
      const resp = await sendRuntimeMessage({
        action: "UPLOAD_RESUME",
        resumeData,
        filename: file.name
      });
      if (resp?.error) {
        statusEl.textContent = `Error: ${resp.error}`;
        statusEl.className = "status error";
      } else {
        statusEl.textContent = `Resume parsed and cached successfully! (${file.name})`;
        statusEl.className = "status success";
        
        // Show clear button
        document.getElementById("clearResume").style.display = "block";
        
        // Update the display to show it's cached
        setTimeout(() => {
          statusEl.textContent = `Cached: ${file.name}`;
        }, 2000);
      }
    } catch (err) {
      statusEl.textContent = `Error: ${err?.message || String(err)}`;
      statusEl.className = "status error";
    }
  } catch (err) {
    let errorMessage = err.message || "Unknown error occurred";
    
    // Provide more helpful error messages
    if (errorMessage.includes("Failed to fetch") || errorMessage.includes("NetworkError")) {
      errorMessage = "Cannot connect to server. Make sure the Next.js server is running on http://localhost:3000";
    } else if (errorMessage.includes("non-JSON response")) {
      errorMessage = "Server error. Check that the server is running and the /api/parse-resume endpoint exists.";
    }
    
    statusEl.textContent = `Error: ${errorMessage}`;
    statusEl.classList.add("error");
    console.error("Resume upload error:", err);
  }
});

