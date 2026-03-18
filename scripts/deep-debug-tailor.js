#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");

const testJobDescription = `
Senior Full-Stack Engineer - Next.js & React

Requirements:
- 3+ years of experience with React and Next.js
- Strong TypeScript skills
- Experience with Docker
`;

async function deepDebugTailor() {
  try {
    // Generate JWT token
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

    // Load resume
    const resume = JSON.parse(fs.readFileSync("data/resume.json", "utf8"));

    console.log("\n=== STEP 1: Original Resume ===");
    console.log("Experience bullets count:", resume.experience[0].bullets.length);
    console.log("First experience bullet:", resume.experience[0].bullets[0].substring(0, 80) + "...");
    console.log("Projects count:", resume.projects.length);
    console.log("First project bullets:", resume.projects[0].bullets.length);

    // Call tailoring API
    console.log("\n=== STEP 2: Calling Tailor API ===");
    const tailorResponse = await fetch("http://localhost:3000/api/tailor", {
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

    const tailorData = await tailorResponse.json();
    console.log("Tailor response keys:", Object.keys(tailorData));
    console.log("experience_edits empty:", Object.keys(tailorData.experience_edits || {}).length === 0);
    console.log("project_edits empty:", Object.keys(tailorData.project_edits || {}).length === 0);

    // Now merge the tailored data with resume
    console.log("\n=== STEP 3: Merge Tailored Data ===");
    // Simulate what the frontend does
    let mergedResume = JSON.parse(JSON.stringify(resume));
    
    // Apply skills
    if (tailorData.skills_to_add) {
      console.log("Skills to add:", {
        languages: tailorData.skills_to_add.languages?.length || 0,
        frameworks: tailorData.skills_to_add.frameworks_libraries?.length || 0,
        tools: tailorData.skills_to_add.tools?.length || 0,
      });
      
      // Merge skills
      if (tailorData.skills_to_add.languages) {
        mergedResume.skills.languages.push(...tailorData.skills_to_add.languages);
      }
      if (tailorData.skills_to_add.frameworks_libraries) {
        mergedResume.skills.frameworks_libraries.push(...tailorData.skills_to_add.frameworks_libraries);
      }
      if (tailorData.skills_to_add.tools) {
        mergedResume.skills.tools.push(...tailorData.skills_to_add.tools);
      }
    }

    console.log("After merge - Experience bullets:", mergedResume.experience[0].bullets.length);
    console.log("After merge - First experience bullet:", mergedResume.experience[0].bullets[0].substring(0, 80) + "...");

    // Now export to PDF
    console.log("\n=== STEP 4: Export to PDF ===");
    const pdfResponse = await fetch("http://localhost:3000/api/export/pdf", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        resume: mergedResume,
      }),
    });

    if (!pdfResponse.ok) {
      console.error("PDF export failed:", await pdfResponse.json());
      return;
    }

    // Save PDF to file
    const pdfBuffer = await pdfResponse.arrayBuffer();
    fs.writeFileSync("debug_output.pdf", Buffer.from(pdfBuffer));
    console.log("PDF saved to debug_output.pdf");

    console.log("\n=== SUMMARY ===");
    console.log("✓ Original experience bullets:", resume.experience[0].bullets.length);
    console.log("✓ After merge experience bullets:", mergedResume.experience[0].bullets.length);
    console.log("✓ Experience edits from tailor:", Object.keys(tailorData.experience_edits || {}).length);
    console.log("\nThe PDF compaction happens in the /api/export/pdf route!");

  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

deepDebugTailor();
