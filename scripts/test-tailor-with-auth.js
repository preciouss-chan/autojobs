const fs = require("fs");
const crypto = require("crypto");

const resume = JSON.parse(fs.readFileSync("data/resume.json", "utf8"));

const jobDescription =
  "Senior Full-Stack Engineer with 5+ years experience in React, Node.js, TypeScript. Must know REST APIs, Docker, and Kubernetes.";

const secret = "1628fcdf43b0c768b80badfc0af626d1bd8ea08b1a9d256455e45c78e81b3d41";
const jwt = require("jsonwebtoken");

// Generate a valid JWT token with id and email (like extension auth)
const token = jwt.sign(
  {
    id: "test-user-123",
    email: "test@example.com",
    sub: "test",
  },
  secret,
  { expiresIn: "1h" }
);

(async () => {
  console.log("🧪 Testing Tailor Button with Authentication\n");

  console.log("1️⃣  Generated JWT token\n");

  console.log("2️⃣  Calling /api/tailor endpoint WITH auth header...\n");

  try {
    const response = await fetch("http://localhost:3000/api/tailor", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({
        jobDescription: jobDescription,
        resume: resume,
      }),
    });

    console.log(`Response status: ${response.status}`);

    const data = await response.json();

    if (response.status === 404) {
      console.log("❌ User not found in database (expected for test token)");
      console.log("This means: Auth works, but user needs to exist in DB");
      console.log("Error:", data);
    } else if (response.ok) {
      console.log("✅ Tailor API succeeded!");
      console.log("Cover letter preview:", (data.cover_letter || "").substring(0, 100));
    } else {
      console.log("❌ Tailor API failed!");
      console.log("Error:", data);
    }
  } catch (err) {
    console.error("❌ Error calling tailor API:", err);
  }
})();
