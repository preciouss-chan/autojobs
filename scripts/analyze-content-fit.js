import { jsPDF } from "jspdf";
import { readFileSync } from "fs";

const resume = JSON.parse(readFileSync("./data/resume.json", "utf-8"));

const doc = new jsPDF({
  orientation: "portrait",
  unit: "pt",
  format: "letter",
});

const pageWidth = doc.internal.pageSize.getWidth();
const pageHeight = doc.internal.pageSize.getHeight();
const margin = 28;
const contentWidth = pageWidth - 2 * margin;

const lineHeightFor = (fontSize) => {
  return fontSize * 1.15;
};

console.log("=== Analyzing 4th Project Size ===\n");

const project4 = resume.projects[3];
console.log(`Project: ${project4.name}`);
console.log(`Bullets count: ${project4.bullets.length}\n`);

let projectHeight = 14; // Project name line
console.log("Bullet breakdown:");

project4.bullets.forEach((bullet, idx) => {
  const lines = doc.splitTextToSize(`• ${bullet}`, contentWidth - 10);
  const bulletHeight = lines.length * lineHeightFor(10) + 2;
  projectHeight += bulletHeight;
  console.log(`  Bullet ${idx + 1}: ${lines.length} lines = ${bulletHeight.toFixed(2)}pt`);
  console.log(`    Text: "${bullet.substring(0, 60)}..."`);
});

console.log(`\nTotal project height: ${projectHeight.toFixed(2)}pt`);
console.log(`Space needed between projects: 10pt`);
console.log(`Total with spacing: ${(projectHeight + 10).toFixed(2)}pt`);

// Now simulate what actually gets rendered
console.log("\n=== Full Resume with 4 Projects ===");

let yPosition = margin;

// Header
yPosition += 34;
console.log(`After header: y=${yPosition}`);

// Experience
yPosition += 28;
resume.experience.forEach((exp) => {
  yPosition += 14;
  (exp.bullets ?? []).forEach((bullet) => {
    const lines = doc.splitTextToSize(`• ${bullet}`, contentWidth - 10);
    yPosition += lines.length * lineHeightFor(10) + 2;
  });
  yPosition += 10;
});
console.log(`After experience: y=${yPosition}`);

// Projects
yPosition += 28;
console.log(`After projects header: y=${yPosition}`);

resume.projects.forEach((proj, idx) => {
  yPosition += 14;
  console.log(`  Project ${idx + 1} name: y=${yPosition}`);
  
  (proj.bullets ?? []).forEach((bullet) => {
    const lines = doc.splitTextToSize(`• ${bullet}`, contentWidth - 10);
    yPosition += lines.length * lineHeightFor(10) + 2;
  });
  
  if (idx < resume.projects.length - 1) {
    yPosition += 10;
  }
  
  console.log(`  After project ${idx + 1}: y=${yPosition}`);
});

// Skills
yPosition += 28;
const skillsArr = [];
if (resume.skills.languages?.length) {
  skillsArr.push(`Languages: ${resume.skills.languages.join(", ")}`);
}
if (resume.skills.frameworks_libraries?.length) {
  skillsArr.push(
    `Frameworks: ${resume.skills.frameworks_libraries.join(", ")}`
  );
}
if (resume.skills.tools?.length) {
  skillsArr.push(`Tools: ${resume.skills.tools.join(", ")}`);
}
skillsArr.forEach((skillLine) => {
  const lines = doc.splitTextToSize(skillLine, contentWidth);
  yPosition += lines.length * lineHeightFor(10) + 4;
});
console.log(`After skills: y=${yPosition}`);

// Education
yPosition += 28;
resume.education.forEach((edu) => {
  const degreeText = `${edu.degree ?? ""} — ${edu.institution ?? ""}`;
  const degreeLines = doc.splitTextToSize(degreeText, contentWidth);
  yPosition += degreeLines.length * lineHeightFor(10) + 6;

  const detailsArr = [];
  if (edu.graduation_year) {
    detailsArr.push(`Graduation: ${edu.graduation_year}`);
  }
  if (edu.gpa) {
    detailsArr.push(`GPA: ${edu.gpa}`);
  }
  if (detailsArr.length > 0) {
    const detailLines = doc.splitTextToSize(
      detailsArr.join(" • "),
      contentWidth
    );
    yPosition += detailLines.length * lineHeightFor(9) + 8;
  }

  yPosition += 8;
});
console.log(`After education: y=${yPosition}`);

console.log(`\n=== Results ===`);
console.log(`Final y position: ${yPosition.toFixed(2)}pt`);
console.log(`Page height - margin: ${(pageHeight - margin).toFixed(2)}pt`);
console.log(`Overflow: ${(yPosition - (pageHeight - margin)).toFixed(2)}pt`);
console.log(`Fits on one page? ${yPosition <= pageHeight - margin ? "YES" : "NO"}`);

// Can we fit by trimming something?
console.log("\n=== Could we fit 4th project by trimming something? ===");
console.log(`Overflow amount: ${(yPosition - (pageHeight - margin)).toFixed(2)}pt`);

// Skills breakdown
const skillsOnly = 28;
const skillLines = skillsArr.reduce((sum, line) => {
  const lines = doc.splitTextToSize(line, contentWidth);
  return sum + lines.length * lineHeightFor(10) + 4;
}, 0);
console.log(`Skills section uses: ${(skillsOnly + skillLines).toFixed(2)}pt`);

// Could we reduce skills to fit?
console.log("\nIf we remove all skills:");
const withoutSkills = yPosition - (skillsOnly + skillLines);
console.log(`  Height would be: ${withoutSkills.toFixed(2)}pt`);
console.log(`  Fits? ${withoutSkills <= pageHeight - margin ? "YES" : "NO"}`);

// Education breakdown
const eduBreakdown = 28;
let eduHeight = 0;
resume.education.forEach((edu) => {
  const degreeText = `${edu.degree ?? ""} — ${edu.institution ?? ""}`;
  const degreeLines = doc.splitTextToSize(degreeText, contentWidth);
  eduHeight += degreeLines.length * lineHeightFor(10) + 6;

  const detailsArr = [];
  if (edu.graduation_year) {
    detailsArr.push(`Graduation: ${edu.graduation_year}`);
  }
  if (edu.gpa) {
    detailsArr.push(`GPA: ${edu.gpa}`);
  }
  if (detailsArr.length > 0) {
    const detailLines = doc.splitTextToSize(
      detailsArr.join(" • "),
      contentWidth
    );
    eduHeight += detailLines.length * lineHeightFor(9) + 8;
  }
  eduHeight += 8;
});

console.log("\nEducation section breakdown:");
console.log(`  Section header: 28pt`);
console.log(`  Content: ${eduHeight.toFixed(2)}pt`);
console.log(`  Total: ${(eduBreakdown + eduHeight).toFixed(2)}pt`);
