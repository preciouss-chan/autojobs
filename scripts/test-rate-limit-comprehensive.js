/**
 * Comprehensive Rate Limiting Test
 * Tests rate limiting by making sequential requests and checking responses
 */

const BASE_URL = "http://localhost:3000";

// Test resume and job data
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

async function makeRequest(attemptNumber, sessionCookie) {
  try {
    const response = await fetch(`${BASE_URL}/api/tailor`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(sessionCookie && { "Cookie": sessionCookie })
      },
      body: JSON.stringify({ resume: testResume, jobDescription, jobRequirements })
    });

    return {
      attempt: attemptNumber,
      status: response.status,
      retryAfter: response.headers.get("retry-after"),
      ok: response.ok
    };
  } catch (error) {
    return { attempt: attemptNumber, error: error.message };
  }
}

async function testRateLimiting() {
  console.log("\n=== Comprehensive Rate Limiting Test ===\n");
  
  // Get test session/token
  console.log("Step 1: Getting test token...");
  try {
    const tokenResponse = await fetch(`${BASE_URL}/api/test/token`);
    if (!tokenResponse.ok) {
      console.log("❌ Could not get test token");
      console.log("   Make sure the dev server is running with: npm run dev");
      return;
    }
    
    const tokenData = await tokenResponse.json();
    const sessionCookie = tokenData.sessionCookie;
    
    if (!sessionCookie) {
      console.log("❌ Test endpoint did not return session cookie");
      console.log("   Response:", tokenData);
      return;
    }

    console.log("✅ Got test session\n");

    // Now make rapid requests
    console.log("Step 2: Making 25 sequential requests to /api/tailor");
    console.log("Expected: First 20 succeed (200), Requests 21+ fail (429)");
    console.log("─".repeat(70));

    const results = [];
    for (let i = 1; i <= 25; i++) {
      const result = await makeRequest(i, sessionCookie);
      results.push(result);
      
      // Print progress
      const status = result.status || 0;
      const statusEmoji = status === 200 ? "✅" : status === 429 ? "⏸️ " : "❌";
      const message = status === 429 ? ` (Rate limited, retry after: ${result.retryAfter}s)` : "";
      
      process.stdout.write(`\rRequest ${String(i).padStart(2, '0')}/25: ${statusEmoji} Status ${status}${message}    `);
    }
    
    console.log("\n");

    // Analyze results
    console.log("\nStep 3: Analyzing Results");
    console.log("─".repeat(70));

    const success = results.filter(r => r.status === 200);
    const rateLimited = results.filter(r => r.status === 429);
    const failed = results.filter(r => r.status && r.status !== 200 && r.status !== 429);
    const errors = results.filter(r => r.error);

    console.log(`✅ Successful (200): ${success.length}/25`);
    console.log(`⏸️  Rate Limited (429): ${rateLimited.length}/25`);
    console.log(`❌ Other Failures: ${failed.length}/25`);
    console.log(`❌ Errors: ${errors.length}/25`);

    // Verify rate limit is working correctly
    console.log("\n\nStep 4: Verification");
    console.log("─".repeat(70));

    if (success.length === 20 && rateLimited.length === 5) {
      console.log("✅ PASS: Rate limiting working correctly!");
      console.log("   - First 20 requests succeeded");
      console.log("   - Next 5 requests were rate limited");
      
      if (rateLimited.length > 0) {
        const retryAfter = rateLimited[0].retryAfter;
        console.log(`   - Retry-After header present: ${retryAfter}s`);
      }
    } else if (success.length >= 20 && rateLimited.length > 0) {
      console.log("⚠️  PARTIAL: Rate limiting appears to be working");
      console.log(`   - ${success.length} requests succeeded`);
      console.log(`   - ${rateLimited.length} requests were rate limited`);
    } else {
      console.log("❌ FAIL: Rate limiting not working as expected");
      console.log(`   - Expected 20 successes, got ${success.length}`);
      console.log(`   - Expected 5+ rate limits, got ${rateLimited.length}`);
    }

    // Show timeline
    console.log("\n\nTimeline:");
    console.log("─".repeat(70));
    results.forEach((r, idx) => {
      const statusText = r.status === 200 ? "200 OK" : r.status === 429 ? "429 Rate Limited" : `${r.status || 'ERR'} ${r.error || ''}`;
      console.log(`  Request ${String(idx + 1).padStart(2, '0')}: ${statusText}`);
    });

  } catch (error) {
    console.log("❌ Error:", error.message);
  }

  console.log("\n");
}

testRateLimiting();
