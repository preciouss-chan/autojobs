// popup/popup.js
console.log("🔥 popup.js loaded");

const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

// Detect Firefox (popup closes on file picker)
const isFirefox = typeof browser !== 'undefined' && browser.runtime && browser.runtime.getBrowserInfo;

// =============== AUTHENTICATION ===============
const API_BASE_URL = "http://localhost:3000/api";
const STORAGE_KEYS = {
  AUTH_TOKEN: "auth_token",
  USER_EMAIL: "user_email",
  CREDITS: "user_credits"
};

async function getAuthToken() {
  return new Promise((resolve) => {
    try {
      browserAPI.storage.sync.get([STORAGE_KEYS.AUTH_TOKEN], (result) => {
        resolve(result?.[STORAGE_KEYS.AUTH_TOKEN] || null);
      });
    } catch (err) {
      console.error("Error getting auth token:", err);
      resolve(null);
    }
  });
}

async function getUserEmail() {
  return new Promise((resolve) => {
    try {
      browserAPI.storage.sync.get([STORAGE_KEYS.USER_EMAIL], (result) => {
        resolve(result?.[STORAGE_KEYS.USER_EMAIL] || null);
      });
    } catch (err) {
      console.error("Error getting user email:", err);
      resolve(null);
    }
  });
}

async function storeAuthToken(token, email) {
  return new Promise((resolve) => {
    try {
      browserAPI.storage.sync.set(
        {
          [STORAGE_KEYS.AUTH_TOKEN]: token,
          [STORAGE_KEYS.USER_EMAIL]: email
        },
        resolve
      );
    } catch (err) {
      console.error("Error storing auth token:", err);
      resolve();
    }
  });
}

async function logout() {
  return new Promise((resolve) => {
    try {
      browserAPI.storage.sync.remove(
        [STORAGE_KEYS.AUTH_TOKEN, STORAGE_KEYS.USER_EMAIL],
        resolve
      );
    } catch (err) {
      console.error("Error logging out:", err);
      resolve();
    }
  });
}

async function refreshCreditsDisplay() {
  try {
    const token = await getAuthToken();
    if (!token) {
      document.getElementById("creditDisplay").style.display = "none";
      return;
    }

    const response = await fetch(`${API_BASE_URL}/credits/balance`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch credits: ${response.statusText}`);
    }

    const data = await response.json();
    const creditCount = document.getElementById("creditCount");
    if (creditCount) {
      creditCount.textContent = data.balance;
    }
    document.getElementById("creditDisplay").style.display = "inline";
    return data.balance;
  } catch (err) {
    console.error("Failed to refresh credits:", err);
    document.getElementById("creditDisplay").style.display = "none";
    return 0;
  }
}

async function updateAuthUI() {
  try {
    const token = await getAuthToken();
    const email = await getUserEmail();
    const loginBtn = document.getElementById("loginBtn");
    const logoutBtn = document.getElementById("logoutBtn");
    const creditDisplay = document.getElementById("creditDisplay");

    if (!loginBtn || !logoutBtn || !creditDisplay) {
      console.warn("Auth UI elements not found");
      return;
    }

    if (token) {
      loginBtn.style.display = "none";
      logoutBtn.style.display = "inline-block";
      await refreshCreditsDisplay();
    } else {
      loginBtn.style.display = "inline-block";
      logoutBtn.style.display = "none";
      creditDisplay.style.display = "none";
    }
  } catch (err) {
    console.error("Error updating auth UI:", err);
  }
}

// Handle login button click
document.getElementById("loginBtn").addEventListener("click", async () => {
  const loginBtn = document.getElementById("loginBtn");
  loginBtn.disabled = true;
  loginBtn.textContent = "Opening login...";

  try {
    const width = 500;
    const height = 600;
    const left = Math.round(screen.width / 2 - width / 2);
    const top = Math.round(screen.height / 2 - height / 2);

    const windowFeatures = `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`;
    // Open the signin page with a callback to the dashboard
    const authWindow = window.open(
      "http://localhost:3000/auth/signin?callbackUrl=http://localhost:3000/dashboard",
      "AutoJobsAuth",
      windowFeatures
    );

    if (!authWindow) {
      throw new Error("Failed to open login window. Check popup blocker.");
    }

    console.log("🔓 Opening login window, polling for completion...");

    // Poll to check if auth is complete
    let checkCount = 0;
    const checkInterval = setInterval(async () => {
      checkCount++;
      
      try {
        // Try to fetch the extension token - if it succeeds, user is logged in
        const tokenResponse = await fetch("http://localhost:3000/api/extension/token", {
          method: "GET",
          credentials: "include", // Include cookies from the signin
          headers: {
            "Content-Type": "application/json"
          }
        });

        if (tokenResponse.ok) {
          const data = await tokenResponse.json();
          console.log("✅ Token fetch successful! User is logged in.");
          clearInterval(checkInterval);
          
          // Close the auth window after a short delay
          setTimeout(() => {
            if (authWindow && !authWindow.closed) {
              authWindow.close();
            }
          }, 500);
          
          // Store the token
          await storeAuthToken(data.token, data.email);
          await updateAuthUI();
          loginBtn.disabled = false;
          loginBtn.textContent = "Login";
          console.log("✅ Login successful:", data.email);
        }
      } catch (err) {
        // Still waiting for login, continue polling
        if (checkCount % 10 === 0) {
          console.log(`⏳ Still waiting for login... (${checkCount}s)`);
        }
      }

      // Check if window was closed manually
      if (authWindow && authWindow.closed) {
        console.log("🔗 Auth window closed by user");
        clearInterval(checkInterval);
      }

      // Timeout after 5 minutes
      if (checkCount > 300) { // 300 * 1 second = 5 minutes
        console.log("❌ Login timeout");
        clearInterval(checkInterval);
        if (authWindow && !authWindow.closed) {
          authWindow.close();
        }
        loginBtn.disabled = false;
        loginBtn.textContent = "Login";
        alert("Login timeout. Please try again.");
      }
    }, 1000); // Check every second

  } catch (err) {
    console.error("Login error:", err);
    alert(`Login failed: ${err.message}`);
    loginBtn.disabled = false;
    loginBtn.textContent = "Login";
  }
});

// Handle logout button click
document.getElementById("logoutBtn").addEventListener("click", async () => {
  await logout();
  await updateAuthUI();
  console.log("✅ Logged out");
});

// Initialize auth UI on popup open
(async () => {
  try {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
    }
    await updateAuthUI();
  } catch (err) {
    console.error("Error initializing auth UI:", err);
  }
})();

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
    browserAPI.storage.local.get(["uploadedResume", "uploadedResumeFilename"], (result) => {
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
})();

// =============== OPEN CHATBOT ===============
document.getElementById("openChatbot").addEventListener("click", async () => {
  // Get current tab to extract job description
  const [tab] = await browserAPI.tabs.query({ active: true, currentWindow: true });
  
  // Try to get job description from storage or scrape it
  let jobDescription = "";
  const stored = await browserAPI.storage.local.get(['lastJobDescription']);
  if (stored.lastJobDescription) {
    jobDescription = stored.lastJobDescription;
  } else {
    // Try to scrape it
    try {
      await browserAPI.scripting.executeScript({
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
      
      const [res] = await browserAPI.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.__SCRAPE_JOB__?.()
      });
      jobDescription = res?.result || "";
      
      if (jobDescription && jobDescription.length >= 50) {
        browserAPI.storage.local.set({ lastJobDescription: jobDescription });
      }
    } catch (e) {
      console.warn("Could not scrape job description:", e);
    }
  }
  
  // Open chatbot page with job description as URL param
  const chatbotUrl = browserAPI.runtime.getURL('chatbot/chatbot.html') + 
    (jobDescription ? `?jobDescription=${encodeURIComponent(jobDescription)}` : '');
  browserAPI.tabs.create({ url: chatbotUrl });
});

// =============== CLEAR CACHED RESUME ===============
document.getElementById("clearResume").addEventListener("click", async () => {
  browserAPI.storage.local.remove(["uploadedResume", "uploadedResumeFilename"], () => {
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

  const [tab] = await browserAPI.tabs.query({ active: true, currentWindow: true });

  // Inject scraper
  await browserAPI.scripting.executeScript({
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
  const [res] = await browserAPI.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => window.__SCRAPE_JOB__?.()
  });
  const jobDescription = res?.result || "";

  // Store job description for chatbot
  if (jobDescription && jobDescription.length >= 50) {
    browserAPI.storage.local.set({ lastJobDescription: jobDescription });
  }

  if (!jobDescription || jobDescription.length < 50) {
    alert("Could not extract job description.");
    return;
  }

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
        errorMsg = match ? match[1] : "Backend server error";
      }
      errorMsg = errorMsg.substring(0, 200); // Limit length
      
      try {
        browserAPI.notifications.create({
          type: 'basic',
          iconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          title: 'Resume Generation Failed',
          message: errorMsg
        });
      } catch (notifErr) {
        alert("Resume generation failed: " + errorMsg);
      }
      return;
    }
    
    const message = "Resume tailored and saved!";
    
    try {
      browserAPI.notifications.create({
        type: 'basic',
        iconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        title: 'Resume Generated',
        message: message
      });
    } catch (notifErr) {
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
    browserAPI.tabs.create({ url: blobUrl });
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
      browserAPI.tabs.create({ url: blobUrl });
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

  const [tab] = await browserAPI.tabs.query({ active: true, currentWindow: true });

  try {
    const resp = await sendRuntimeMessage({ action: "FORCE_UPLOAD", tabId: tab.id });
    if (resp?.error) {
      const errorMsg = String(resp.error || "Unknown error").substring(0, 200);
      try {
        browserAPI.notifications.create({
          type: 'basic',
          iconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          title: 'Upload Failed',
          message: errorMsg
        });
      } catch (notifErr) {
        alert("Failed to upload resume: " + errorMsg);
      }
    } else {
      try {
        browserAPI.notifications.create({
          type: 'basic',
          iconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          title: 'Resume Uploaded',
          message: 'Resume uploaded successfully!'
        });
      } catch (notifErr) {
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

  const [tab] = await browserAPI.tabs.query({ active: true, currentWindow: true });

  try {
    const resp = await sendRuntimeMessage({ action: "FORCE_UPLOAD_COVER", tabId: tab.id });
    if (resp?.error) {
      const errorMsg = String(resp.error || "Unknown error").substring(0, 200);
      try {
        browserAPI.notifications.create({
          type: 'basic',
          iconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          title: 'Upload Failed',
          message: errorMsg
        });
      } catch (notifErr) {
        alert("Failed to upload cover letter: " + errorMsg);
      }
    } else {
      try {
        browserAPI.notifications.create({
          type: 'basic',
          iconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          title: 'Cover Letter Uploaded',
          message: 'Cover letter uploaded successfully!'
        });
      } catch (notifErr) {
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
    browserAPI.windows.create({
      url: browserAPI.runtime.getURL('popup/upload-resume.html'),
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

    // Use backend URL (update when deploying)
    const backendUrl = "http://localhost:3000"; // Update this to match your hosted backend
    
    const response = await fetch(`${backendUrl}/api/parse-resume`, {
      method: "POST",
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
