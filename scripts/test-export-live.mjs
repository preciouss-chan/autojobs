import { readFileSync } from "fs";
import fetch from "node-fetch";

const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0IiwiaWF0IjoxNzczODUxNzk3LCJleHAiOjE3NzM4NTUzOTd9.3NLJTsY0CvUkoMWNflpJNP7Qa7Y5SB23-TofOyB4OGs";
const resume = JSON.parse(readFileSync("./data/resume.json", "utf-8"));
const jobDescription =
  "Looking for a full-stack developer experienced with React, Node.js, TypeScript, and cloud technologies. Must have strong problem-solving skills.";

console.log("=== Testing PDF Export ===\n");

console.log("Resume projects before export:");
resume.projects.forEach((proj, idx) => {
  console.log(`  Project ${idx + 1}: ${proj.name} (${proj.bullets.length} bullets)`);
});

console.log("\nExperience entries:");
resume.experience.forEach((exp, idx) => {
  console.log(`  ${idx + 1}. ${exp.role} at ${exp.company} (${exp.bullets.length} bullets)`);
});

const payload = {
  resume: resume,
  jobDescription: jobDescription,
};

const response = await fetch("http://localhost:3000/api/export/pdf", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify(payload),
});

console.log(`\nResponse status: ${response.status}`);
console.log(`Content-Type: ${response.headers.get("content-type")}`);

if (response.status === 200) {
  const buffer = await response.arrayBuffer();
  console.log(`PDF size: ${(buffer.byteLength / 1024).toFixed(1)} KB`);
  
  // Save PDF for inspection
  const fs = require("fs");
  fs.writeFileSync("/tmp/test-export.pdf", Buffer.from(buffer));
  console.log("Saved to: /tmp/test-export.pdf");
} else {
  const text = await response.text();
  console.log(`Error response: ${text.substring(0, 500)}`);
}

process.exit(0);
