// content/content-script.js

// Inject Greenhouse page-context script for React handling
let greenhouseScriptInjected = false;

function injectGreenhouseScript() {
  if (greenhouseScriptInjected) return Promise.resolve();
  
  return new Promise((resolve) => {
    try {
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('script/greenhouse-inject.js');
      script.onload = () => {
        greenhouseScriptInjected = true;
        resolve();
      };
      script.onerror = () => resolve();
      (document.head || document.documentElement).appendChild(script);
    } catch (e) {
      resolve();
    }
  });
}

// Inject Ashby page-context script for React handling
let ashbyScriptInjected = false;

function injectAshbyScript() {
  if (ashbyScriptInjected) return Promise.resolve();
  
  return new Promise((resolve) => {
    try {
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('script/ashby-inject.js');
      script.onload = () => {
        ashbyScriptInjected = true;
        resolve();
      };
      script.onerror = () => resolve();
      (document.head || document.documentElement).appendChild(script);
    } catch (e) {
      resolve();
    }
  });
}

// Use page context injection for Ashby file uploads
async function uploadViaAshbyContext(file, fileType) {
  await injectAshbyScript();
  await new Promise(resolve => setTimeout(resolve, 100));
  
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1];
      
      const handleResult = (e) => {
        window.removeEventListener('AUTOJOBS_ASHBY_RESULT', handleResult);
        resolve(e.detail.success);
      };
      window.addEventListener('AUTOJOBS_ASHBY_RESULT', handleResult);
      
      setTimeout(() => {
        window.removeEventListener('AUTOJOBS_ASHBY_RESULT', handleResult);
        resolve(true);
      }, 3000);
      
      window.dispatchEvent(new CustomEvent('AUTOJOBS_ASHBY_UPLOAD', {
        detail: { fileData: base64, fileName: file.name, fileType, mimeType: file.type }
      }));
    };
    reader.onerror = () => resolve(false);
    reader.readAsDataURL(file);
  });
}

// Use page context injection for Greenhouse file uploads
async function uploadViaPageContext(file, fileType, inputId) {
  await injectGreenhouseScript();
  await new Promise(resolve => setTimeout(resolve, 100));
  
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1];
      
      const handleResult = (e) => {
        window.removeEventListener('AUTOJOBS_UPLOAD_RESULT', handleResult);
        resolve(e.detail.success);
      };
      window.addEventListener('AUTOJOBS_UPLOAD_RESULT', handleResult);
      
      setTimeout(() => {
        window.removeEventListener('AUTOJOBS_UPLOAD_RESULT', handleResult);
        resolve(true);
      }, 3000);
      
      window.dispatchEvent(new CustomEvent('AUTOJOBS_UPLOAD_FILE', {
        detail: { fileData: base64, fileName: file.name, fileType, mimeType: file.type, inputId }
      }));
    };
    reader.onerror = () => resolve(false);
    reader.readAsDataURL(file);
  });
}

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
  // Check if we're on Ashby (used by Patreon, etc.)
  const isAshby = document.querySelector('.ashby-application-form-autofill-uploader') ||
                  document.querySelector('[class*="ashby-application"]') ||
                  document.querySelector('div[class*="_autofillPane"]');
  
  if (isAshby) {
    console.log("🎨 Ashby detected, using Ashby-specific selectors...");
    
    // Ashby uses hidden file inputs inside uploader containers
    // Find the uploader containers
    const uploaders = document.querySelectorAll('.ashby-application-form-autofill-uploader, [class*="autofill-uploader"]');
    console.log(`🎨 Found ${uploaders.length} Ashby uploaders`);
    
    // For each uploader, check if it's for resume or cover letter
    for (const uploader of uploaders) {
      const input = uploader.querySelector('input[type="file"]');
      if (!input) continue;
      
      // Check the description/header to determine type
      const container = uploader.closest('[class*="_autofillPane"]') || uploader.parentElement;
      const text = container?.textContent?.toLowerCase() || '';
      
      const isResumeUploader = text.includes('resume') || text.includes('cv') || text.includes('résumé');
      const isCoverUploader = text.includes('cover letter') || text.includes('coverletter');
      
      if (fileType === "cover" && isCoverUploader) {
        console.log("🎨 Found Ashby cover letter uploader");
        return input;
      } else if (fileType !== "cover" && (isResumeUploader || (!isCoverUploader && uploaders.length === 1))) {
        console.log("🎨 Found Ashby resume uploader");
        return input;
      }
    }
    
    // Fallback: Just get any file input on Ashby
    const allInputs = document.querySelectorAll('input[type="file"]');
    if (allInputs.length > 0) {
      const index = fileType === "cover" ? Math.min(1, allInputs.length - 1) : 0;
      console.log(`🎨 Ashby fallback: using file input at index ${index}`);
      return allInputs[index];
    }
  }
  
  // Check if we're on Rippling
  const isRippling = window.location.hostname.includes('rippling.com') || 
                     document.querySelector('[data-testid="resume"]') ||
                     document.querySelector('[data-testid="cover_letter"]');
  
  if (isRippling) {
    console.log("🔷 Rippling detected, using Rippling-specific selectors...");
    
    // Rippling uses specific data-testid attributes for file inputs
    // Resume: data-testid="input-resume"
    // Cover letter: data-testid="input-cover_letter"
    const inputTestId = fileType === "cover" ? "input-cover_letter" : "input-resume";
    
    // Direct selector for the file input by data-testid
    let input = document.querySelector(`input[data-testid="${inputTestId}"]`);
    if (input) {
      console.log(`🔷 Found Rippling file input by data-testid="${inputTestId}"`);
      return input;
    }
    
    // Fallback: Find inside the label
    const labelTestId = fileType === "cover" ? "cover_letter" : "resume";
    const label = document.querySelector(`label[data-testid="${labelTestId}"]`);
    if (label) {
      // Check for input inside the label (type="File" or type="file")
      input = label.querySelector('input[type="file"], input[type="File"]');
      if (input) {
        console.log(`🔷 Found Rippling file input inside label[data-testid="${labelTestId}"]`);
        return input;
      }
    }
    
    // Last fallback: Try to find any file input on the page
    const allInputs = document.querySelectorAll('input[type="file"], input[type="File"]');
    console.log(`🔷 Rippling: Found ${allInputs.length} file inputs on page`);
    
    if (allInputs.length > 0) {
      // For resume, prefer the first one; for cover letter, prefer the second if available
      const index = fileType === "cover" ? Math.min(1, allInputs.length - 1) : 0;
      console.log(`🔷 Using file input at index ${index}`);
      return allInputs[index];
    }
  }
  
  // Check if we're on LinkedIn
  const isLinkedIn = window.location.hostname.includes('linkedin.com');
  
  // LinkedIn Easy Apply specific selectors
  const linkedInSelectors = [
    // LinkedIn uses specific class patterns for file inputs
    "input[type=file][id*='jobs-document-upload' i]",
    "input[type=file][class*='jobs-document-upload' i]",
    "input[type=file][data-test-file-input]",
    "input[type=file][name*='file' i]",
    // LinkedIn modal file inputs - they're often in specific containers
    ".jobs-easy-apply-modal input[type=file]",
    ".jobs-apply-form input[type=file]",
    ".artdeco-modal input[type=file]",
    "[data-test-modal] input[type=file]",
    // Generic LinkedIn patterns
    "input[type=file][accept*='.pdf' i]",
    "input[type=file][accept*='.doc' i]"
  ];

  // Greenhouse-specific selectors
  const greenhouseSelectors = [
    "input[type=file][name*='resume' i]",
    "input[type=file][id*='resume' i]",
    "input[type=file][class*='file-input' i]",
    "input[type=file][class*='fileInput' i]",
    "input[type=file][class*='resume' i]",
    "input[type=file][data-field-name*='resume' i]",
    "input[type=file][data-field-name*='cv' i]",
    "input[type=file][name*='application[resume]' i]",
    "input[type=file][name*='application[resume_file]' i]",
    "input[type=file][name*='resume_file' i]",
    "input[type=file][accept*='pdf' i]",
    "input[type=file][accept*='doc' i]",
    "input[type=file][accept*='application/pdf' i]"
  ];

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

  // Priority selectors for resume - LinkedIn first if on LinkedIn, then Greenhouse and Workday
  // IMPORTANT: Check exact IDs first for Greenhouse (id="resume")
  const resumeSelectors = [
    // LinkedIn selectors first if on LinkedIn
    ...(isLinkedIn ? linkedInSelectors : []),
    "input[type=file]#resume", // Exact match for Greenhouse
    "input[type=file][id='resume']", // Exact match alternative
    ...greenhouseSelectors, // Check Greenhouse patterns
    ...workdaySelectors, // Then Workday patterns
    "input[type=file][name*='resume' i]",
    "input[type=file][id*='resume' i]",
    "input[type=file][name*='cv' i]",
    "input[type=file][id*='cv' i]",
    "input[type=file][name*='document' i]",
    "input[type=file][id*='document' i]"
  ];

  // Priority selectors for cover letter - more comprehensive
  const coverLetterSelectors = [
    // Greenhouse-specific (exact matches first)
    "input[type=file]#cover_letter",
    "input[type=file][id='cover_letter']",
    "input[type=file][name*='application[cover_letter]' i]",
    "input[type=file][name*='application[cover_letter_file]' i]",
    "input[type=file][name*='cover_letter_file' i]",
    "input[type=file][data-field-name*='cover' i]",
    "input[type=file][data-field-name*='letter' i]",
    // Generic
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

  // FIRST: Check for exact IDs (Greenhouse uses id="resume" and id="cover_letter")
  // This is the most reliable way to find Greenhouse inputs
  const exactId = fileType === "cover" ? "cover_letter" : "resume";
  const exactInput = document.getElementById(exactId);
  if (exactInput && exactInput.type === 'file') {
    return exactInput;
  }

  // Try specific selectors - include hidden inputs for Workday/Greenhouse
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) {
      // For Workday/Greenhouse, accept hidden inputs too
      const isWorkdayInput = sel.includes('data-automation-id') || sel.includes('css-');
      const isGreenhouseInput = sel.includes('application[') || sel.includes('data-field-name') || sel.includes('file-input') || sel.includes('fileInput') || 
                                 el.id === 'resume' || el.id === 'cover_letter' || el.name?.includes('resume') || el.name?.includes('cover') || el.name?.includes('application');
      const hasVisuallyHiddenClass = el.classList.contains('visually-hidden') || el.classList.contains('visuallyHidden');
      const isVisible = el.offsetParent !== null;
      // Accept Greenhouse inputs even if they have visually-hidden class or are not visible
      // IMPORTANT: Always accept inputs with exact IDs (id="resume" or id="cover_letter")
      const isExactGreenhouseId = el.id === 'resume' || el.id === 'cover_letter';
      const isHiddenButAcceptable = !isVisible && (isWorkdayInput || isGreenhouseInput || hasVisuallyHiddenClass || isExactGreenhouseId || el.style.display !== 'none');
      
      if (isVisible || isHiddenButAcceptable || isExactGreenhouseId) {
        return el;
      }
    }
  }

  // Also check ALL hidden inputs (many forms use hidden file inputs, especially Workday/Greenhouse)
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el && !excludeSelectors.some(exSel => {
      const excluded = document.querySelector(exSel);
      return excluded === el;
    })) {
      // Accept Greenhouse inputs with visually-hidden class
      const hasVisuallyHiddenClass = el.classList.contains('visually-hidden') || el.classList.contains('visuallyHidden');
      const isGreenhouseInput = el.id === 'resume' || el.id === 'cover_letter' || el.name?.includes('resume') || el.name?.includes('cover') || el.name?.includes('application');
      if (hasVisuallyHiddenClass || isGreenhouseInput || el.offsetParent !== null) {
        return el;
      }
    }
  }

  // Find all file inputs (including hidden ones)
  const allInputs = Array.from(document.querySelectorAll("input[type=file]"));
  const visibleInputs = allInputs.filter(i => {
    const hasVisuallyHidden = i.classList.contains('visually-hidden') || i.classList.contains('visuallyHidden');
    // Consider visually-hidden inputs as "visible" for Greenhouse
    return i.offsetParent !== null || hasVisuallyHidden;
  });
  
  allInputs.forEach((input, idx) => {
    const automationId = input.getAttribute('data-automation-id') || '';
    const className = input.className || '';
    const hasVisuallyHidden = input.classList.contains('visually-hidden') || input.classList.contains('visuallyHidden');
  });

  if (allInputs.length === 0) {
    return null;
  }

  // For Workday: if we have hidden inputs with data-automation-id, prefer those
  const workdayInputs = allInputs.filter(i => i.getAttribute('data-automation-id'));
  if (workdayInputs.length > 0 && fileType === "resume") {
    // Prefer ones with 'file' or 'upload' in the automation-id
    const preferred = workdayInputs.find(i => {
      const id = (i.getAttribute('data-automation-id') || '').toLowerCase();
      return id.includes('file') || id.includes('upload') || id.includes('resume');
    });
    if (preferred) {
      return preferred;
    }
    // Otherwise use the first Workday input
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
          return input;
        }
      } else {
        if ((labelText.includes("resume") || labelText.includes("cv") || labelText.includes("document")) &&
            !labelText.includes("cover") && !labelText.includes("letter")) {
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
                return fileInput;
              }
            }
          }
        }
      }
    }

    // Greenhouse-specific: Check for label elements that wrap or are associated with file inputs
    if (fileType === "resume") {
      const labels = document.querySelectorAll("label");
      for (const label of labels) {
        const labelText = label.textContent.toLowerCase();
        if ((labelText.includes("resume") || labelText.includes("cv") || labelText.includes("document")) &&
            !labelText.includes("cover") && !labelText.includes("letter")) {
          // Check if label wraps the input
          const wrappedInput = label.querySelector("input[type=file]");
          if (wrappedInput) {
            return wrappedInput;
          }
          // Check if label is associated via 'for' attribute
          const labelFor = label.getAttribute("for");
          if (labelFor) {
            const associatedInput = document.getElementById(labelFor);
            if (associatedInput && associatedInput.type === "file") {
              return associatedInput;
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
        return input;
      }
    }
  }

  // Final fallback: for cover letter, don't use resume input
  if (fileType === "cover") {
    // Don't fallback to resume input - return null so user knows it failed
    return null;
  }
  
  // For resume, prefer visible but fallback to hidden if needed
  // Workday/Greenhouse often use hidden or visually-hidden inputs, so don't skip them
  if (visibleInputs.length > 0) {
    // Prefer inputs with id="resume" for Greenhouse
    const greenhouseResumeInput = visibleInputs.find(i => i.id === 'resume' || i.name?.includes('resume'));
    if (greenhouseResumeInput) {
      return greenhouseResumeInput;
    }
    return visibleInputs[0];
  }
  
  // If no visible inputs, use the first hidden one (common for Workday/Greenhouse)
  if (allInputs.length > 0) {
    // Prefer inputs with id="resume" for Greenhouse
    const greenhouseResumeInput = allInputs.find(i => i.id === 'resume' || i.name?.includes('resume'));
    if (greenhouseResumeInput) {
      return greenhouseResumeInput;
    }
    return allInputs[0];
  }
  
  return null;
}

async function injectFileIntoPage(file, fileType = "resume") {
  // DON'T click buttons that trigger file pickers - find the input directly instead
  // Workday/Greenhouse have file inputs that may be hidden, but we can find them without clicking
  
  // For LinkedIn Easy Apply: Find file input in the modal
  if (window.location.hostname.includes('linkedin.com')) {
    console.log("📘 LinkedIn detected, looking for Easy Apply file input...");
    
    // LinkedIn modals have specific selectors
    const linkedInContainers = [
      document.querySelector('.jobs-easy-apply-modal'),
      document.querySelector('.artdeco-modal--is-open'),
      document.querySelector('[data-test-modal]'),
      document.querySelector('.jobs-apply-form'),
      document.querySelector('[class*="jobs-document-upload"]')
    ];
    
    for (const container of linkedInContainers) {
      if (container) {
        const fileInput = container.querySelector('input[type=file]');
        if (fileInput) {
          console.log("📘 Found LinkedIn file input in modal");
          return await injectFileIntoInput(fileInput, file, fileType);
        }
      }
    }
    
    // Try to find any file input on the page (LinkedIn might have it outside modal)
    const allFileInputs = document.querySelectorAll('input[type=file]');
    for (const input of allFileInputs) {
      // Prefer inputs that are in visible modals or forms
      const isInModal = input.closest('.artdeco-modal, .jobs-easy-apply-modal');
      if (isInModal) {
        console.log("📘 Found LinkedIn file input in artdeco modal");
        return await injectFileIntoInput(input, file, fileType);
      }
    }
  }
  
  // First, try to find the file input directly in Greenhouse containers
  const greenhouseContainers = [
    document.querySelector('[class*="file-input"]'),
    document.querySelector('[class*="fileInput"]'),
    document.querySelector('[class*="resume-upload"]'),
    document.querySelector('[class*="resumeUpload"]'),
    document.querySelector('label[for*="resume"]'),
    document.querySelector('label[for*="application_resume"]')
  ];
  
  for (const container of greenhouseContainers) {
    if (container) {
      const fileInput = container.querySelector("input[type=file]");
      if (fileInput) {
        return await injectFileIntoInput(fileInput, file, fileType);
      }
    }
  }
  
  // For Greenhouse: ALWAYS check exact ID first (most reliable)
  if (window.location.hostname.includes('greenhouse.io')) {
    const exactId = fileType === "cover" ? "cover_letter" : "resume";
    const exactInput = document.getElementById(exactId);
    if (exactInput && exactInput.type === 'file') {
      return await injectFileIntoInput(exactInput, file, fileType);
    }
  }
  
  // Try to find the file input directly in Workday containers
  const resumeUploadContainer = document.querySelector('[data-automation-id="resumeUpload"]');
  if (resumeUploadContainer) {
    const fileInput = resumeUploadContainer.querySelector("input[type=file]");
    if (fileInput) {
      return await injectFileIntoInput(fileInput, file, fileType);
    }
  }
  
  // Use findUploadInput as fallback
  const input = findUploadInput(fileType);
  if (input) {
    return await injectFileIntoInput(input, file, fileType);
  }
  
  // Last resort: Try to find ANY file input
  const anyInput = document.querySelector("input[type=file]");
  if (anyInput) {
    return await injectFileIntoInput(anyInput, file, fileType);
  }
  
    return false;
  }

async function injectFileIntoInput(input, file, fileType) {
  // Detect Ashby (used by Patreon, etc.)
  const isAshby = document.querySelector('.ashby-application-form-autofill-uploader') ||
                  document.querySelector('[class*="ashby-application"]') ||
                  document.querySelector('div[class*="_autofillPane"]');
  
  // Detect Rippling
  const isRippling = window.location.hostname.includes('rippling.com') || 
                     document.querySelector('[data-testid="resume"]') ||
                     document.querySelector('[data-testid="cover_letter"]');
  
  // Detect LinkedIn Easy Apply
  const isLinkedIn = window.location.hostname.includes('linkedin.com');
  
  // For Ashby: Use page context injection to properly trigger React handlers
  if (isAshby) {
    console.log("🎨 Ashby detected, using page context injection...");
    const ashbySuccess = await uploadViaAshbyContext(file, fileType);
    if (ashbySuccess) {
      console.log("✅ Ashby upload successful via page context");
      return true;
    }
    console.log("⚠️ Ashby page context upload completed, continuing...");
  }
  
  // For Rippling: Use React-compatible file injection
  if (isRippling) {
    console.log("🔷 Rippling detected, using Rippling-specific upload...");
    
    // Make sure we have the correct input by data-testid
    const inputTestId = fileType === "cover" ? "input-cover_letter" : "input-resume";
    const targetInput = document.querySelector(`input[data-testid="${inputTestId}"]`) || input;
    
    console.log(`🔷 Using input with data-testid: ${targetInput.getAttribute('data-testid') || 'none'}`);
    
    // Set the file using DataTransfer
  const dt = new DataTransfer();
  dt.items.add(file);

    try {
      Object.defineProperty(targetInput, 'files', {
        value: dt.files,
        writable: false,
        configurable: true,
        enumerable: true
      });
    } catch (e) {
      targetInput.files = dt.files;
    }
    
    console.log(`🔷 Rippling: Set files on input, now has ${targetInput.files?.length || 0} files`);
    
    // Rippling uses React, so we need to trigger React's synthetic events
    // First, try to find React fiber and call onChange directly
    const reactKey = Object.keys(targetInput).find(key => 
      key.startsWith('__reactFiber$') || 
      key.startsWith('__reactInternalInstance$') ||
      key.startsWith('__reactProps$')
    );
    
    if (reactKey) {
      console.log(`🔷 Found React on Rippling input: ${reactKey}`);
      try {
        const reactInstance = targetInput[reactKey];
        // Try to find onChange in the fiber tree
        let fiber = reactInstance;
        for (let i = 0; i < 15 && fiber; i++) {
          const props = fiber.memoizedProps || fiber.pendingProps || fiber.stateNode?.props;
          if (props?.onChange) {
            console.log("🔷 Found onChange handler, calling it...");
            const syntheticEvent = {
              target: targetInput,
              currentTarget: targetInput,
              type: 'change',
              bubbles: true,
              preventDefault: () => {},
              stopPropagation: () => {},
              nativeEvent: new Event('change', { bubbles: true })
            };
            props.onChange(syntheticEvent);
            break;
          }
          fiber = fiber.return;
        }
      } catch (e) {
        console.warn("🔷 Error calling React onChange:", e);
      }
    }
    
    // Trigger standard events with delays
    const triggerEvents = async () => {
      const events = ['focus', 'input', 'change', 'blur'];
      for (const eventName of events) {
        try {
          const event = new Event(eventName, { bubbles: true, cancelable: true });
          Object.defineProperty(event, 'target', { value: targetInput, enumerable: true });
          targetInput.dispatchEvent(event);
          await new Promise(r => setTimeout(r, 50));
        } catch (e) {}
      }
    };
    
    await triggerEvents();
    
    // Also trigger on the label element and button
    const labelTestId = fileType === "cover" ? "cover_letter" : "resume";
    const label = document.querySelector(`label[data-testid="${labelTestId}"]`);
    if (label) {
      try {
        label.dispatchEvent(new Event('change', { bubbles: true }));
        // Also click the button to trigger any handlers
        const button = label.querySelector('button[data-testid="test_button"]');
        if (button) {
          // Don't actually click (opens file picker), just trigger change events
          button.dispatchEvent(new Event('change', { bubbles: true }));
        }
      } catch (e) {}
    }
    
    // Trigger events again after a delay
    await new Promise(r => setTimeout(r, 200));
    await triggerEvents();
    
    // Check if it worked
    if (targetInput.files && targetInput.files.length > 0) {
      console.log("✅ Rippling file upload appears successful:", targetInput.files[0].name);
      return true;
    } else {
      console.log("⚠️ Rippling: File may not have been accepted by React, continuing with standard approach...");
    }
    
    // Update input reference for the rest of the function
    input = targetInput;
  }
  
  // Detect Greenhouse and use page context injection for React handling
  const isGreenhouse = window.location.hostname.includes('greenhouse.io') ||
                       window.location.hostname.includes('boards.greenhouse') ||
                       input.name?.includes('application[') ||
                       input.getAttribute('data-field-name') ||
                       document.querySelector('.greenhouse-job-board') ||
                       document.querySelector('[data-controller="job-boards"]') ||
                       (input.id === 'resume' && document.querySelector('.file-upload_wrapper')) ||
                       (input.id === 'cover_letter' && document.querySelector('.file-upload_wrapper'));
  
  // For LinkedIn: Use special handling
  if (isLinkedIn) {
    console.log("📘 LinkedIn Easy Apply detected, using LinkedIn-specific upload...");
    
    // Find the file input in the modal
    const modal = document.querySelector('.jobs-easy-apply-modal, .artdeco-modal, [data-test-modal]');
    if (modal) {
      // Look for file input inside the modal
      const modalInput = modal.querySelector('input[type=file]');
      if (modalInput && modalInput !== input) {
        input = modalInput;
      }
    }
    
    // Set the file using DataTransfer
    const dt = new DataTransfer();
    dt.items.add(file);
    
    try {
      Object.defineProperty(input, 'files', {
        value: dt.files,
        writable: false,
        configurable: true,
        enumerable: true
      });
    } catch (e) {
  input.files = dt.files;
    }
    
    // Trigger events that LinkedIn's React app expects
    const events = ['input', 'change'];
    for (const eventName of events) {
      const event = new Event(eventName, { bubbles: true, cancelable: true });
      input.dispatchEvent(event);
    }
    
    // Also try focus and blur to trigger validation
    input.focus();
    setTimeout(() => {
      input.blur();
      // Trigger change again after blur
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, 100);
    
    // Check if it worked
    if (input.files && input.files.length > 0) {
      console.log("✅ LinkedIn file upload appears successful:", input.files[0].name);
  return true;
    }
  }
  
  if (isGreenhouse) {
    const inputId = fileType === "cover" ? "cover_letter" : "resume";
    const pageContextResult = await uploadViaPageContext(file, fileType, inputId);
    
    if (pageContextResult) {
      const verifyInput = document.getElementById(inputId) || input;
      if (verifyInput.files && verifyInput.files.length > 0) {
        return true;
      }
    }
    input = document.getElementById(inputId) || input;
  }
  
  // Get form reference once (used multiple times in this function)
  let form = input.closest('form');
  
  // Standard approach: prevent file picker from opening
  let originalOnClick = input.onclick;
  let preventClickHandler;
  let cleanupClickHandler;
  
  originalOnClick = input.onclick;
  input.onclick = null;
  
  preventClickHandler = (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    return false;
  };
  input.addEventListener('click', preventClickHandler, { capture: true, once: false });
  
  cleanupClickHandler = () => {
    input.removeEventListener('click', preventClickHandler, { capture: true });
    input.onclick = originalOnClick;
  };
  
  // Make input temporarily accessible
  const originalStyles = {
    display: input.style.display,
    visibility: input.style.visibility,
    opacity: input.style.opacity,
    position: input.style.position,
    width: input.style.width,
    height: input.style.height
  };
  
  input.style.display = 'block';
  input.style.visibility = 'visible';
  input.style.opacity = '0';
  input.style.position = 'absolute';
  input.style.width = '1px';
  input.style.height = '1px';
  input.style.left = '-9999px';

  // Set files using DataTransfer
  const dt = new DataTransfer();
  dt.items.add(file);

  try {
    Object.defineProperty(input, 'files', {
      value: dt.files,
      writable: false,
      configurable: true,
      enumerable: true
    });
  } catch (e) {
    try {
  input.files = dt.files;
    } catch (e2) {
      return false;
    }
  }
  
  if (!input.files || input.files.length === 0) {
    return false;
  }
  
  // Dispatch change and input events
  input.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
  input.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
  
  if (form) {
    form.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
  }
  
  // For non-Greenhouse sites: Try to trigger React onChange if present
  if (!isGreenhouse) {
    const reactKey = Object.keys(input).find(key => 
      key.startsWith('__reactFiber') || key.startsWith('__reactInternalInstance')
    );
    
    if (reactKey) {
      let current = input[reactKey];
      for (let depth = 0; current && depth < 20; depth++) {
        if (current.memoizedProps?.onChange) {
          try {
            current.memoizedProps.onChange({
              target: input,
              currentTarget: input,
              type: 'change',
              bubbles: true,
              nativeEvent: new Event('change', { bubbles: true })
            });
          } catch (e) {}
        }
        current = current.return;
      }
    }
  } else {
    // Greenhouse: Page context injection already handled React, just trigger basic events
      
      // Method 1: Check for React DevTools hook and try to access React internals
      if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
        try {
          const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
          if (hook.renderers && hook.renderers.size > 0) {
            
            // Try to find the component that owns this input
            hook.renderers.forEach((renderer, id) => {
              try {
                // Try to find the fiber node using renderer's methods
                if (renderer.findFiberByHostInstance) {
                  const fiber = renderer.findFiberByHostInstance(input);
                  if (fiber) {
                    // Walk up to find onChange handler
                    let current = fiber;
                    for (let i = 0; i < 20 && current; i++) {
                      if (current.memoizedProps?.onChange) {
                        try {
                          const nativeEvent = new Event('change', { bubbles: true, cancelable: true });
                          current.memoizedProps.onChange({
                            target: input,
                            currentTarget: input,
                            nativeEvent: nativeEvent
                          });
                        } catch (e) {
                        }
                        break;
                      }
                      current = current.return;
                    }
                  }
                }
              } catch (e) {
                // Some renderers don't support this
              }
            });
          }
        } catch (e) {
        }
      }
      
      // Method 2: Try to find React via the form element and walk the tree
      const formElement = input.closest('form');
      if (formElement) {
        // Check if form has React fiber
        const formReactKey = Object.keys(formElement).find(key => 
          key.startsWith('__reactFiber') || key.startsWith('__reactInternalInstance')
        );
        if (formReactKey) {
          const formFiber = formElement[formReactKey];
          
          // Walk the fiber tree to find the input's component
          // Use a recursive function to search all nodes
          const findInputComponent = (node, depth = 0, maxDepth = 50) => {
            if (!node || depth > maxDepth) return null;
            
            // Check if this node owns our input
            if (node.stateNode === input) {
              return node;
            }
            
            // Check memoizedProps for onChange (might be the handler)
            if (node.memoizedProps?.onChange && node.stateNode) {
              // Check if stateNode contains our input
              try {
                if (node.stateNode.querySelector && node.stateNode.querySelector(`#${input.id}`)) {
                  return node;
                }
              } catch (e) {}
            }
            
            // Search children, siblings, and return
            return findInputComponent(node.child, depth + 1, maxDepth) ||
                   findInputComponent(node.sibling, depth + 1, maxDepth) ||
                   findInputComponent(node.return, depth + 1, maxDepth);
          };
          
          const inputComponent = findInputComponent(formFiber);
          if (inputComponent) {
            
            // Try multiple ways to trigger onChange
            if (inputComponent.memoizedProps?.onChange) {
              try {
                const nativeEvent = new Event('change', { bubbles: true, cancelable: true });
                const syntheticEvent = {
                  target: input,
                  currentTarget: input,
                  bubbles: true,
                  cancelable: true,
                  nativeEvent: nativeEvent,
                  preventDefault: () => {},
                  stopPropagation: () => {},
                  type: 'change'
                };
                inputComponent.memoizedProps.onChange(syntheticEvent);
              } catch (e) {
              }
            }
            
            // Also check stateNode
            if (inputComponent.stateNode?.props?.onChange) {
              try {
                const nativeEvent = new Event('change', { bubbles: true, cancelable: true });
                inputComponent.stateNode.props.onChange({
                  target: input,
                  currentTarget: input,
                  nativeEvent: nativeEvent
                });
              } catch (e) {
              }
            }
          } else {
          }
        } else {
        }
      }
      
      // Method 3: Try clicking the label AFTER setting file (might trigger React's handler)
      const label = input.closest('label') || (input.id ? document.querySelector(`label[for="${input.id}"]`) : null);
      if (label) {
        setTimeout(() => {
          try {
            // Create a more realistic click event
            const clickEvent = new MouseEvent('click', {
              bubbles: true,
              cancelable: true,
              view: window,
              detail: 1,
              buttons: 1
            });
            label.dispatchEvent(clickEvent);
          } catch (e) {
          }
        }, 300);
      }
    }
  

  // Additional event triggering (complementary to the immediate events above)
  // Create a comprehensive change event with all properties React might check
  const changeEvent = new Event('change', { bubbles: true, cancelable: true });
  Object.defineProperty(changeEvent, 'target', { 
    value: input, 
    enumerable: true,
    writable: false,
    configurable: false
  });
  Object.defineProperty(changeEvent, 'currentTarget', { 
    value: input, 
    enumerable: true,
    writable: false,
    configurable: false
  });
  // Try to set isTrusted, but don't fail if it's already defined
  try {
    if (!('isTrusted' in changeEvent) || Object.getOwnPropertyDescriptor(changeEvent, 'isTrusted')?.configurable) {
      Object.defineProperty(changeEvent, 'isTrusted', { value: false, enumerable: true });
    }
  } catch (e) {
    // isTrusted is non-configurable on Event objects, ignore the error
  }
  
  // Trigger events multiple times with slight delays to ensure React catches them
  const triggerEvents = () => {
    // Input event first
    try {
      const inputEvt = new InputEvent('input', { 
        bubbles: true, 
        cancelable: true, 
        data: file.name,
        inputType: 'insertText'
      });
      Object.defineProperty(inputEvt, 'target', { value: input, enumerable: true });
      input.dispatchEvent(inputEvt);
    } catch (e) {
      const inputEvt = new Event('input', { bubbles: true, cancelable: true });
      Object.defineProperty(inputEvt, 'target', { value: input, enumerable: true });
      input.dispatchEvent(inputEvt);
    }
    
    // Then change event
    input.dispatchEvent(changeEvent);
  };
  
  // Trigger immediately
  triggerEvents();
  
  // Trigger again after short delays (React sometimes batches updates)
  setTimeout(triggerEvents, 50);
  setTimeout(triggerEvents, 100);

  // Some forms use specific event handlers, try those too
  if (input.onchange) {
    try {
      input.onchange(changeEvent);
    } catch (e) {
    }
  }
  
  // For Greenhouse: Also try calling the input's value setter if it exists
  // This sometimes triggers React's controlled component update
  try {
    const valueDescriptor = Object.getOwnPropertyDescriptor(input, 'value');
    if (valueDescriptor && valueDescriptor.set) {
      // Try setting value to file name (some forms track this)
      valueDescriptor.set.call(input, file.name);
    }
  } catch (e) {
    // Ignore - value might not be settable
  }
  
  // Trigger change on parent form if it exists (for form validation)
  // Note: form is already declared at the top of the function
  if (form) {
    const formChangeEvent = new Event('change', { bubbles: true, cancelable: true });
    form.dispatchEvent(formChangeEvent);
    
    // Also trigger input event on form
    const formInputEvent = new Event('input', { bubbles: true, cancelable: true });
    form.dispatchEvent(formInputEvent);
    
  }

  // For Greenhouse: trigger events on the label if it exists
  const label = input.closest('label') || 
                (input.id ? document.querySelector(`label[for="${input.id}"]`) : null);
  if (label) {
    const labelEvents = ['change', 'input'];
    for (const eventName of labelEvents) {
      try {
        const event = new Event(eventName, { bubbles: true, cancelable: true });
        label.dispatchEvent(event);
      } catch (e) {
      }
    }
  }

  // For Greenhouse: Find and trigger events on the file display element
  // Greenhouse often shows the filename in a separate element
  if (input.id === 'resume' || input.id === 'cover_letter' || input.name?.includes('resume') || input.name?.includes('cover')) {
    // Look for common Greenhouse file display elements
    const fileDisplaySelectors = [
      `[for="${input.id}"] + *`,
      `label[for="${input.id}"] + *`,
      `input#${input.id} + *`,
      '[class*="file-name"]',
      '[class*="fileName"]',
      '[class*="file-display"]'
    ];
    
    for (const sel of fileDisplaySelectors) {
      try {
        const displayEl = document.querySelector(sel);
        if (displayEl) {
          const displayEvents = ['change', 'input'];
          for (const eventName of displayEvents) {
            try {
              const event = new Event(eventName, { bubbles: true, cancelable: true });
              displayEl.dispatchEvent(event);
            } catch (e) {
              // Ignore errors
            }
          }
        }
      } catch (e) {
        // Ignore selector errors
      }
    }
  }

  // For Greenhouse: trigger events on the container and related elements
  // Target Greenhouse's specific structure: .file-upload > .file-upload_wrapper
  const fileUploadContainer = input.closest('.file-upload');
  const fileUploadWrapper = input.closest('.file-upload_wrapper');
  const buttonContainer = fileUploadWrapper?.querySelector('.button-container');
  const secondaryButtons = fileUploadWrapper?.querySelectorAll('.secondary-button');
  
  if (fileUploadContainer || fileUploadWrapper) {
    const containers = [fileUploadContainer, fileUploadWrapper, buttonContainer].filter(Boolean);
    
    // Also add secondary-button divs
    if (secondaryButtons) {
      containers.push(...Array.from(secondaryButtons));
    }
    
    const containerEvents = ['change', 'input', 'fileSelected', 'fileChange', 'change'];
    for (const container of containers) {
      for (const eventName of containerEvents) {
        try {
          const event = new Event(eventName, { bubbles: true, cancelable: true });
          container.dispatchEvent(event);
        } catch (e) {
          // Ignore errors
        }
      }
    }
  }
  
  // Also try the old selector as fallback
  const greenhouseContainer = input.closest('[class*="file-input"], [class*="fileInput"], [class*="resume-upload"]');
  if (greenhouseContainer && greenhouseContainer !== fileUploadContainer) {
    const containerEvents = ['change', 'input', 'fileSelected', 'change'];
    for (const eventName of containerEvents) {
      try {
        const event = new Event(eventName, { bubbles: true, cancelable: true });
        greenhouseContainer.dispatchEvent(event);
      } catch (e) {
      }
    }
  }

  // For Workday: trigger events on the container and related elements
  const container = input.closest('[data-automation-id="resumeUpload"]');
  if (container) {
    const containerEvents = ['change', 'input', 'fileSelected'];
    for (const eventName of containerEvents) {
      try {
        const event = new Event(eventName, { bubbles: true, cancelable: true });
        container.dispatchEvent(event);
      } catch (e) {
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
    }
  }

  // Restore original styles
  input.style.display = originalStyles.display;
  input.style.visibility = originalStyles.visibility;
  input.style.opacity = originalStyles.opacity;
  input.style.position = originalStyles.position;
  input.style.width = originalStyles.width;
  input.style.height = originalStyles.height;
  input.style.left = '';
  
  // Restore original onclick handler and remove click prevention
  cleanupClickHandler();

  
  // For Greenhouse: Always add a visual filename indicator as fallback (even if React doesn't update)
  if (isGreenhouse && (input.id === 'resume' || input.id === 'cover_letter' || input.name?.includes('resume') || input.name?.includes('cover'))) {
    
    // Find Greenhouse's specific structure: .file-upload > .file-upload_wrapper > .button-container > .secondary-button
    const fileUploadWrapper = input.closest('.file-upload_wrapper');
    const fileUploadContainer = input.closest('.file-upload');
    
    if (fileUploadWrapper) {
      
      // Find the button container and secondary-button divs (Greenhouse's structure)
      const buttonContainer = fileUploadWrapper.querySelector('.button-container');
      const secondaryButtons = fileUploadWrapper.querySelectorAll('.secondary-button');
      
      // Find the "Attach" button
      const attachBtn = fileUploadWrapper.querySelector('.btn--pill') ||
                       fileUploadWrapper.querySelector('button[type="button"]');
      
      if (attachBtn) {
        
        // Remove any existing filename indicators we might have added
        const existingSpans = fileUploadWrapper.querySelectorAll('.uploaded-filename, .autojobs-filename');
        existingSpans.forEach(span => span.remove());
        
        // Greenhouse typically shows the filename in the second .secondary-button div
        // Let's find it and update it
        let filenameDisplay = null;
        for (const btn of secondaryButtons) {
          // Skip the first one (contains the Attach button)
          if (btn.contains(attachBtn)) continue;
          
          // Check if this secondary-button is empty or has placeholder text
          const text = btn.textContent?.trim() || '';
          if (!text || text.length < 3 || text === 'Attach') {
            filenameDisplay = btn;
            break;
          }
        }
        
        if (filenameDisplay) {
          // Update Greenhouse's secondary-button to show filename
          filenameDisplay.textContent = file.name;
          filenameDisplay.style.color = '#10b981';
          filenameDisplay.style.fontWeight = '500';
          filenameDisplay.style.display = 'block';
        } else {
          // If no secondary-button found, create one
          const newSecondaryButton = document.createElement('div');
          newSecondaryButton.className = 'secondary-button';
          newSecondaryButton.textContent = file.name;
          newSecondaryButton.style.color = '#10b981';
          newSecondaryButton.style.fontWeight = '500';
          newSecondaryButton.style.marginTop = '8px';
          
          if (buttonContainer) {
            buttonContainer.appendChild(newSecondaryButton);
          } else if (fileUploadWrapper) {
            fileUploadWrapper.appendChild(newSecondaryButton);
          }
        }
        
        // Also add a visual indicator next to the Attach button as backup
        const filenameSpan = document.createElement('span');
        filenameSpan.className = 'autojobs-filename uploaded-filename';
        filenameSpan.textContent = `✓ ${file.name}`;
        filenameSpan.style.marginLeft = '12px';
        filenameSpan.style.color = '#10b981';
        filenameSpan.style.fontSize = '14px';
        filenameSpan.style.fontWeight = '600';
        filenameSpan.style.display = 'inline-block';
        filenameSpan.style.verticalAlign = 'middle';
        filenameSpan.style.padding = '4px 8px';
        filenameSpan.style.backgroundColor = '#d1fae5';
        filenameSpan.style.borderRadius = '4px';
        filenameSpan.style.fontFamily = 'system-ui, -apple-system, sans-serif';
        
        // Insert after the button's parent div
        const buttonParent = attachBtn.parentElement;
        if (buttonParent) {
          if (buttonParent.nextSibling) {
            buttonParent.parentNode.insertBefore(filenameSpan, buttonParent.nextSibling);
          } else {
            buttonParent.parentNode.appendChild(filenameSpan);
          }
        }
      }
    } else {
      // Fallback: add indicator near the input itself
      const indicator = document.createElement('div');
      indicator.className = 'autojobs-filename';
      indicator.textContent = `✓ ${file.name} uploaded`;
      indicator.style.position = 'absolute';
      indicator.style.top = '0';
      indicator.style.right = '0';
      indicator.style.color = '#10b981';
      indicator.style.fontSize = '12px';
      indicator.style.padding = '4px 8px';
      indicator.style.backgroundColor = '#d1fae5';
      indicator.style.borderRadius = '4px';
      indicator.style.zIndex = '9999';
      
      const inputParent = input.parentElement;
      if (inputParent) {
        inputParent.style.position = 'relative';
        inputParent.appendChild(indicator);
      }
    }
  }
  
  // Additional Greenhouse UI updates (complementary to the visual indicator above)
  if (isGreenhouse && (input.id === 'resume' || input.id === 'cover_letter' || input.name?.includes('resume') || input.name?.includes('cover') || input.name?.includes('application'))) {
    
    // Find the file-upload_wrapper container (Greenhouse structure)
    const fileUploadWrapper = input.closest('.file-upload_wrapper') || 
                              input.closest('[class*="file-upload"]') ||
                              input.closest('[class*="fileUpload"]');
    
    if (fileUploadWrapper) {
      // Look for secondary-button divs that might contain the filename display
      const secondaryButtons = fileUploadWrapper.querySelectorAll('.secondary-button, [class*="secondary-button"]');
      
      for (const btn of secondaryButtons) {
        // Look for text elements inside that aren't the "Attach" button
        const textElements = btn.querySelectorAll('span, div, p, button:not(.btn--pill)');
        for (const el of textElements) {
          const text = el.textContent?.trim() || '';
          // Skip if it's the "Attach" button or label
          if (text === 'Attach' || el.tagName === 'LABEL' || el.classList.contains('visually-hidden')) {
            continue;
          }
          
          // If element is empty or contains placeholder text, update it
          if (!text || text.includes('Choose') || text.includes('Select') || text.includes('Browse') || 
              text.includes('No file') || text === '' || text.length < 3) {
            el.textContent = file.name;
            el.innerText = file.name;
            
            // Also try setting value if it's an input
            if (el.tagName === 'INPUT') {
              el.value = file.name;
            }
            
            // Trigger change event on the display element
            const changeEvent = new Event('change', { bubbles: true, cancelable: true });
            el.dispatchEvent(changeEvent);
          }
        }
      }
    }
    
    // Final check: try to find and update any filename display elements
    const possibleDisplays = document.querySelectorAll('[class*="file-name"], [class*="fileName"], [class*="file-display"]');
    for (const el of possibleDisplays) {
      const text = el.textContent?.trim() || '';
      if (!text || text.includes('Choose') || text.includes('Select') || text.length < 3) {
        el.textContent = file.name;
      }
    }
  }
  
  // Check if file was set successfully
  await new Promise(resolve => setTimeout(resolve, 100));
  
  if (input.files && input.files.length > 0) {
    return true;
  }
  return false;
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
        
        // Convert text to PDF via background script (has better permissions for localhost)
        const convertResponse = await new Promise((resolve) => {
          chrome.runtime.sendMessage(
            { action: "CONVERT_COVER_LETTER_TO_PDF", text: coverLetterText },
            resolve
          );
        });

        if (!convertResponse || !convertResponse.ok) {
          throw new Error(convertResponse?.error || "Failed to convert cover letter to PDF");
        }

        // Create PDF file from base64
        const file = base64ToFile(convertResponse.base64, "cover_letter.pdf", "application/pdf");
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

