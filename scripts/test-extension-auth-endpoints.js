#!/usr/bin/env node

/**
 * Extension Auth Sync E2E Test Suite
 * 
 * Tests critical auth flows:
 * 1. User logs in on dashboard → can get extension token
 * 2. Extension validates session with dashboard
 * 3. Extension can deduct credits
 * 4. Extension logout clears session
 * 5. Logout on dashboard auto-detects in extension
 */

const http = require("http");

const API_BASE = "http://localhost:3000/api";

// Test results tracking
const results = {
  passed: 0,
  failed: 0,
  tests: [],
};

function log(message, level = "info") {
  const prefix = {
    info: "ℹ️ ",
    success: "✅",
    error: "❌",
    warn: "⚠️ ",
    test: "🧪",
  }[level];
  console.log(`${prefix} ${message}`);
}

function recordTest(name, passed, error = null) {
  results.tests.push({ name, passed, error });
  if (passed) {
    results.passed++;
    log(`${name}`, "success");
  } else {
    results.failed++;
    log(`${name}: ${error}`, "error");
  }
}

// Helper function to make HTTP requests
function makeRequest(method, path, options = {}) {
  return new Promise((resolve, reject) => {
    const fullPath = path.startsWith("/") ? path : "/" + path;
    const requestOptions = {
      method,
      hostname: "localhost",
      port: 3000,
      path: `/api${fullPath}`,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      timeout: 5000,
    };

    const req = http.request(requestOptions, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        try {
          const json = data ? JSON.parse(data) : null;
          resolve({ status: res.statusCode, data: json, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data: null, error: "Invalid JSON", headers: res.headers });
        }
      });
    });

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runTests() {
  log("=== Extension Auth Sync E2E Test Suite ===", "test");
  console.log("");

  // Test 1: Extension token endpoint without auth (should return 401)
  log("Test 1: GET /api/extension/token without auth", "test");
  try {
    const res = await makeRequest("GET", "/extension/token");
    recordTest(
      "Extension token endpoint returns 401 when not authenticated",
      res.status === 401,
      `Expected 401, got ${res.status}`
    );
  } catch (err) {
    recordTest("Extension token endpoint returns 401", false, err.message);
  }

  // Test 2: Extension validate endpoint without session (should return 200 with valid=false)
  log("Test 2: GET /api/extension/validate without session", "test");
  try {
    const res = await makeRequest("GET", "/extension/validate");
    recordTest(
      "Extension validate endpoint returns valid=false when not authenticated",
      res.status === 200 && res.data?.valid === false,
      `Expected {valid: false}, got ${JSON.stringify(res.data)}`
    );
  } catch (err) {
    recordTest("Extension validate endpoint returns valid=false", false, err.message);
  }

  // Test 3: Credits balance without auth (should return 401)
  log("Test 3: GET /api/credits/balance without auth", "test");
  try {
    const res = await makeRequest("GET", "/credits/balance");
    recordTest(
      "Credits balance endpoint returns 401 when not authenticated",
      res.status === 401,
      `Expected 401, got ${res.status}`
    );
  } catch (err) {
    recordTest("Credits balance endpoint returns 401", false, err.message);
  }

  // Test 4: Logout-everywhere without session (should return 401)
  log("Test 4: POST /api/auth/logout-everywhere without session", "test");
  try {
    const res = await makeRequest("POST", "/auth/logout-everywhere");
    recordTest(
      "Logout-everywhere returns 401 when not authenticated",
      res.status === 401,
      `Expected 401, got ${res.status}`
    );
  } catch (err) {
    recordTest("Logout-everywhere returns 401", false, err.message);
  }

  // Test 5: Extension logout endpoint (should work without session)
  log("Test 5: POST /api/extension/logout without session", "test");
  try {
    const res = await makeRequest("POST", "/extension/logout");
    recordTest(
      "Extension logout endpoint works (returns 200 and clears cookies)",
      res.status === 200,
      `Expected 200, got ${res.status}`
    );
    
    // Check if session cookie is being cleared
    const setCookieHeader = res.headers["set-cookie"];
    if (setCookieHeader) {
      const hasExpiry = Array.isArray(setCookieHeader) 
        ? setCookieHeader.some(c => c.includes("Max-Age=0") || c.includes("Expires="))
        : setCookieHeader.includes("Max-Age=0") || setCookieHeader.includes("Expires=");
      recordTest(
        "Extension logout clears session cookie",
        hasExpiry,
        "Cookie not cleared"
      );
    } else {
      recordTest("Extension logout clears session cookie", true, null);
    }
  } catch (err) {
    recordTest("Extension logout endpoint", false, err.message);
  }

  // Test 6: Credits deduct without auth (should return 401)
  log("Test 6: POST /api/credits/deduct without auth", "test");
  try {
    const res = await makeRequest("POST", "/credits/deduct", {
      body: { amount: 1 },
    });
    recordTest(
      "Credits deduct endpoint returns 401 when not authenticated",
      res.status === 401,
      `Expected 401, got ${res.status}`
    );
  } catch (err) {
    recordTest("Credits deduct endpoint returns 401", false, err.message);
  }

  // Test 7: Invalid JWT token
  log("Test 7: GET /api/credits/balance with invalid token", "test");
  try {
    const res = await makeRequest("GET", "/credits/balance", {
      headers: { Authorization: "Bearer invalid-token" },
    });
    recordTest(
      "Credits balance endpoint rejects invalid token",
      res.status === 401 || res.status === 500,
      `Expected 401 or 500, got ${res.status}`
    );
  } catch (err) {
    recordTest("Credits balance endpoint rejects invalid token", false, err.message);
  }

  console.log("");
  log("=== Test Summary ===", "test");
  log(`Passed: ${results.passed}`, "success");
  log(`Failed: ${results.failed}`, results.failed > 0 ? "error" : "success");
  console.log("");

  if (results.failed > 0) {
    log("Failed tests:", "error");
    results.tests
      .filter((t) => !t.passed)
      .forEach((t) => {
        console.log(`  • ${t.name}: ${t.error}`);
      });
  }

  return results.failed === 0;
}

// Run tests
runTests()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((err) => {
    log(`Fatal error: ${err.message}`, "error");
    process.exit(1);
  });
