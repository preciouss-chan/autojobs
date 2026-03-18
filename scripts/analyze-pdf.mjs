import pdf from "pdf-parse/lib/pdf-parse.js";
import { readFileSync } from "fs";

const pdfPath = "/tmp/test-export.pdf";
const pdfData = readFileSync(pdfPath);

const data = await pdf(pdfData);

console.log("=== PDF Content Analysis ===\n");
console.log(`Total pages: ${data.numpages}`);
console.log(`Text length: ${data.text.length} characters\n`);

const text = data.text;

// Count projects mentioned
const projectMatches = text.match(/Rizz Chatbot|Flappy Bird|Automated Budget|Apply Boost/g) || [];
console.log(`Projects found: ${new Set(projectMatches).size}/4`);

// Count key phrases from project bullets
const rizzzBullets = text.match(/Fine-tuned a GPT|Designed and built a lightweight|Evolved from a playful/g) || [];
console.log(`Rizz Chatbot bullets visible: ${rizzzBullets.length}/3`);

const flappyBullets = text.match(/Developed a Unity game|Implemented progression-based|Abilities can be/g) || [];
console.log(`Flappy Bird bullets visible: ${flappyBullets.length}/3`);

const budgetBullets = text.match(/Automated budgeting app|monthly spending summaries|AI-powered categorization/g) || [];
console.log(`Budget App bullets visible: ${budgetBullets.length}/3`);

const applyBoostBullets = text.match(/Co-developed Apply-Boost|Simplifying Recruiting|seamless backend/g) || [];
console.log(`Apply Boost bullets visible: ${applyBoostBullets.length}/3`);

console.log("\n=== Content Preview ===\n");

// Show sections
const sections = [
  { name: "EXPERIENCE", regex: /EXPERIENCE(.*?)(?=PROJECTS|SKILLS|EDUCATION|$)/s },
  { name: "PROJECTS", regex: /PROJECTS(.*?)(?=SKILLS|EDUCATION|$)/s },
  { name: "SKILLS", regex: /SKILLS(.*?)(?=EDUCATION|$)/s },
  { name: "EDUCATION", regex: /EDUCATION(.*?)$/s },
];

sections.forEach(({ name, regex }) => {
  const match = text.match(regex);
  if (match) {
    const section = match[0].substring(0, 300).trim();
    console.log(`${name}:\n${section}...\n`);
  }
});

console.log("=== Full Text ===\n");
console.log(text);
