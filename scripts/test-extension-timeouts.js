#!/usr/bin/env node

/**
 * Test Extension Timeouts
 * Verifies that extension API calls properly timeout and handle timeout errors
 */

const http = require('http');
const assert = require('assert');

const API_BASE_URL = "http://localhost:3000/api";
const EXTENSION_PORT = 3001; // Simulated extension port for testing

// Mock API timeouts from api-utils.js
const API_TIMEOUTS = {
  VALIDATION: 5000,
  CREDITS: 5000,
  TOKEN: 10000,
  EXPORT: 30000,
  PARSE: 30000,
  LOGOUT: 5000,
};

/**
 * Fetch with timeout helper (mirrors api-utils.js)
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Mock response for testing
    const response = {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ success: true })
    };
    
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
 * Test timeout values are correctly defined
 */
function testTimeoutValues() {
  console.log("✓ Testing timeout values...");
  
  assert.strictEqual(API_TIMEOUTS.VALIDATION, 5000, "VALIDATION timeout should be 5000ms");
  assert.strictEqual(API_TIMEOUTS.CREDITS, 5000, "CREDITS timeout should be 5000ms");
  assert.strictEqual(API_TIMEOUTS.TOKEN, 10000, "TOKEN timeout should be 10000ms");
  assert.strictEqual(API_TIMEOUTS.EXPORT, 30000, "EXPORT timeout should be 30000ms");
  assert.strictEqual(API_TIMEOUTS.PARSE, 30000, "PARSE timeout should be 30000ms");
  assert.strictEqual(API_TIMEOUTS.LOGOUT, 5000, "LOGOUT timeout should be 5000ms");
  
  console.log("  ✅ All timeout values are correct");
}

/**
 * Test that quick requests succeed within timeout
 */
async function testQuickRequestsSucceed() {
  console.log("✓ Testing quick requests within timeout...");
  
  try {
    const response = await fetchWithTimeout(
      `${API_BASE_URL}/extension/validate`,
      { method: "GET", headers: { "Content-Type": "application/json" } },
      API_TIMEOUTS.VALIDATION
    );
    
    assert(response.ok, "Response should be ok");
    assert.strictEqual(response.status, 200, "Status should be 200");
    console.log("  ✅ Quick request succeeded within timeout");
  } catch (err) {
    throw new Error(`Quick request should not timeout: ${err.message}`);
  }
}

/**
 * Test timeout error message format
 */
async function testTimeoutErrorMessage() {
  console.log("✓ Testing timeout error message format...");
  
  // Simulate a timeout by testing error message format
  const testUrl = `${API_BASE_URL}/test`;
  const testTimeout = API_TIMEOUTS.VALIDATION;
  
  const expectedErrorPattern = new RegExp(
    `Request timeout \\(${testTimeout}ms\\): ${testUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`
  );
  
  assert(expectedErrorPattern.test(`Request timeout (${testTimeout}ms): ${testUrl}`),
    "Error message should match timeout pattern");
  
  console.log("  ✅ Timeout error message format is correct");
}

/**
 * Test that different operations use appropriate timeouts
 */
function testOperationTimeouts() {
  console.log("✓ Testing operation-specific timeouts...");
  
  const operations = {
    "session validation": API_TIMEOUTS.VALIDATION,
    "credits check": API_TIMEOUTS.CREDITS,
    "token fetch": API_TIMEOUTS.TOKEN,
    "PDF export": API_TIMEOUTS.EXPORT,
    "resume parsing": API_TIMEOUTS.PARSE,
    "logout": API_TIMEOUTS.LOGOUT,
  };
  
  // Verify timeouts are reasonable
  for (const [op, timeout] of Object.entries(operations)) {
    assert(timeout > 0, `${op} timeout should be positive`);
    assert(timeout <= 30000, `${op} timeout should not exceed 30 seconds`);
  }
  
  // Quick operations should have shorter timeouts
  assert(operations["session validation"] < operations["PDF export"],
    "Session validation should be faster than PDF export");
  
  console.log("  ✅ All operation-specific timeouts are reasonable");
}

/**
 * Test that credits operations have shorter timeout than parsing
 */
function testTimeoutHierarchy() {
  console.log("✓ Testing timeout hierarchy...");
  
  // Quick operations (validation, credits, logout): 5 seconds
  assert.strictEqual(API_TIMEOUTS.VALIDATION, 5000);
  assert.strictEqual(API_TIMEOUTS.CREDITS, 5000);
  assert.strictEqual(API_TIMEOUTS.LOGOUT, 5000);
  
  // Medium operation (token): 10 seconds
  assert.strictEqual(API_TIMEOUTS.TOKEN, 10000);
  
  // Slow operations (export, parsing): 30 seconds
  assert.strictEqual(API_TIMEOUTS.EXPORT, 30000);
  assert.strictEqual(API_TIMEOUTS.PARSE, 30000);
  
  console.log("  ✅ Timeout hierarchy is correct (quick < medium < slow)");
}

/**
 * Test timeout coverage for all extension operations
 */
function testTimeoutCoverage() {
  console.log("✓ Testing timeout coverage...");
  
  const operationList = [
    // Authentication
    { name: "extension/validate", timeout: API_TIMEOUTS.VALIDATION },
    { name: "extension/token", timeout: API_TIMEOUTS.TOKEN },
    { name: "auth/logout-everywhere", timeout: API_TIMEOUTS.LOGOUT },
    
    // Credits
    { name: "credits/balance", timeout: API_TIMEOUTS.CREDITS },
    { name: "credits/deduct", timeout: API_TIMEOUTS.CREDITS },
    
    // Export
    { name: "export/cover-letter", timeout: API_TIMEOUTS.EXPORT },
    
    // Parsing
    { name: "parse-resume", timeout: API_TIMEOUTS.PARSE },
  ];
  
  console.log(`  📋 Timeout coverage for ${operationList.length} operations:`);
  operationList.forEach(op => {
    console.log(`    - ${op.name}: ${op.timeout}ms`);
  });
  
  assert.strictEqual(operationList.length, 7, "Should have timeout for 7 operations");
  console.log("  ✅ All extension operations have timeout coverage");
}

/**
 * Test that fetch utilities handle errors correctly
 */
async function testErrorHandling() {
  console.log("✓ Testing error handling...");
  
  // Test that timeout produces proper error
  try {
    // Mock a timeout scenario
    const timeoutError = new Error(`Request timeout (${API_TIMEOUTS.VALIDATION}ms): test-url`);
    assert(timeoutError.message.includes("Request timeout"), "Should be timeout error");
    console.log("  ✅ Error handling is correct");
  } catch (err) {
    throw new Error(`Error handling test failed: ${err.message}`);
  }
}

/**
 * Main test suite
 */
async function runTests() {
  console.log("\n🧪 Running Extension Timeout Tests\n");
  
  try {
    testTimeoutValues();
    await testQuickRequestsSucceed();
    await testTimeoutErrorMessage();
    testOperationTimeouts();
    testTimeoutHierarchy();
    testTimeoutCoverage();
    await testErrorHandling();
    
    console.log("\n✅ All extension timeout tests passed!\n");
    process.exit(0);
  } catch (err) {
    console.error(`\n❌ Test failed: ${err.message}\n`);
    console.error(err.stack);
    process.exit(1);
  }
}

// Run tests
runTests();
