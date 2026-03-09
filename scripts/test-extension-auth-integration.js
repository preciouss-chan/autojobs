#!/usr/bin/env node

/**
 * Extension Auth Integration Test Suite
 * 
 * Tests complete auth flow including JWT generation and validation
 * Simulates real extension scenarios
 */

const http = require("http");
const jwt = require("jsonwebtoken");

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

// Generate a valid JWT token for testing (simulates what server generates)
function generateTestJWT(email = "test@example.com") {
  return jwt.sign(
    {
      email,
      id: "test-user-id",
      iat: Math.floor(Date.now() / 1000),
    },
    process.env.AUTH_SECRET || "fallback_secret",
    { expiresIn: "30d" }
  );
}

async function runTests() {
  log("=== Extension Auth Integration Test Suite ===", "test");
  console.log("");

  // Test 1: Validate that invalid JWT is rejected
  log("Test 1: Invalid JWT token handling", "test");
  try {
    const res = await makeRequest("GET", "/credits/balance", {
      headers: { Authorization: "Bearer invalid-token" },
    });
    recordTest(
      "Credits endpoint rejects invalid JWT",
      res.status === 401 || res.status === 500,
      `Expected 401 or 500, got ${res.status}`
    );
  } catch (err) {
    recordTest("Credits endpoint rejects invalid JWT", false, err.message);
  }

  // Test 2: Extension logout returns 200
  log("Test 2: Extension logout behavior", "test");
  try {
    const res = await makeRequest("POST", "/extension/logout");
    recordTest(
      "Extension logout returns 200 OK",
      res.status === 200,
      `Expected 200, got ${res.status}`
    );
    recordTest(
      "Extension logout returns success message",
      res.data?.success === true,
      `Expected success: true, got ${JSON.stringify(res.data)}`
    );
  } catch (err) {
    recordTest("Extension logout behavior", false, err.message);
  }

  // Test 3: Session validation without session
  log("Test 3: Session validation", "test");
  try {
    const res = await makeRequest("GET", "/extension/validate");
    recordTest(
      "Session validation returns 200",
      res.status === 200,
      `Expected 200, got ${res.status}`
    );
    recordTest(
      "Session validation returns valid: false when not authenticated",
      res.data?.valid === false,
      `Expected valid: false, got ${JSON.stringify(res.data)}`
    );
  } catch (err) {
    recordTest("Session validation", false, err.message);
  }

  // Test 4: Token endpoint requires session
  log("Test 4: Token endpoint security", "test");
  try {
    const res = await makeRequest("GET", "/extension/token");
    recordTest(
      "Token endpoint returns 401 without session",
      res.status === 401,
      `Expected 401, got ${res.status}`
    );
    recordTest(
      "Token endpoint returns error message",
      res.data?.error === "Unauthorized",
      `Expected error: 'Unauthorized', got ${res.data?.error}`
    );
  } catch (err) {
    recordTest("Token endpoint security", false, err.message);
  }

  // Test 5: Credits endpoints security
  log("Test 5: Credits endpoints security", "test");
  try {
    // Test balance endpoint
    const balanceRes = await makeRequest("GET", "/credits/balance");
    recordTest(
      "Balance endpoint returns 401 without auth",
      balanceRes.status === 401,
      `Expected 401, got ${balanceRes.status}`
    );

    // Test deduct endpoint
    const deductRes = await makeRequest("POST", "/credits/deduct", {
      body: { amount: 1 },
    });
    recordTest(
      "Deduct endpoint returns 401 without auth",
      deductRes.status === 401,
      `Expected 401, got ${deductRes.status}`
    );
  } catch (err) {
    recordTest("Credits endpoints security", false, err.message);
  }

  // Test 6: Logout-everywhere requires session
  log("Test 6: Logout-everywhere security", "test");
  try {
    const res = await makeRequest("POST", "/auth/logout-everywhere");
    recordTest(
      "Logout-everywhere returns 401 without session",
      res.status === 401,
      `Expected 401, got ${res.status}`
    );
  } catch (err) {
    recordTest("Logout-everywhere security", false, err.message);
  }

  // Test 7: Error response structure
  log("Test 7: Error response structure", "test");
  try {
    const res = await makeRequest("GET", "/credits/balance");
    recordTest(
      "Error response contains error field",
      res.data?.error !== undefined,
      `Expected error field in response, got ${JSON.stringify(res.data)}`
    );
    recordTest(
      "Error response is properly formatted",
      typeof res.data?.error === "string",
      `Expected error to be string, got ${typeof res.data?.error}`
    );
  } catch (err) {
    recordTest("Error response structure", false, err.message);
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
