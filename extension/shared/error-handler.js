// extension/shared/error-handler.js
// Error handling utilities for extension API calls, especially timeouts

/**
 * Parse and format API errors for user-friendly display
 * @param {Error} error - The error object
 * @param {string} operation - The operation that failed (e.g., "Resume Parsing", "Login")
 * @returns {object} - { title, message, isRetryable, code }
 */
export function parseError(error, operation = "Operation") {
  const message = error?.message || String(error);
  
  // Timeout error
  if (message.includes("timeout") || message.includes("AbortError")) {
    return {
      code: "TIMEOUT",
      title: `${operation} Timed Out`,
      message: `${operation} took too long. Please check your internet connection and try again.`,
      isRetryable: true,
      displayMessage: `⏱️ ${operation} took too long (network may be slow)`
    };
  }
  
  // Network error
  if (message.includes("Failed to fetch") || message.includes("NetworkError") || message.includes("disconnected")) {
    return {
      code: "NETWORK",
      title: "Connection Error",
      message: "Cannot reach the server. Make sure you're connected to the internet.",
      isRetryable: true,
      displayMessage: "📡 No internet connection"
    };
  }
  
  // Authentication error
  if (message.includes("401") || message.includes("Not authenticated") || message.includes("unauthorized")) {
    return {
      code: "AUTH",
      title: "Authentication Error",
      message: "Your session has expired. Please log in again.",
      isRetryable: false,
      displayMessage: "🔐 Session expired - please log in again"
    };
  }
  
  // Server error
  if (message.includes("500") || message.includes("Internal Server Error")) {
    return {
      code: "SERVER",
      title: "Server Error",
      message: "The server encountered an error. Please try again later.",
      isRetryable: true,
      displayMessage: "⚠️ Server error - try again later"
    };
  }
  
  // Invalid request
  if (message.includes("400") || message.includes("Bad Request")) {
    return {
      code: "INVALID",
      title: "Invalid Request",
      message: "There was a problem with your request. Please try again.",
      isRetryable: false,
      displayMessage: "❌ Invalid request"
    };
  }
  
  // Credits error
  if (message.includes("Insufficient credits") || message.includes("credits")) {
    return {
      code: "CREDITS",
      title: "Insufficient Credits",
      message: "You don't have enough credits for this operation. Please purchase more credits.",
      isRetryable: false,
      displayMessage: "💳 Not enough credits"
    };
  }
  
  // Generic error
  return {
    code: "UNKNOWN",
    title: "Error",
    message: message || `${operation} failed. Please try again.`,
    isRetryable: true,
    displayMessage: `❌ ${operation} failed`
  };
}

/**
 * Show error notification with retry option
 * @param {Error} error - The error object
 * @param {string} operation - The operation name
 * @param {function} onRetry - Callback when user clicks retry
 */
export function showErrorNotification(error, operation, onRetry) {
  const errorInfo = parseError(error, operation);
  
  // Create error element
  const errorEl = document.createElement('div');
  errorEl.className = 'error-notification';
  errorEl.innerHTML = `
    <div class="error-content">
      <div class="error-header">
        <span class="error-title">${errorInfo.title}</span>
        <button class="error-close" aria-label="Close">×</button>
      </div>
      <p class="error-message">${errorInfo.message}</p>
      ${errorInfo.isRetryable ? `
        <div class="error-actions">
          <button class="error-retry-btn" data-retry="true">Retry</button>
        </div>
      ` : ''}
    </div>
  `;
  
  // Add to page
  document.body.appendChild(errorEl);
  
  // Handle retry button
  if (errorInfo.isRetryable) {
    const retryBtn = errorEl.querySelector('.error-retry-btn');
    retryBtn.addEventListener('click', async () => {
      errorEl.remove();
      if (onRetry) {
        try {
          await onRetry();
        } catch (retryError) {
          showErrorNotification(retryError, operation, onRetry);
        }
      }
    });
  }
  
  // Handle close button
  const closeBtn = errorEl.querySelector('.error-close');
  closeBtn.addEventListener('click', () => {
    errorEl.remove();
  });
  
  // Auto-remove after 8 seconds if no interaction
  setTimeout(() => {
    if (errorEl.parentNode) {
      errorEl.remove();
    }
  }, 8000);
  
  return errorEl;
}

/**
 * Show loading indicator
 * @param {string} message - Loading message
 * @returns {HTMLElement} - Loading element
 */
export function showLoadingIndicator(message = "Loading...") {
  const loadingEl = document.createElement('div');
  loadingEl.className = 'loading-indicator';
  loadingEl.innerHTML = `
    <div class="spinner"></div>
    <p>${message}</p>
  `;
  document.body.appendChild(loadingEl);
  return loadingEl;
}

/**
 * Hide loading indicator
 * @param {HTMLElement} loadingEl - The loading element to remove
 */
export function hideLoadingIndicator(loadingEl) {
  if (loadingEl && loadingEl.parentNode) {
    loadingEl.remove();
  }
}

/**
 * Show success notification
 * @param {string} message - Success message
 */
export function showSuccessNotification(message) {
  const successEl = document.createElement('div');
  successEl.className = 'success-notification';
  successEl.innerHTML = `
    <div class="success-content">
      <span class="success-icon">✓</span>
      <p>${message}</p>
    </div>
  `;
  document.body.appendChild(successEl);
  
  setTimeout(() => {
    if (successEl.parentNode) {
      successEl.remove();
    }
  }, 3000);
  
  return successEl;
}

/**
 * Wrap an async function with error handling
 * @param {function} asyncFn - The async function to wrap
 * @param {string} operation - The operation name for error messages
 * @param {object} options - Options (showUI, onRetry, etc.)
 * @returns {Promise<any>}
 */
export async function withErrorHandling(asyncFn, operation = "Operation", options = {}) {
  const { showUI = true, onRetry = null } = options;
  
  try {
    if (showUI) {
      const loading = showLoadingIndicator(`${operation}...`);
      try {
        const result = await asyncFn();
        hideLoadingIndicator(loading);
        return result;
      } catch (error) {
        hideLoadingIndicator(loading);
        throw error;
      }
    } else {
      return await asyncFn();
    }
  } catch (error) {
    if (showUI) {
      showErrorNotification(error, operation, onRetry);
    }
    throw error;
  }
}
