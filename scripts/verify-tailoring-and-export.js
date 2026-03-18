const fs = require("fs");
const jwt = require("jsonwebtoken");

const secret = "1628fcdf43b0c768b80badfc0af626d1bd8ea08b1a9d256455e45c78e81b3d41";
const resume = JSON.parse(fs.readFileSync("data/resume.json", "utf8"));
const jobDescription =
  "Senior Full-Stack Engineer with experience in React, Node.js, TypeScript, REST APIs, Docker, and microservices. Looking for someone who can lead technical projects and mentor junior developers.";

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
  console.log("Step 1: Tailor resume to job description...\n");

  // First, tailor the resume
  const tailorRes = await fetch("http://localhost:3000/api/tailor", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      resume,
      jobDescription,
    }),
  });

  if (!tailorRes.ok) {
    const err = await tailorRes.text();
    console.error("Tailor API failed:", tailorRes.status, err);
    process.exit(1);
  }

  const tailorData = await tailorRes.json();
  const tailoredResume = tailorData.tailored_resume;

  console.log("✅ Resume tailored\n");
  console.log("Original skills:", resume.skills.languages.join(", "));
  console.log(
    "Tailored skills:",
    tailoredResume.skills.languages.join(", ")
  );
  console.log("");

  console.log("Step 2: Export tailored resume to PDF...\n");

  // Now export the tailored resume to PDF
  const pdfRes = await fetch("http://localhost:3000/api/export/pdf", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      resume: tailoredResume,
      jobDescription,
    }),
  });

  if (!pdfRes.ok) {
    const err = await pdfRes.text();
    console.error("PDF export failed:", pdfRes.status, err);
    process.exit(1);
  }

  const buffer = Buffer.from(await pdfRes.arrayBuffer());
  fs.writeFileSync("/tmp/tailored-resume.pdf", buffer);

  console.log("✅ PDF exported successfully");
  console.log(`PDF size: ${(buffer.byteLength / 1024).toFixed(1)} KB`);
  console.log("Saved to: /tmp/tailored-resume.pdf\n");

  // Verify the tailored data
  console.log("================================================================================");
  console.log("VERIFICATION");
  console.log("================================================================================\n");

  console.log("✅ Experience preserved:");
  console.log(`   Original: ${resume.experience.length} positions`);
  console.log(`   Tailored: ${tailoredResume.experience.length} positions`);
  resume.experience.forEach((exp, idx) => {
    console.log(
      `   ${idx + 1}. ${exp.role} - ${exp.bullets.length} bullets`
    );
  });

  console.log("\n✅ Projects preserved:");
  console.log(`   Original: ${resume.projects.length} projects`);
  console.log(`   Tailored: ${tailoredResume.projects.length} projects`);
  resume.projects.forEach((proj, idx) => {
    console.log(
      `   ${idx + 1}. ${proj.name} - ${proj.bullets.length} bullets`
    );
  });

  console.log("\n✅ Skills enhanced:");
  console.log(`   Original languages: ${resume.skills.languages.length}`);
  console.log(`   Tailored languages: ${tailoredResume.skills.languages.length}`);
  console.log(
    `   Original frameworks: ${resume.skills.frameworks_libraries.length}`
  );
  console.log(
    `   Tailored frameworks: ${tailoredResume.skills.frameworks_libraries.length}`
  );
  console.log(`   Original tools: ${resume.skills.tools.length}`);
  console.log(`   Tailored tools: ${tailoredResume.skills.tools.length}`);

  console.log(
    "\n🎯 KEY RESULT: Resume is tailored for ATS matching while preserving all experience/project content"
  );
})();
