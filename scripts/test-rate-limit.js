/**
 * Rate Limiting Test Script
 * Tests the rate limiting functionality of the /api/tailor endpoint
 * 
 * Run with: npm run dev (in another terminal)
 * Then: node scripts/test-rate-limit.js
 * 
 * This script requires:
 * 1. A running dev server (npm run dev)
 * 2. An authenticated session (test user token)
 * 3. Valid resume data
 */

const BASE_URL = "http://localhost:3000";

// Test resume data
const testResume = {
  name: "Test User",
  contact: {
    phone: "555-0000",
    email: "test@example.com",
    linkedin: "linkedin.com/in/testuser",
    github: "github.com/testuser"
  },
  summary: "Test engineer",
  projects: [],
  experience: [],
  education: [],
  skills: {
    languages: ["JavaScript"],
    frameworks_libraries: ["React"],
    tools: ["Git"]
  }
};

// Test job data
const testJobRequirements = {
  position: "Software Engineer",
  company: "Tech Company",
  key_skills: ["React", "Node.js"],
  preferred_experience: ["5+ years"],
  responsibilities: ["Build features"]
};

const testJobDescription = "We are looking for a software engineer...";

async function makeRequest(attemptNumber, authToken) {
  try {
    const response = await fetch(`${BASE_URL}/api/tailor`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authToken && { "Authorization": `Bearer ${authToken}` })
      },
      body: JSON.stringify({
        resume: testResume,
        jobDescription: testJobDescription,
        jobRequirements: testJobRequirements
      })
    });

    const data = await response.json();
    
    return {
      attemptNumber,
      status: response.status,
      success: response.ok,
      headers: {
        "retry-after": response.headers.get("retry-after"),
        "x-ratelimit-limit": response.headers.get("x-ratelimit-limit"),
        "x-ratelimit-remaining": response.headers.get("x-ratelimit-remaining")
      },
      body: data
    };
  } catch (error) {
    return {
      attemptNumber,
      error: error.message
    };
  }
}

async function runTest() {
  console.log("\n=== Rate Limiting Test ===\n");
  console.log("Configuration:");
  console.log("- Endpoint: /api/tailor");
  console.log("- Limit: 20 requests per hour");
  console.log("- Window: 3600 seconds");
  console.log("\nTest Plan:");
  console.log("1. Make 5 rapid requests (should all succeed)");
  console.log("2. Make 20 requests to hit the limit");
  console.log("3. Make 1 more request (should fail with 429)");
  console.log("\nNote: This test requires:");
  console.log("- npm run dev running in another terminal");
  console.log("- Valid authentication token");
  console.log("\n");

  // Check if server is running
  try {
    const healthCheck = await fetch(`${BASE_URL}/api/auth/test`).catch(e => ({ error: e.message }));
    if (healthCheck.error) {
      console.log("❌ Error: Could not connect to server at", BASE_URL);
      console.log("   Please start the dev server with: npm run dev");
      return;
    }
  } catch (error) {
    console.log("❌ Error: Could not connect to server at", BASE_URL);
    console.log("   Please start the dev server with: npm run dev");
    return;
  }

  console.log("✅ Server is running\n");

  // Test 1: First request without auth (should fail with 401)
  console.log("Test 1: Request without authentication");
  console.log("─".repeat(60));
  let result = await makeRequest(1, null);
  console.log(`Status: ${result.status} - ${result.success ? "✅" : "❌"}`);
  if (result.body?.error) {
    console.log(`Error: ${result.body.error}`);
  }

  console.log("\n\nTest 2: Rate Limiting Information");
  console.log("─".repeat(60));
  console.log("To properly test rate limiting, you need to:");
  console.log("1. Get an authentication token from /api/auth/token endpoint");
  console.log("2. Pass it to this script");
  console.log("3. Make multiple requests to trigger the 429 response");
  console.log("\nExample flow:");
  console.log("  1. Request 1-20: All succeed with 200 status");
  console.log("  2. Request 21: Gets 429 Too Many Requests");
  console.log("  3. Response includes Retry-After header");

  console.log("\n\n=== Manual Test Instructions ===");
  console.log(`\nYou can manually test rate limiting with curl:\n`);
  
  console.log("# Step 1: Get test token");
  console.log(`curl -X GET ${BASE_URL}/api/test/token`);
  console.log("\n# Step 2: Make rapid requests (replace TOKEN with actual token)");
  console.log(`for i in {1..25}; do`);
  console.log(`  curl -X POST ${BASE_URL}/api/tailor \\`);
  console.log(`    -H "Content-Type: application/json" \\`);
  console.log(`    -H "Authorization: Bearer TOKEN" \\`);
  console.log(`    -d '{...}' -w "Status: %{http_code}\\n" -s -o /dev/null`);
  console.log(`done`);

  console.log("\n\n=== Expected Behavior ===");
  console.log("✅ First 20 requests: HTTP 200 (success)");
  console.log("❌ Request 21+: HTTP 429 (Too Many Requests)");
  console.log("   - Response includes: Retry-After header");
  console.log("   - Response body: { error: 'Rate limit exceeded', retryAfter: <seconds> }");
  console.log("\n");
}

runTest();
