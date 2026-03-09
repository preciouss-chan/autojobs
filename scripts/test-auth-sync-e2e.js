#!/usr/bin/env node

/**
 * End-to-End Auth Sync Test Suite
 * 
 * Manual test scenarios for:
 * 1. Extension login → Dashboard auto-syncs
 * 2. Dashboard login → Extension auto-syncs  
 * 3. Extension logout clears dashboard
 * 4. Dashboard logout auto-detected by extension
 */

const { chromium } = require("playwright");

const DASHBOARD_URL = "http://localhost:3000";

async function log(message, level = "info") {
  const prefix = {
    info: "ℹ️ ",
    success: "✅",
    error: "❌",
    warn: "⚠️ "
  }[level];
  console.log(`${prefix} ${message}`);
}

async function testEndpoints() {
  log("=== Phase 1: Testing API Endpoints ===", "info");
  
  const browser = await chromium.launch();
  const context = await browser.newContext();
  
  try {
    // Test extension/token endpoint
    const tokenRes = await context.request.get(`${DASHBOARD_URL}/api/extension/token`);
    const tokenStatus = tokenRes.status();
    log(`GET /api/extension/token: ${tokenStatus}`, tokenStatus === 401 ? "warn" : "info");
    
    // Test extension/validate endpoint
    const validateRes = await context.request.get(`${DASHBOARD_URL}/api/extension/validate`);
    if (validateRes.ok()) {
      const data = await validateRes.json();
      log(`GET /api/extension/validate: ${data.valid}`, "success");
    }
    
    // Test logout-everywhere endpoint
    const logoutRes = await context.request.post(`${DASHBOARD_URL}/api/auth/logout-everywhere`);
    log(`POST /api/auth/logout-everywhere: ${logoutRes.status()}`, logoutRes.ok() || logoutRes.status() === 401 ? "success" : "error");
    
  } finally {
    await context.close();
    await browser.close();
  }
}

function printManualTestSteps() {
  console.log("\n");
  console.log("╔════════════════════════════════════════════════════════════════╗");
  console.log("║                 AUTH SYNC END-TO-END TEST GUIDE                ║");
  console.log("╚════════════════════════════════════════════════════════════════╝");
  
  console.log("\n📋 SCENARIO 1: Extension Login → Dashboard Auto-Syncs");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`
Steps:
1. Open Chrome and load the extension
2. Click extension popup 'Login' button
3. Complete Google OAuth in the new window
4. ✓ EXPECTED: Extension shows: "✅ Logged in: [email]"
5. Open browser DevTools on extension popup (right-click → Inspect)
6. Look for console logs:
   - "✅ Token fetch successful! User is logged in."
   - "✅ Login successful: [email]"
7. Open NEW TAB: http://localhost:3000/dashboard
8. ✓ EXPECTED: Dashboard shows: "✅ Logged in as [email]" (no redirect to signin)
9. PASS: If both show logged in state
`);

  console.log("\n📋 SCENARIO 2: Dashboard Login → Extension Auto-Syncs");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`
Steps:
1. In NEW window, open http://localhost:3000/dashboard
2. Click "Sign in with Google"
3. Complete OAuth
4. ✓ EXPECTED: Dashboard shows: "✅ Logged in as [email]"
5. Open extension popup
6. ✓ EXPECTED: Extension shows: "✅ Logged in: [email]" (without needing to login again)
7. Check extension console for:
   - "🔄 Checking for dashboard login..."
   - "✅ Found valid session from dashboard!"
   - "✅ Extension authentication synced with dashboard"
8. PASS: If extension auto-synced without manual login
`);

  console.log("\n📋 SCENARIO 3: Extension Logout Clears Dashboard");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`
Setup:
- Have both dashboard and extension popup OPEN
- Both should show logged in state

Steps:
1. In extension popup, click "Logout" button
2. ✓ EXPECTED: Extension immediately shows: "🔓 Login"
3. Check extension console for:
   - "📤 Calling dashboard logout endpoint"
   - "✅ Dashboard also logged out"
   - "✅ Logged out"
4. Switch to Dashboard TAB
5. ✓ EXPECTED: Dashboard now shows: "Sign in with Google" (redirected to signin)
6. PASS: If dashboard was cleared when extension logged out
`);

  console.log("\n📋 SCENARIO 4: Dashboard Logout → Extension Auto-Detected");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`
Setup:
- Have both dashboard and extension popup OPEN
- Both should show logged in state

Steps:
1. Open DevTools on BOTH windows:
   - Dashboard: Press F12
   - Extension popup: Right-click → Inspect

2. In Dashboard top-right corner, click username/profile
3. Click "Sign out" or "Logout"
4. ✓ EXPECTED: Dashboard redirects to "Sign in with Google"

5. IMMEDIATELY switch to extension popup window
6. ✓ EXPECTED: Extension auto-logs out within 2 seconds:
   - Check extension console for: "📊 Session validation: ❌ invalid"
   - Then: "⚠️  Server session no longer valid, logging out"
   - Then: "✅ Auto-logout triggered by server session loss"
   - UI changes from "Logout" button to "Login" button

7. PASS: If extension detected logout within ~2 seconds and auto-logged out
`);

  console.log("\n💡 Debugging Tips:");
  console.log("━━━━━━━━━━━━━━━━");
  console.log(`
- Extension Console:
  * Right-click extension icon → Inspect popup
  * Go to "Console" tab to see logs
  * Filter by searching for "✅", "⚠️", "❌"

- Dashboard Console:
  * Press F12 → Console tab
  * Watch for messages starting with "✅" or "📩"

- Network Monitor:
  * In DevTools, click Network tab
  * Filter by "extension" to see API calls
  * Watch for /api/extension/validate requests (should appear every 2 seconds)

- Session Polling:
  * Extension checks /api/extension/validate every 2 seconds
  * Look for Network entries showing repeated requests to this endpoint
  * Once dashboard logs out, the response should have valid=false

✅ ALL TESTS PASS:
   1. Extension login syncs to dashboard immediately
   2. Dashboard login syncs to extension on popup open
   3. Extension logout immediately clears dashboard
   4. Dashboard logout detected by extension within ~2 seconds
`);

  console.log("\n⚡ Quick Test Timing:");
  console.log("━━━━━━━━━━━━━━━━━");
  console.log(`
- Scenario 1 (Extension login): ~10-15 seconds
- Scenario 2 (Dashboard login): ~5-10 seconds  
- Scenario 3 (Extension logout): ~2-3 seconds
- Scenario 4 (Dashboard logout detection): ~2-5 seconds

Total time: ~20-30 minutes for full manual test
`);

  console.log("\n📊 Expected Behavior Summary:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`
┌─────────────────────┬──────────────────┬────────────┐
│ Action              │ Time to Reflect  │ Location   │
├─────────────────────┼──────────────────┼────────────┤
│ Extension login     │ Immediate        │ Dashboard  │
│ Dashboard login     │ On popup open    │ Extension  │
│ Extension logout    │ < 100ms          │ Dashboard  │
│ Dashboard logout    │ 2-5 seconds      │ Extension  │
└─────────────────────┴──────────────────┴────────────┘

Legend:
- "Immediate" = should happen right away (< 1 second)
- "On popup open" = when you open extension after dashboard login
- "< 100ms" = nearly instant, real-time message passing
- "2-5 seconds" = detection via polling + margin for network
`);
}

async function main() {
  console.log("\n");
  console.log("██████████████████████████████████████████████████████████████");
  console.log("█  AutoJobs Auth Sync - End-to-End Test Suite                 █");
  console.log("██████████████████████████████████████████████████████████████");

  try {
    await testEndpoints();
    printManualTestSteps();
  } catch (err) {
    log(`Test suite error: ${err.message}`, "error");
  }

  console.log("\n");
  console.log("⏰ Test Checklist:");
  console.log("━━━━━━━━━━━━━━━");
  console.log("[ ] Scenario 1: Extension login → Dashboard (PASS/FAIL)");
  console.log("[ ] Scenario 2: Dashboard login → Extension (PASS/FAIL)");
  console.log("[ ] Scenario 3: Extension logout → Dashboard (PASS/FAIL)");
  console.log("[ ] Scenario 4: Dashboard logout → Extension (PASS/FAIL)");
  console.log("\n✅ Mark all scenarios as PASS before deployment!\n");
}

main().catch((err) => {
  log(`Fatal error: ${err.message}`, "error");
  process.exit(1);
});
