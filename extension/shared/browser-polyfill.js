// Browser API compatibility layer for Chrome and Firefox
// This creates a unified 'browser' API that works on both platforms

(function() {
  'use strict';

  // Check if we're in Firefox (has native browser.* with Promises)
  const isFirefox = typeof browser !== 'undefined' && browser.runtime && browser.runtime.getBrowserInfo;
  
  // If browser is already defined (Firefox), use it
  // Otherwise, create a wrapper around chrome.* APIs
  if (typeof globalThis.browser === 'undefined') {
    globalThis.browser = globalThis.chrome;
  }

  // For content scripts and pages that need the polyfill
  if (typeof window !== 'undefined' && typeof window.browser === 'undefined') {
    window.browser = window.chrome;
  }
})();
