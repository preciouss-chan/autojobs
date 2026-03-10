# Extension Development Guide

This document provides comprehensive information for developing and integrating with the AutoJobs browser extension.

## Overview

The AutoJobs extension enables users to apply AI-powered resume tailoring directly from job boards. The extension is built to support both Chrome and Firefox with a unified codebase for shared functionality.

## Supported Browsers

- **Chrome**: Version 120+
- **Firefox**: Version 121+
- **Edge**: Version 120+ (Chromium-based)

## Architecture

### Directory Structure

```
extension/
├── chrome/                    # Chrome-specific code
│   ├── manifest.json          # Chrome manifest v3
│   └── background.js          # Chrome background script
├── firefox/                   # Firefox-specific code
│   ├── manifest.json          # Firefox manifest format
│   └── background.js          # Firefox background script
├── shared/                    # Shared extension code
│   ├── api-utils.js           # API communication & timeouts
│   ├── error-handler.js       # Error parsing & handling
│   └── constants.js           # Shared constants & config
├── popup/                     # Extension popup UI
│   ├── popup.html             # Popup interface
│   ├── popup.js               # Popup logic
│   ├── popup.css              # Popup styles
│   └── error-notifications.css # Error notification styles
└── build/                     # Built extension files (generated)
```

## API Integration

### Authentication Flow

1. **User logs in on AutoJobs website**
2. **Extension requests token from `/api/extension/token`**
3. **Backend validates session and returns signed token**
4. **Extension stores token securely in chrome.storage.local**
5. **Extension validates token periodically via `/api/extension/validate`**

### Getting a Token

```javascript
// In extension popup or content script
async function getToken() {
  try {
    const response = await fetch('https://autojobs.dev/api/extension/token', {
      method: 'GET',
      credentials: 'include' // Include session cookies
    });
    
    if (!response.ok) {
      throw new Error('Failed to get token');
    }
    
    const data = await response.json();
    
    // Store token securely
    await chrome.storage.local.set({
      extensionToken: data.token,
      tokenExpiry: Date.now() + data.expiresIn * 1000
    });
    
    return data.token;
  } catch (error) {
    console.error('Token request failed:', error);
    throw error;
  }
}
```

### API Timeouts

All extension API calls have operation-specific timeouts configured in `extension/shared/api-utils.js`:

```javascript
const OPERATION_TIMEOUTS = {
  'extension/validate': 5000,      // 5 seconds
  'extension/token': 10000,        // 10 seconds
  'auth/logout-everywhere': 5000,  // 5 seconds
  'credits/balance': 5000,         // 5 seconds
  'credits/deduct': 5000,          // 5 seconds
  'export/cover-letter': 30000,    // 30 seconds
  'parse-resume': 30000,           // 30 seconds
  'extract-requirements': 15000,   // 15 seconds
  'tailor': 30000,                 // 30 seconds
  'export/pdf': 30000              // 30 seconds
};
```

### Using the API Utility

```javascript
import { makeRequest } from '../shared/api-utils.js';

// Make a request with automatic timeout handling
const requirements = await makeRequest(
  'https://autojobs.dev/api/extract-requirements',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      jobDescription: jobText
    })
  },
  'extract-requirements' // Operation name for timeout lookup
);
```

## Content Script Integration

### Detecting Job Postings

To auto-fill job descriptions from a job board:

```javascript
// content.js - Injected into job board pages

// Example: Extract job description from LinkedIn job post
function extractJobDescription() {
  const jobDescElement = document.querySelector(
    '[data-testid="job-details-job-description"]'
  );
  
  if (!jobDescElement) {
    return null;
  }
  
  return jobDescElement.innerText;
}

// Send to extension popup
chrome.runtime.sendMessage({
  action: 'JOB_DESCRIPTION_DETECTED',
  jobDescription: extractJobDescription(),
  jobUrl: window.location.href,
  companyName: 'Company Name from page'
});
```

### Popup Communication

```javascript
// popup.js - Receives messages from content script

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'JOB_DESCRIPTION_DETECTED') {
    // Auto-fill job description input
    const input = document.getElementById('job-description');
    input.value = request.jobDescription;
    
    sendResponse({ success: true });
  }
});
```

## Error Handling

The extension includes comprehensive error handling in `extension/shared/error-handler.js`:

### Error Types

```javascript
class ApiError extends Error {
  constructor(message, code, operation) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.operation = operation;
  }
}

class NetworkError extends Error {
  constructor(message, operation) {
    super(message);
    this.name = 'NetworkError';
    this.operation = operation;
  }
}

class TimeoutError extends Error {
  constructor(operation, timeout) {
    super(`Operation ${operation} timed out after ${timeout}ms`);
    this.name = 'TimeoutError';
    this.operation = operation;
    this.timeout = timeout;
  }
}
```

### Error Display

```javascript
import { displayErrorNotification } from '../shared/error-handler.js';

try {
  await makeRequest(url, options, operation);
} catch (error) {
  displayErrorNotification(error, {
    duration: 5000,
    position: 'top-right'
  });
}
```

## Storage Management

### Secure Storage

```javascript
// Store sensitive data (tokens, API keys)
await chrome.storage.local.set({
  extensionToken: 'secure_token_here',
  tokenExpiry: 1678440600000
});

// Retrieve
const { extensionToken } = await chrome.storage.local.get('extensionToken');

// Clear on logout
await chrome.storage.local.remove(['extensionToken', 'tokenExpiry']);
```

### Session Storage

```javascript
// Store non-sensitive session data
await chrome.storage.session.set({
  currentJobDescription: 'Job text here',
  tailoringInProgress: false
});
```

## Permissions

### Required Permissions (manifest.json)

```json
{
  "permissions": [
    "storage",
    "webRequest",
    "tabs"
  ],
  "host_permissions": [
    "https://autojobs.dev/*",
    "https://*.linkedin.com/*",
    "https://*.indeed.com/*"
  ]
}
```

### Why Each Permission

- **storage**: Save tokens and user preferences
- **webRequest**: Intercept and modify requests if needed
- **tabs**: Read current tab information
- **host_permissions**: Make API calls to AutoJobs and read job boards

## Development Workflow

### Local Development

1. **Set up development environment**
   ```bash
   npm install
   npm run dev
   ```

2. **Build extension**
   ```bash
   npm run build:extension
   ```

3. **Load extension in Chrome**
   - Go to `chrome://extensions`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `extension/build/chrome` directory

4. **Load extension in Firefox**
   - Go to `about:debugging#/runtime/this-firefox`
   - Click "Load Temporary Add-on"
   - Select `extension/build/firefox/manifest.json`

### Testing

```bash
# Run extension timeout tests
node scripts/test-extension-timeouts.js

# Run auth flow tests
node scripts/test-extension-auth-endpoints.js
```

### Debugging

**Chrome DevTools:**
- Right-click extension icon → "Inspect popup"
- Open DevTools console for popup debugging
- Check Background Service Worker logs in chrome://extensions

**Firefox:**
- Type `about:debugging` in address bar
- Click "Inspect" next to extension
- Access DevTools console

## Best Practices

### Security

1. **Never store API keys in extension code**
   - Use extension token obtained from `/api/extension/token`
   - Token is session-specific and expires

2. **Validate all user input**
   ```javascript
   function validateJobDescription(text) {
     if (!text || text.trim().length === 0) {
       throw new Error('Job description cannot be empty');
     }
     
     if (text.trim().length < 50) {
       throw new Error('Job description must be at least 50 characters');
     }
     
     return text.trim();
   }
   ```

3. **Use HTTPS only**
   - All API calls must use HTTPS
   - Certificate pinning not required but recommended for sensitive operations

### Performance

1. **Implement request debouncing**
   ```javascript
   function debounce(func, delay) {
     let timeoutId;
     return function(...args) {
       clearTimeout(timeoutId);
       timeoutId = setTimeout(() => func(...args), delay);
     };
   }
   
   const debouncedTailor = debounce(tailorResume, 500);
   ```

2. **Cache API responses**
   ```javascript
   const cache = new Map();
   
   async function getCachedRequirements(jobDescription) {
     const hash = hashString(jobDescription);
     
     if (cache.has(hash)) {
       return cache.get(hash);
     }
     
     const requirements = await extractRequirements(jobDescription);
     cache.set(hash, requirements);
     
     return requirements;
   }
   ```

3. **Use message batching for multiple API calls**
   ```javascript
   async function processJob(jobDescription) {
     // Run in parallel with Promise.all
     const [requirements, tailored] = await Promise.all([
       extractRequirements(jobDescription),
       tailorResume(resume, jobDescription)
     ]);
     
     return { requirements, tailored };
   }
   ```

### User Experience

1. **Provide clear feedback during operations**
   ```javascript
   updateUI('Extracting job requirements...', 'loading');
   const requirements = await extractRequirements(jobDescription);
   updateUI('Requirements extracted successfully', 'success');
   ```

2. **Handle network failures gracefully**
   ```javascript
   async function withRetry(fn, maxAttempts = 3) {
     for (let i = 0; i < maxAttempts; i++) {
       try {
         return await fn();
       } catch (error) {
         if (i === maxAttempts - 1) throw error;
         
         const delay = Math.pow(2, i) * 1000; // Exponential backoff
         await new Promise(resolve => setTimeout(resolve, delay));
       }
     }
   }
   ```

3. **Show loading progress**
   ```javascript
   const steps = ['Extracting requirements', 'Tailoring resume', 'Generating cover letter'];
   let currentStep = 0;
   
   updateProgress({
     current: currentStep + 1,
     total: steps.length,
     message: steps[currentStep]
   });
   ```

## Manifest Configuration

### Chrome Manifest (v3)

```json
{
  "manifest_version": 3,
  "name": "AutoJobs Resume Tailor",
  "version": "1.0.0",
  "description": "Tailor your resume for any job posting",
  
  "permissions": [
    "storage",
    "webRequest",
    "tabs"
  ],
  
  "host_permissions": [
    "https://autojobs.dev/*"
  ],
  
  "background": {
    "service_worker": "background.js"
  },
  
  "action": {
    "default_popup": "popup/popup.html",
    "default_title": "AutoJobs Resume Tailor"
  },
  
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

### Firefox Manifest

```json
{
  "manifest_version": 2,
  "name": "AutoJobs Resume Tailor",
  "version": "1.0.0",
  "description": "Tailor your resume for any job posting",
  
  "permissions": [
    "storage",
    "tabs",
    "https://autojobs.dev/*"
  ],
  
  "background": {
    "scripts": ["background.js"]
  },
  
  "browser_action": {
    "default_popup": "popup/popup.html",
    "default_title": "AutoJobs Resume Tailor"
  },
  
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

## Deployment

### Publishing to Chrome Web Store

1. Create developer account
2. Pay one-time registration fee ($5)
3. Build extension: `npm run build:extension`
4. Upload `extension/build/chrome.zip` to Chrome Web Store
5. Submit for review (typically 2-3 hours)

### Publishing to Firefox Add-ons

1. Create Mozilla Developer account
2. Build extension: `npm run build:extension`
3. Upload `extension/build/firefox.zip` to Firefox Add-ons
4. Submit for review (typically 24-48 hours)

## Troubleshooting

### Common Issues

**Token Expired Error**
```javascript
// Solution: Refresh token
async function handleExpiredToken() {
  await chrome.storage.local.remove('extensionToken');
  const newToken = await getToken();
  return newToken;
}
```

**CORS Issues**
```javascript
// Solution: Use proper headers
const response = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  credentials: 'include'
});
```

**Timeout Errors**
```javascript
// Solution: Check network conditions and increase timeout if needed
// Verify operation is in OPERATION_TIMEOUTS
// Check API server logs for performance issues
```

## Support

For issues or questions:
- GitHub Issues: https://github.com/yourusername/autojobs/issues
- Email: support@autojobs.dev
- Documentation: https://autojobs.dev/docs

---

**Extension Version:** 1.0.0  
**Last Updated:** March 2026  
**Maintainers:** AutoJobs Team
