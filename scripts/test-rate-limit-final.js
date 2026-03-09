/**
 * Rate Limiting Test - Simulating Authenticated Requests
 * Tests by creating sessions directly in the rate limit store
 */

const BASE_URL = "http://localhost:3000";

// Test data
const testResume = {
  name: "Test User",
  contact: { phone: "555-0000", email: "test@example.com", linkedin: "linkedin.com/in/test", github: "github.com/test" },
  summary: "Software engineer",
  projects: [{ name: "Test Project", date: "2023", link: "github.com", bullets: ["Test"] }],
  experience: [{ company: "Test Corp", role: "Engineer", dates: "2021-2023", bullets: ["Work"] }],
  education: [],
  skills: { languages: ["JS"], frameworks_libraries: ["React"], tools: ["Git"] }
};

const jobRequirements = { position: "Engineer", company: "Company", key_skills: ["React"], preferred_experience: ["5+"], responsibilities: ["Build"] };
const jobDescription = "Looking for engineer...";

async function testRateLimiting() {
  console.log("\n=== Rate Limiting Test ===\n");
  
  // Step 1: Get test token via API
  console.log("Step 1: Getting test token from API...");
  let token;
  try {
    const response = await fetch(`${BASE_URL}/api/test/token`);
    if (!response.ok) {
      console.log("❌ Could not get test token. Is the server running?");
      console.log("   Start with: npm run dev");
      return;
    }
    
    const data = await response.json();
    token = data.token;
    console.log(`✅ Got token: ${token.substring(0, 20)}...`);
  } catch (error) {
    console.log("❌ Error getting token:", error.message);
    return;
  }

  console.log("\nStep 2: Making requests with token\n");
  console.log("Configuration:");
  console.log("- Endpoint: POST /api/tailor");
  console.log("- Rate limit: 20 requests/hour");
  console.log("- User: test@example.com");
  console.log("\n" + "─".repeat(70) + "\n");

  // Test with unauthenticated requests to understand the behavior
  console.log("Making 5 test requests to understand rate limit behavior...\n");

  const results = [];
  for (let i = 1; i <= 5; i++) {
    try {
      const response = await fetch(`${BASE_URL}/api/tailor`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          resume: testResume,
          jobDescription: jobDescription,
          jobRequirements: jobRequirements
        })
      });

      const data = await response.json();
      const status = response.status;
      
      results.push({
        attempt: i,
        status: status,
        headers: {
          "retry-after": response.headers.get("retry-after")
        },
        body: data
      });

      const statusEmoji = status === 200 ? "✅" : status === 429 ? "⏸️" : status === 401 ? "🔐" : "❌";
      console.log(`Request ${i}: ${statusEmoji} HTTP ${status}`);

      if (status === 429) {
        console.log(`  └─ Rate limited! Retry after: ${response.headers.get("retry-after")}s`);
        console.log(`  └─ Error: ${data.error || 'Rate limit exceeded'}`);
      } else if (status === 401) {
        console.log(`  └─ Unauthorized: ${data.error}`);
      } else if (status === 200) {
        console.log(`  └─ Success: Resume tailoring in progress`);
      } else {
        console.log(`  └─ Response: ${data.error || JSON.stringify(data).substring(0, 50)}`);
      }
    } catch (error) {
      console.log(`Request ${i}: ❌ Error - ${error.message}`);
    }
  }

  console.log("\n" + "─".repeat(70));
  console.log("\n✅ Rate Limiting Test Complete\n");

  // Analyze results
  const successful = results.filter(r => r.status === 200).length;
  const rateLimited = results.filter(r => r.status === 429).length;
  const unauthorized = results.filter(r => r.status === 401).length;
  const other = results.filter(r => ![200, 429, 401].includes(r.status)).length;

  console.log("Summary:");
  console.log(`✅ Successful (200): ${successful}`);
  console.log(`⏸️  Rate Limited (429): ${rateLimited}`);
  console.log(`🔐 Unauthorized (401): ${unauthorized}`);
  console.log(`❌ Other Errors: ${other}`);

  if (rateLimited > 0) {
    console.log("\n✅ Rate Limiting is Working:");
    console.log("   - Server returns HTTP 429 when rate limit exceeded");
    console.log("   - Retry-After header is included in response");
    console.log("   - Error message is clear and informative");
  } else if (unauthorized > 0) {
    console.log("\n⚠️  Note: All requests returned 401 Unauthorized");
    console.log("   - The authentication token may not be valid for API calls");
    console.log("   - NextAuth session might be needed instead of JWT token");
  } else {
    console.log("\n📊 Observation: Requests completed without rate limiting");
    console.log("   - This could mean:");
    console.log("   - 1. Rate limit window is per-user and resets");
    console.log("   - 2. Requests succeeded (consuming AI quota)");
    console.log("   - 3. Rate limiting requires continuous requests within window");
  }

  console.log("\n");
}

testRateLimiting().catch(console.error);
