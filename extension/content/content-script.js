// content/content-script.js
console.log("🔥 Content script loaded on:", window.location.href);

// Floating UI disabled - all functionality in extension popup

function base64ToFile(base64, filename = "resume.pdf", mime = "application/pdf") {
  const parts = base64.split(",");
  const b64 = parts.length === 2 && parts[0].startsWith("data:") ? parts[1] : base64;

  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  return new File([bytes], filename, { type: mime });
}

function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function textToFile(text, filename = "cover_letter.txt", mime = "text/plain") {
  const blob = new Blob([text], { type: mime });
  return new File([blob], filename, { type: mime });
}

function findUploadInput(fileType = "resume") {
  // Workday-specific selectors (often hidden)
  const workdaySelectors = [
    "input[type=file][data-automation-id*='file' i]",
    "input[type=file][data-automation-id*='upload' i]",
    "input[type=file][data-automation-id*='resume' i]",
    "input[type=file][class*='css-' i]", // Workday uses CSS modules
    "input[type=file][accept*='pdf' i]",
    "input[type=file][accept*='doc' i]",
    "input[type=file][class*='file' i]",
    "input[type=file][data-testid*='file' i]",
    "input[type=file]" // Fallback to any file input
  ];

  // Priority selectors for resume - Workday first
  const resumeSelectors = [
    ...workdaySelectors, // Check Workday patterns first
    "input[type=file][name*='resume' i]",
    "input[type=file][id*='resume' i]",
    "input[type=file][name*='cv' i]",
    "input[type=file][id*='cv' i]",
    "input[type=file][name*='document' i]",
    "input[type=file][id*='document' i]"
  ];

  // Priority selectors for cover letter - more comprehensive
  const coverLetterSelectors = [
    "input[type=file][name*='coverletter' i]",
    "input[type=file][id*='coverletter' i]",
    "input[type=file][name*='cover_letter' i]",
    "input[type=file][id*='cover_letter' i]",
    "input[type=file][name*='cover-letter' i]",
    "input[type=file][id*='cover-letter' i]",
    "input[type=file][name*='cover' i]",
    "input[type=file][id*='cover' i]",
    "input[type=file][name*='letter' i]",
    "input[type=file][id*='letter' i]"
  ];

  // Exclusion selectors - inputs to exclude based on fileType
  const excludeSelectors = fileType === "cover" ? resumeSelectors : coverLetterSelectors;

  const selectors = fileType === "cover" ? coverLetterSelectors : resumeSelectors;

  // Try specific selectors first - include hidden inputs for Workday
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) {
      // For Workday, accept hidden inputs too
      const isWorkdayInput = sel.includes('data-automation-id') || sel.includes('css-');
      const isVisible = el.offsetParent !== null;
      const isHiddenButAcceptable = !isVisible && (isWorkdayInput || el.style.display !== 'none');
      
      if (isVisible || isHiddenButAcceptable) {
        console.log(`✅ Found ${fileType} input via selector "${sel}":`, el, `(visible: ${isVisible})`);
        return el;
      }
    }
  }

  // Also check ALL hidden inputs (many forms use hidden file inputs, especially Workday)
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el && !excludeSelectors.some(exSel => {
      const excluded = document.querySelector(exSel);
      return excluded === el;
    })) {
      console.log(`✅ Found ${fileType} input (hidden) via selector "${sel}":`, el);
      return el;
    }
  }

  // Find all file inputs (including hidden ones)
  const allInputs = Array.from(document.querySelectorAll("input[type=file]"));
  const visibleInputs = allInputs.filter(i => i.offsetParent !== null);
  
  console.log(`🔍 Found ${allInputs.length} total file inputs, ${visibleInputs.length} visible`);
  allInputs.forEach((input, idx) => {
    const automationId = input.getAttribute('data-automation-id') || '';
    const className = input.className || '';
    console.log(`  Input ${idx}: id="${input.id}", name="${input.name}", visible=${input.offsetParent !== null}, data-automation-id="${automationId}", class="${className}"`);
  });

  if (allInputs.length === 0) {
    return null;
  }

  // For Workday: if we have hidden inputs with data-automation-id, prefer those
  const workdayInputs = allInputs.filter(i => i.getAttribute('data-automation-id'));
  if (workdayInputs.length > 0 && fileType === "resume") {
    console.log(`✅ Found ${workdayInputs.length} Workday file input(s) with data-automation-id`);
    // Prefer ones with 'file' or 'upload' in the automation-id
    const preferred = workdayInputs.find(i => {
      const id = (i.getAttribute('data-automation-id') || '').toLowerCase();
      return id.includes('file') || id.includes('upload') || id.includes('resume');
    });
    if (preferred) {
      console.log(`✅ Using Workday input:`, preferred);
      return preferred;
    }
    // Otherwise use the first Workday input
    console.log(`✅ Using first Workday input:`, workdayInputs[0]);
    return workdayInputs[0];
  }

  // Exclude inputs that match the opposite type
  const excludedIds = new Set();
  for (const sel of excludeSelectors) {
    const excluded = document.querySelectorAll(sel);
    excluded.forEach(el => excludedIds.add(el));
  }

  // Filter out excluded inputs
  const candidateInputs = visibleInputs.filter(input => !excludedIds.has(input));

  // If only one candidate after exclusion, use it
  if (candidateInputs.length === 1) {
    return candidateInputs[0];
  }

  // If no candidates after exclusion but we have visible inputs, try label matching
  const inputsToCheck = candidateInputs.length > 0 ? candidateInputs : visibleInputs;

  // Try to find by label text and nearby text
  for (const input of inputsToCheck) {
    // Check label
    const label = input.closest("label") || 
                  document.querySelector(`label[for="${input.id}"]`) ||
                  input.parentElement?.querySelector("label");
    
    if (label) {
      const labelText = label.textContent.toLowerCase();
      if (fileType === "cover") {
        if ((labelText.includes("cover") || labelText.includes("letter")) && 
            !labelText.includes("resume") && !labelText.includes("cv")) {
          console.log(`✅ Found ${fileType} input via label:`, input);
          return input;
        }
      } else {
        if ((labelText.includes("resume") || labelText.includes("cv") || labelText.includes("document")) &&
            !labelText.includes("cover") && !labelText.includes("letter")) {
          console.log(`✅ Found ${fileType} input via label:`, input);
          return input;
        }
      }
    }

    // Check nearby headings/text - look for "Cover Letter" heading
    if (fileType === "cover") {
      // Find "Cover Letter" heading and look for file input after it
      const headings = document.querySelectorAll("h1, h2, h3, h4, h5, h6, div, span, label");
      for (const heading of headings) {
        const text = heading.textContent.toLowerCase().trim();
        if ((text.includes("cover letter") || text === "cover letter") && 
            !text.includes("resume")) {
          // Look for file input in the same section or after this heading
          let current = heading.nextElementSibling;
          let depth = 0;
          while (current && depth < 10) {
            const fileInput = current.querySelector("input[type=file]");
            if (fileInput) {
              const name = (fileInput.name || "").toLowerCase();
              const id = (fileInput.id || "").toLowerCase();
              if (!name.includes("resume") && !id.includes("resume") && 
                  !name.includes("cv") && !id.includes("cv")) {
                console.log(`✅ Found ${fileType} input near "Cover Letter" heading:`, fileInput);
                return fileInput;
              }
            }
            current = current.nextElementSibling;
            depth++;
          }
          
          // Also check parent container
          const parent = heading.closest("div, section, fieldset, form, li");
          if (parent) {
            const fileInput = parent.querySelector("input[type=file]");
            if (fileInput) {
              const name = (fileInput.name || "").toLowerCase();
              const id = (fileInput.id || "").toLowerCase();
              if (!name.includes("resume") && !id.includes("resume") && 
                  !name.includes("cv") && !id.includes("cv")) {
                console.log(`✅ Found ${fileType} input in "Cover Letter" container:`, fileInput);
                return fileInput;
              }
            }
          }
        }
      }
    }

    // Check nearby headings/text for resume
    const parent = input.closest("div, section, fieldset, form");
    if (parent && fileType === "resume") {
      const headings = parent.querySelectorAll("h1, h2, h3, h4, h5, h6, label, span, div");
      for (const heading of headings) {
        const text = heading.textContent.toLowerCase();
        if ((text.includes("resume") || text.includes("cv") || text.includes("document")) &&
            !text.includes("cover") && !text.includes("letter")) {
          console.log(`✅ Found ${fileType} input via nearby text:`, input);
          return input;
        }
      }
    }
  }

  // Last resort: if looking for cover letter and we have multiple inputs, 
  // try to find one that's NOT the resume input
  if (fileType === "cover" && allInputs.length > 1) {
    // First, find the resume input
    let resumeInputIndex = -1;
    for (let i = 0; i < allInputs.length; i++) {
      const input = allInputs[i];
      const name = (input.name || "").toLowerCase();
      const id = (input.id || "").toLowerCase();
      if (name.includes("resume") || id.includes("resume") || 
          name.includes("cv") || id.includes("cv")) {
        resumeInputIndex = i;
        break;
      }
    }
    
    // Try inputs after the resume input
    if (resumeInputIndex >= 0 && resumeInputIndex < allInputs.length - 1) {
      for (let i = resumeInputIndex + 1; i < allInputs.length; i++) {
        const input = allInputs[i];
        const name = (input.name || "").toLowerCase();
        const id = (input.id || "").toLowerCase();
        // Skip if it's clearly a resume input
        if (!name.includes("resume") && !id.includes("resume") && 
            !name.includes("cv") && !id.includes("cv")) {
          console.log(`✅ Found ${fileType} input after resume input:`, input);
          return input;
        }
      }
    }
    
    // Try any input that's not the resume input
    for (let i = 0; i < allInputs.length; i++) {
      if (i === resumeInputIndex) continue;
      const input = allInputs[i];
      const name = (input.name || "").toLowerCase();
      const id = (input.id || "").toLowerCase();
      if (!name.includes("resume") && !id.includes("resume") && 
          !name.includes("cv") && !id.includes("cv")) {
        console.log(`✅ Found ${fileType} input (non-resume):`, input);
        return input;
      }
    }
  }

  // Final fallback: for cover letter, don't use resume input
  if (fileType === "cover") {
    console.warn("⚠️ Could not find cover letter input");
    console.warn("⚠️ Available inputs:", allInputs.map(i => ({id: i.id, name: i.name, visible: i.offsetParent !== null})));
    // Don't fallback to resume input - return null so user knows it failed
    return null;
  }
  
  // For resume, prefer visible but fallback to hidden if needed
  // Workday often uses hidden inputs, so don't skip them
  if (visibleInputs.length > 0) {
    return visibleInputs[0];
  }
  
  // If no visible inputs, use the first hidden one (common for Workday)
  if (allInputs.length > 0) {
    console.log(`⚠️ No visible inputs found, using first hidden input:`, allInputs[0]);
    return allInputs[0];
  }
  
  return null;
}

async function injectFileIntoPage(file, fileType = "resume") {
  // DON'T click buttons that trigger file pickers - find the input directly instead
  // Workday has the file input hidden, but we can find it without clicking
  
  // First, try to find the file input directly in Workday containers
  const resumeUploadContainer = document.querySelector('[data-automation-id="resumeUpload"]');
  if (resumeUploadContainer) {
    const fileInput = resumeUploadContainer.querySelector("input[type=file]");
    if (fileInput) {
      console.log("✅ Found Workday file input directly in container:", fileInput);
      return await injectFileIntoInput(fileInput, file, fileType);
    }
  }

  // Don't click anything - find the input directly
  // Workday inputs are already in the DOM, just hidden
  
  const input = findUploadInput(fileType);
  if (!input) {
    console.warn(`⚠️ No ${fileType} upload input found on this page.`);
    
    // Workday fallback: Look for file input in the resumeUpload container
    const resumeUploadContainer = document.querySelector('[data-automation-id="resumeUpload"]');
    if (resumeUploadContainer) {
      const fileInputInContainer = resumeUploadContainer.querySelector("input[type=file]");
      if (fileInputInContainer) {
        console.log("✅ Found file input in Workday resumeUpload container:", fileInputInContainer);
        return await injectFileIntoInput(fileInputInContainer, file, fileType);
      }
    }
    
    // Try to find ANY file input as last resort
    const anyInput = document.querySelector("input[type=file]");
    if (anyInput) {
      console.log("⚠️ Using fallback: any file input found:", anyInput);
      return await injectFileIntoInput(anyInput, file, fileType);
    }
    return false;
  }

  return await injectFileIntoInput(input, file, fileType);
}

async function injectFileIntoInput(input, file, fileType) {
  console.log("📤 Injecting file into input:", input);
  console.log("📄 File details:", { name: file.name, type: file.type, size: file.size });
  
  // Prevent file picker from opening by temporarily removing click handler
  const originalOnClick = input.onclick;
  input.onclick = null;
  
  // Also prevent any click events from bubbling up
  const preventClickHandler = (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    return false;
  };
  input.addEventListener('click', preventClickHandler, { capture: true, once: false });
  
  // Store reference for cleanup
  const cleanupClickHandler = () => {
    input.removeEventListener('click', preventClickHandler, { capture: true });
    input.onclick = originalOnClick;
  };
  
  // For Workday: Don't make input visible, but ensure it's accessible
  // Workday inputs are intentionally hidden and should stay that way
  const isWorkdayInput = input.getAttribute('data-automation-id') || 
                         input.closest('[data-automation-id="resumeUpload"]');
  
  // Make input temporarily accessible if needed (but keep it visually hidden)
  const originalDisplay = input.style.display;
  const originalVisibility = input.style.visibility;
  const originalOpacity = input.style.opacity;
  const originalPosition = input.style.position;
  const originalWidth = input.style.width;
  const originalHeight = input.style.height;
  
  // Make it accessible but keep it visually hidden
  input.style.display = 'block';
  input.style.visibility = 'visible';
  input.style.opacity = '0';
  input.style.position = 'absolute';
  input.style.width = '1px';
  input.style.height = '1px';
  input.style.left = '-9999px';

  // Create a new FileList using DataTransfer
  const dt = new DataTransfer();
  dt.items.add(file);

  // Set files property - try multiple approaches
  try {
    Object.defineProperty(input, 'files', {
      value: dt.files,
      writable: false,
      configurable: true
    });
  } catch (e) {
    console.warn("Could not set files property directly, trying alternative:", e);
    // Alternative: try setting value (though this usually doesn't work for files)
    try {
      input.files = dt.files;
    } catch (e2) {
      console.warn("Alternative method also failed:", e2);
    }
  }

  // Trigger multiple events to ensure form recognizes the file
  // IMPORTANT: Don't trigger 'click' or 'focus' on file inputs - they can open the file picker!
  // Only trigger events that won't cause the browser to open the file picker dialog
  const events = ['input', 'change'];
  for (const eventType of events) {
    const event = new Event(eventType, { bubbles: true, cancelable: true });
    input.dispatchEvent(event);
  }

  // Create a more complete change event
  const changeEvent = new Event('change', { bubbles: true, cancelable: true });
  Object.defineProperty(changeEvent, 'target', { value: input, enumerable: true });
  Object.defineProperty(changeEvent, 'currentTarget', { value: input, enumerable: true });
  input.dispatchEvent(changeEvent);

  // Try InputEvent for better compatibility
  try {
    const inputEvent = new InputEvent('input', { bubbles: true, cancelable: true, data: file.name });
    input.dispatchEvent(inputEvent);
  } catch (e) {
    // InputEvent might not be supported in all browsers
  }

  // Some forms use specific event handlers, try those too
  if (input.onchange) {
    try {
      input.onchange(changeEvent);
    } catch (e) {
      console.warn("onchange handler error:", e);
    }
  }

  // Trigger change on parent form if it exists
  const form = input.closest('form');
  if (form) {
    const formChangeEvent = new Event('change', { bubbles: true, cancelable: true });
    form.dispatchEvent(formChangeEvent);
  }

  // For Workday: trigger events on the container and related elements
  const container = input.closest('[data-automation-id="resumeUpload"]');
  if (container) {
    console.log("🔔 Triggering events on Workday container");
    const containerEvents = ['change', 'input', 'fileSelected'];
    for (const eventName of containerEvents) {
      try {
        const event = new Event(eventName, { bubbles: true, cancelable: true });
        container.dispatchEvent(event);
      } catch (e) {
        console.warn(`Error triggering ${eventName} on container:`, e);
      }
    }
  }

  // For Workday: try to trigger validation/update events
  const customEvents = ['fileSelected', 'fileChange', 'upload', 'drop', 'filesSelected'];
  for (const eventName of customEvents) {
    try {
      const customEvent = new Event(eventName, { bubbles: true, cancelable: true });
      input.dispatchEvent(customEvent);
      
      // Also try on container
      if (container) {
        container.dispatchEvent(customEvent);
      }
    } catch (e) {
      // Ignore if event doesn't work
    }
  }

  // Workday might listen to events on the drop zone
  const dropZone = document.querySelector('[data-automation-id="file-upload-drop-zone"]');
  if (dropZone) {
    console.log("🔔 Triggering drop event on Workday drop zone");
    try {
      // Create a DataTransfer object for the drop event
      const dt = new DataTransfer();
      dt.items.add(file);
      
      const dropEvent = new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer: dt
      });
      dropZone.dispatchEvent(dropEvent);
    } catch (e) {
      console.warn("Error triggering drop event:", e);
    }
  }

  // Restore original styles
  input.style.display = originalDisplay;
  input.style.visibility = originalVisibility;
  input.style.opacity = originalOpacity;
  input.style.position = originalPosition;
  input.style.width = originalWidth;
  input.style.height = originalHeight;
  input.style.left = '';
  
  // Restore original onclick handler and remove click prevention
  cleanupClickHandler();

  console.log(`✅ Uploaded ${fileType} into:`, input, `File: ${file.name} (${file.type}, ${file.size} bytes)`);
  
  // Wait a moment and check if file was accepted
  await new Promise(resolve => setTimeout(resolve, 200));
  
  // Check if files are still there (some forms clear them if invalid)
  if (input.files && input.files.length > 0) {
    console.log(`✅ File appears to be accepted: ${input.files[0].name}`);
    return true;
  } else {
    console.warn(`⚠️ File may not have been accepted by form`);
    return true; // Still return true as we tried our best
  }
}

// Floating UI removed - all functionality moved to extension popup

function getTailoredResume() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: "GET_TAILORED_RESUME" }, (resp) => {
      if (!resp || !resp.base64) return resolve(null);
      resolve(resp);
    });
  });
}

function getCoverLetter() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: "GET_COVER_LETTER" }, (resp) => {
      if (!resp || !resp.base64) return resolve(null);
      resolve(resp);
    });
  });
}

// ---------- Handle Messages from Background ----------
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.action) return;

  // Manual resume upload from popup
  if (msg.action === "FORCE_UPLOAD") {
    (async () => {
      try {
        const cached = await getTailoredResume();
        if (!cached) {
          sendResponse({ ok: false, error: "No resume saved" });
          return;
        }
        const file = base64ToFile(cached.base64, cached.filename);
        const ok = await injectFileIntoPage(file, "resume");
        sendResponse({ ok });
      } catch (err) {
        console.error("Resume upload error:", err);
        sendResponse({ ok: false, error: err.message });
      }
    })();
    return true;
  }

  // Manual cover letter upload from popup
  if (msg.action === "FORCE_UPLOAD_COVER") {
    (async () => {
      const cached = await getCoverLetter();
      if (!cached) {
        sendResponse({ ok: false, error: "No cover letter saved" });
        return;
      }

      try {
        // Cover letter is stored as text (base64 encoded, Unicode-safe)
        const binary = atob(cached.base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const coverLetterText = new TextDecoder().decode(bytes);
        
        // Use backend URL (update in background.js when deploying)
        const backendUrl = "http://localhost:3000"; // Update this to match your hosted backend
        
        // Convert text to PDF using backend API
        const response = await fetch(`${backendUrl}/api/export/cover-letter`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: coverLetterText })
        });

        if (!response.ok) {
          throw new Error("Failed to convert cover letter to PDF");
        }

        const pdfBlob = await response.blob();
        const pdfArrayBuffer = await pdfBlob.arrayBuffer();
        const pdfBase64 = arrayBufferToBase64(pdfArrayBuffer);
        
        // Create PDF file
        const file = base64ToFile(pdfBase64, "cover_letter.pdf", "application/pdf");
        const ok = await injectFileIntoPage(file, "cover");
        sendResponse({ ok });
      } catch (err) {
        console.error("Cover letter upload error:", err);
        sendResponse({ ok: false, error: err.message });
      }
    })();
    return true;
  }
});

console.log("✨ Content script ready — manual upload only.");

