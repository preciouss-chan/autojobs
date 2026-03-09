// extension/shared/api-utils.js
// Timeout wrapper for API calls to prevent hanging

/**
 * Fetch with timeout
 * @param {string} url - The URL to fetch
 * @param {object} options - Fetch options
 * @param {number} timeoutMs - Timeout in milliseconds (default: 15000)
 * @returns {Promise<Response>}
 */
export async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === "AbortError") {
      throw new Error(`Request timeout (${timeoutMs}ms): ${url}`);
    }
    throw error;
  }
}

/**
 * API call with timeout and error handling
 * @param {string} url - The API endpoint
 * @param {object} options - Fetch options
 * @param {number} timeoutMs - Timeout in milliseconds (default: 15000)
 * @returns {Promise<any>} - Parsed JSON response
 */
export async function fetchJSON(url, options = {}, timeoutMs = 15000) {
  try {
    const response = await fetchWithTimeout(url, options, timeoutMs);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error || `HTTP ${response.status}: ${response.statusText}`
      );
    }

    return await response.json();
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("Invalid JSON response from server");
    }
    throw error;
  }
}

/**
 * Different timeout values for different API operations
 */
export const API_TIMEOUTS = {
  VALIDATION: 5000, // Quick session validation
  CREDITS: 5000, // Fetch/deduct credits
  TOKEN: 10000, // Get extension token
  EXPORT: 30000, // PDF/cover letter export (can take longer)
  PARSE: 30000, // Resume parsing (can take longer)
  LOGOUT: 5000, // Logout operations
};
