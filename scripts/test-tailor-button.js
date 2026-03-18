const fs = require("fs");
const resume = JSON.parse(fs.readFileSync("data/resume.json", "utf8"));

const jobDescription =
  "Senior Full-Stack Engineer with 5+ years experience in React, Node.js, TypeScript. Must know REST APIs, Docker, and Kubernetes.";

(async () => {
  console.log("🧪 Testing Tailor Button Flow\n");

  console.log("1️⃣  Calling /api/tailor endpoint...\n");

  try {
    const response = await fetch("http://localhost:3000/api/tailor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobDescription: jobDescription,
        resume: resume,
      }),
    });

    console.log(`Response status: ${response.status}`);
    console.log(`Response headers:`, response.headers);

    const data = await response.json();

    if (response.ok) {
      console.log("✅ Tailor API succeeded!\n");
      console.log("Response keys:", Object.keys(data));
      console.log("\nTailored resume keys:", Object.keys(data.tailored_resume || {}));
      console.log("Cover letter preview:", (data.cover_letter || "").substring(0, 100));
    } else {
      console.log("❌ Tailor API failed!");
      console.log("Error response:", data);
    }
  } catch (err) {
    console.error("❌ Error calling tailor API:", err);
  }
})();
