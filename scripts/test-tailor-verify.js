#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");

// Sample job description for testing
const testJobDescription = `
Senior Full-Stack Engineer - Next.js & React

We're looking for a Senior Full-Stack Engineer to join our growing team. You'll work on building scalable web applications using modern JavaScript technologies.

Requirements:
- 3+ years of experience with React and Next.js
- Strong TypeScript skills
- Experience with Node.js and REST APIs
- Proficiency with PostgreSQL and database design
- Git and CI/CD pipeline experience
- Experience with Docker and containerization

Nice to have:
- Experience with AI/ML integrations
- Open source contributions
- Experience with Tailwind CSS
- Startup experience

This role offers competitive compensation, equity, and the opportunity to impact millions of users.
`;

async function testTailor() {
  try {
    // Generate JWT token for test user
    // NOTE: Must use the actual AUTH_SECRET from .env.local
    const secret = "1628fcdf43b0c768b80badfc0af626d1bd8ea08b1a9d256455e45c78e81b3d41";
    const token = jwt.sign(
      {
        email: "test-tailor@autojobs.local",
        id: "cmmw6lw4800009kdkt1bnf1ny",
        iat: Math.floor(Date.now() / 1000),
      },
      secret,
      { expiresIn: "30d" }
    );

    console.log("🔑 Token generated\n");

    // Load the test resume
    const resumePath = path.join(process.cwd(), "data", "resume.json");
    const resume = JSON.parse(fs.readFileSync(resumePath, "utf8"));

    console.log("🔄 Testing Resume Tailoring API...\n");
    console.log("📄 Original Resume Summary:");
    console.log(`   Name: ${resume.name}`);
    console.log(`   Current Skills: ${resume.skills.languages.join(", ")}`);
    console.log(`   Experience: ${resume.experience.length} position(s)`);
    console.log(`   Experience Bullets (${resume.experience[0].company}):`);
    resume.experience[0].bullets.forEach((b, i) => console.log(`     ${i+1}. ${b}`));
    console.log(`   Projects: ${resume.projects.length} project(s)`);
    resume.projects.forEach(p => {
      console.log(`   - ${p.name}: ${p.bullets.length} bullet(s)`);
    });
    console.log("\n");

    // Make API call to tailor endpoint
    const response = await fetch("http://localhost:3000/api/tailor", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({
        jobDescription: testJobDescription,
        resume: resume,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("❌ API Error:", errorData);
      process.exit(1);
    }

    const tailoredData = await response.json();

    console.log("✅ Tailoring Complete!\n");
    console.log("=".repeat(80));
    console.log("CRITICAL VERIFICATION");
    console.log("=".repeat(80));

    // Check if experience_edits is empty
    const hasExperienceEdits = Object.keys(tailoredData.experience_edits || {}).length > 0;
    const hasProjectEdits = Object.keys(tailoredData.project_edits || {}).length > 0;

    console.log("\n📋 EXPERIENCE EDITS:");
    if (hasExperienceEdits) {
      console.log("  ❌ FAIL - Experience has edits (should be empty):");
      console.log("  ", JSON.stringify(tailoredData.experience_edits, null, 2));
    } else {
      console.log("  ✅ PASS - No experience edits (as expected)");
    }

    console.log("\n📋 PROJECT EDITS:");
    if (hasProjectEdits) {
      console.log("  ❌ FAIL - Projects have edits (should be empty):");
      console.log("  ", JSON.stringify(tailoredData.project_edits, null, 2));
    } else {
      console.log("  ✅ PASS - No project edits (as expected)");
    }

    // Check skills section
    console.log("\n🎯 SKILLS TO SURFACE:");
    console.log("-".repeat(80));
    console.log("Current Skills:", resume.skills.languages.join(", "));
    if (tailoredData.skills_to_add?.languages?.length > 0) {
      console.log("Add to Languages:", tailoredData.skills_to_add.languages.join(", "));
    }
    if (tailoredData.skills_to_add?.frameworks_libraries?.length > 0) {
      console.log("Add to Frameworks:", tailoredData.skills_to_add.frameworks_libraries.join(", "));
    }
    if (tailoredData.skills_to_add?.tools?.length > 0) {
      console.log("Add to Tools:", tailoredData.skills_to_add.tools.join(", "));
    }

    // Cover letter
    console.log("\n📧 GENERATED COVER LETTER (first 300 chars):");
    console.log("-".repeat(80));
    console.log(tailoredData.cover_letter?.substring(0, 300) + "...\n");

    console.log("=".repeat(80));
    if (!hasExperienceEdits && !hasProjectEdits) {
      console.log("✅ TEST PASSED - Experience and projects remain untouched!");
    } else {
      console.log("❌ TEST FAILED - Experience or projects were modified!");
      process.exit(1);
    }
    console.log("=".repeat(80));
  } catch (error) {
    console.error("❌ Test Error:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testTailor();
