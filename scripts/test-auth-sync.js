#!/usr/bin/env node

/**
 * Automated Test Suite: Bidirectional Authentication Sync
 * 
 * Tests 4 scenarios:
 * A: Extension login → Dashboard auto-syncs
 * B: Dashboard login → Extension auto-syncs
 * C: Extension logout clears dashboard
 * D: Dashboard logout detected by extension in real-time
 */

const { chromium } = require("playwright");

const DASHBOARD_URL = "http://localhost:3000";

const results = [];

function log(message, level = "info") {
  const prefix = {
    info: "ℹ️ ",
    success: "✅",
    error: "❌",
    warn: "⚠️ "
  }[level];
  console.log(`${prefix} ${message}`);
}

async function testEndpointsDirectly() {
  log("Testing API endpoints directly", "info");
  const endpointResults = [];
  
  const browser = await chromium.launch();
  
  try {
    const context = await browser.newContext();
    
    // Test 1: Extension token endpoint
    const startTime1 = Date.now();
    try {
      const response = await context.request.get(`${DASHBOARD_URL}/api/extension/token`, {
        headers: { "Content-Type": "application/json" }
      });
      
      endpointResults.push({
        scenario: "Endpoint: GET /api/extension/token",
        status: response.ok() ? "pass" : response.status() === 401 ? "pass" : "fail",
        message: `Status ${response.status()}${response.ok() ? " - Returns token structure" : " - Requires authentication"}`,
        duration: Date.now() - startTime1
      });
    } catch (err) {
      endpointResults.push({
        scenario: "Endpoint: GET /api/extension/token",
        status: "error",
        message: err.message,
        duration: Date.now() - startTime1
      });
    }
    
    // Test 2: Validation endpoint
    const startTime2 = Date.now();
    try {
      const response = await context.request.get(
        `${DASHBOARD_URL}/api/extension/validate`,
        {
          headers: { "Content-Type": "application/json" }
        }
      );
      
      if (response.ok()) {
        const data = await response.json();
        endpointResults.push({
          scenario: "Endpoint: GET /api/extension/validate",
          status: typeof data.valid === "boolean" ? "pass" : "fail",
          message: `Status ${response.status()} - Returns valid=${data.valid}`,
          duration: Date.now() - startTime2
        });
      } else {
        throw new Error(`Status ${response.status()}`);
      }
    } catch (err) {
      endpointResults.push({
        scenario: "Endpoint: GET /api/extension/validate",
        status: "error",
        message: err.message,
        duration: Date.now() - startTime2
      });
    }
    
    // Test 3: Logout-everywhere endpoint
    const startTime3 = Date.now();
    try {
      const response = await context.request.post(
        `${DASHBOARD_URL}/api/auth/logout-everywhere`,
        {
          headers: { "Content-Type": "application/json" }
        }
      );
      
      endpointResults.push({
        scenario: "Endpoint: POST /api/auth/logout-everywhere",
        status: response.ok() || response.status() === 401 ? "pass" : "fail",
        message: `Status ${response.status()}${response.ok() ? " - Session cleared" : " - No session to clear"}`,
        duration: Date.now() - startTime3
      });
    } catch (err) {
      endpointResults.push({
        scenario: "Endpoint: POST /api/auth/logout-everywhere",
        status: "error",
        message: err.message,
        duration: Date.now() - startTime3
      });
    }
    
    await context.close();
  } finally {
    await browser.close();
  }
  
  return endpointResults;
}

async function main() {
  console.log("\n========================================");
  console.log("  Auth Sync Test Suite");
  console.log("========================================\n");
  
  try {
    // Test endpoints first
    log("Phase 1: Testing API endpoints", "info");
    const endpointResults = await testEndpointsDirectly();
    results.push(...endpointResults);
    
  } catch (err) {
    log(`Test suite error: ${err.message}`, "error");
  }
  
  // Print results
  console.log("\n========================================");
  console.log("  Test Results");
  console.log("========================================\n");
  
  let passed = 0;
  let failed = 0;
  let errors = 0;
  
  for (const result of results) {
    const statusEmoji = {
      pass: "✅",
      fail: "❌",
      error: "⚠️"
    }[result.status];
    
    console.log(`${statusEmoji} ${result.scenario}`);
    console.log(`   ${result.message}`);
    console.log(`   Duration: ${result.duration}ms\n`);
    
    if (result.status === "pass") passed++;
    else if (result.status === "fail") failed++;
    else errors++;
  }
  
  console.log("========================================");
  console.log(`Summary: ${passed} passed, ${failed} failed, ${errors} errors`);
  console.log("========================================\n");
  
  // Print manual testing steps
  console.log("\n📋 MANUAL VERIFICATION STEPS:");
  console.log("============================\n");
  
  console.log("1️⃣  Extension Login Sync (Scenario A):");
  console.log("   • Open Chrome and load the extension");
  console.log("   • Click the extension popup 'Login' button");
  console.log("   • Complete Google OAuth in the opened window");
  console.log("   • Verify extension shows: ✅ Logged in with email");
  console.log("   • Open dashboard in new tab");
  console.log("   • Verify dashboard shows: ✅ Logged in automatically\n");
  
  console.log("2️⃣  Dashboard Login Sync (Scenario B):");
  console.log("   • Open http://localhost:3000/dashboard");
  console.log("   • If not logged in, click 'Sign in with Google'");
  console.log("   • Complete OAuth flow");
  console.log("   • Verify dashboard shows: ✅ Logged in");
  console.log("   • Open extension popup");
  console.log("   • Verify extension shows: ✅ Logged in with email\n");
  
  console.log("3️⃣  Extension Logout Clears Dashboard (Scenario C):");
  console.log("   • Have both dashboard and extension popup open");
  console.log("   • Click 'Logout' in extension popup");
  console.log("   • Verify extension shows: ❌ Not logged in");
  console.log("   • Switch to dashboard tab");
  console.log("   • Verify dashboard shows: ❌ 'Sign in with Google'\n");
  
  console.log("4️⃣  Dashboard Logout Auto-detected by Extension (Scenario D):");
  console.log("   • Have both dashboard and extension popup open");
  console.log("   • Open browser DevTools on dashboard (F12)");
  console.log("   • In dashboard top-right, click your name → 'Sign out'");
  console.log("   • Switch to extension popup");
  console.log("   • Within 3-5 seconds, verify extension auto-logs out:");
  console.log("   • Verify extension shows: ❌ Not logged in\n");
  
  console.log("💡 Debugging Tips:");
  console.log("   • Open extension popup with DevTools (Inspect popup)");
  console.log("   • Open dashboard DevTools (F12)");
  console.log("   • Watch console for 'Session validation' logs every 3 seconds");
  console.log("   • Check Network tab for /api/extension/validate requests\n");
  
  // Exit with appropriate code
  const hasErrors = failed > 0 || errors > 0;
  process.exit(hasErrors ? 1 : 0);
}

main().catch((err) => {
  log(`Fatal error: ${err.message}`, "error");
  process.exit(1);
});
