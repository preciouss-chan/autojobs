#!/usr/bin/env node

const fs = require("fs");
const resume = JSON.parse(fs.readFileSync("data/resume.json", "utf8"));

console.log("\n📐 RESUME HEIGHT ANALYSIS:");
console.log("=".repeat(80));

console.log("\n1️⃣ Experience Section:");
console.log("   - Entries:", resume.experience.length);
resume.experience.forEach((exp, i) => {
  console.log(`   - Entry ${i+1}: "${exp.company}" has ${exp.bullets.length} bullets`);
  exp.bullets.forEach((b, j) => {
    const wordCount = b.split(/\s+/).length;
    console.log(`     • Bullet ${j+1}: ${wordCount} words (~${Math.ceil(wordCount/10)} lines)`);
  });
});

console.log("\n2️⃣ Projects Section:");
console.log("   - Projects:", resume.projects.length);
resume.projects.forEach((proj, i) => {
  console.log(`   - Project ${i+1}: "${proj.name}" has ${proj.bullets.length} bullets`);
  proj.bullets.forEach((b, j) => {
    const wordCount = b.split(/\s+/).length;
    console.log(`     • Bullet ${j+1}: ${wordCount} words (~${Math.ceil(wordCount/10)} lines)`);
  });
});

console.log("\n3️⃣ Skills Section:");
console.log("   - Languages:", resume.skills.languages.length);
console.log("   - Frameworks:", resume.skills.frameworks_libraries.length);
console.log("   - Tools:", resume.skills.tools.length);

console.log("\n4️⃣ Education Section:");
console.log("   - Entries:", resume.education.length);

// Estimate total lines needed at ~11pt font on 8.5x11 letter
// Letter height: 11 inches = 792pt, margins 28pt each = 736pt available
// Line height at 10pt: 11.5pt per line
const pointsAvailable = 736;
const lineHeight = 10 * 1.15;
const linesAvailable = Math.floor(pointsAvailable / lineHeight);

console.log(`\n📄 PAGE CAPACITY ANALYSIS:`);
console.log(`   - Page height: 792pt`);
console.log(`   - Margins: 28pt top + 28pt bottom = 56pt`);
console.log(`   - Available: 736pt`);
console.log(`   - Line height: ${lineHeight}pt`);
console.log(`   - Lines available: ${linesAvailable} lines`);

