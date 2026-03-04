#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

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
    // Load the test resume
    const resumePath = path.join(process.cwd(), "data", "resume.json");
    const resume = JSON.parse(fs.readFileSync(resumePath, "utf8"));

    console.log("🔄 Testing Resume Tailoring API...\n");
    console.log("📄 Original Resume Summary:");
    console.log(`   Name: ${resume.name}`);
    console.log(`   Current Skills: ${resume.skills.languages.join(", ")}`);
    console.log(`   Experience: ${resume.experience.length} position(s)`);
    console.log(`   Projects: ${resume.projects.length} project(s)`);
    console.log("\n");

    // Make API call to tailor endpoint
    const response = await fetch("http://localhost:3000/api/tailor", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-OpenAI-API-Key": process.env.OPENAI_API_KEY || "",
      },
      body: JSON.stringify({
        jobDescription: testJobDescription,
        resume: resume,
        // jobRequirements is optional, omit it
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
    console.log("BEFORE & AFTER COMPARISON");
    console.log("=".repeat(80));

    // Original summary (from resume.json or build one)
    const originalSummary =
      resume.summary ||
      "Computer Science student at Arizona State University with experience in full-stack development, machine learning, and VR technology.";

    console.log("\n📝 SUMMARY");
    console.log("-".repeat(80));
    console.log("BEFORE:");
    console.log(originalSummary);
    console.log("\nAFTER:");
    console.log(tailoredData.updated_summary);

    // Experience edits
    console.log("\n\n💼 EXPERIENCE EDITS (Dreamscape Learn)");
    console.log("-".repeat(80));
    console.log("BEFORE:");
    resume.experience[0].bullets.forEach((b) => console.log(`  • ${b}`));

    if (tailoredData.experience_edits?.["Dreamscape Learn"]) {
      console.log("\nAFTER:");
      tailoredData.experience_edits["Dreamscape Learn"].forEach((b) =>
        console.log(`  • ${b}`)
      );
    }

    // Project edits
    console.log("\n\n🚀 PROJECT EDITS");
    console.log("-".repeat(80));

    const applyBoostProject = resume.projects.find(
      (p) => p.name === "Apply Boost (Hackathon Project)"
    );
    if (applyBoostProject && tailoredData.project_edits?.["Apply Boost (Hackathon Project)"]) {
      console.log("Apply Boost (Hackathon Project):");
      console.log("\nBEFORE:");
      applyBoostProject.bullets.forEach((b) => console.log(`  • ${b}`));

      console.log("\nAFTER:");
      tailoredData.project_edits["Apply Boost (Hackathon Project)"].forEach((b) =>
        console.log(`  • ${b}`)
      );
    }

    // Skills to add
    console.log("\n\n🎯 SUGGESTED NEW SKILLS");
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
    console.log("\n\n📧 GENERATED COVER LETTER");
    console.log("-".repeat(80));
    console.log(tailoredData.cover_letter);

    console.log("\n" + "=".repeat(80));
    console.log("✅ Test Complete! Check the differences above.");
    console.log("=".repeat(80));
  } catch (error) {
    console.error("❌ Test Error:", error.message);
    process.exit(1);
  }
}

testTailor();
