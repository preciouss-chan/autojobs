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

const estimateResumeHeight = (inputResume) => {
  let estimatedHeight = 34;

  if (inputResume.summary && inputResume.summary.trim().length > 0) {
    const summaryLines = doc.splitTextToSize(inputResume.summary, contentWidth);
    estimatedHeight += 28 + summaryLines.length * lineHeightFor(10) + 8;
  }

  if (inputResume.experience && inputResume.experience.length > 0) {
    estimatedHeight += 28;
    inputResume.experience.forEach((exp, index) => {
      estimatedHeight += 14;
      (exp.bullets ?? []).forEach((bullet) => {
        const lines = doc.splitTextToSize(`• ${bullet}`, contentWidth - 10);
        estimatedHeight += lines.length * lineHeightFor(10) + 2;
      });
      if (index < inputResume.experience.length - 1) {
        estimatedHeight += 10;
      }
    });
  }

  if (inputResume.projects && inputResume.projects.length > 0) {
    estimatedHeight += 28;
    inputResume.projects.forEach((proj, index) => {
      estimatedHeight += 14;
      (proj.bullets ?? []).forEach((bullet) => {
        const lines = doc.splitTextToSize(`• ${bullet}`, contentWidth - 10);
        estimatedHeight += lines.length * lineHeightFor(10) + 2;
      });
      if (index < inputResume.projects.length - 1) {
        estimatedHeight += 10;
      }
    });
  }

  if (inputResume.skills) {
    const skillsArr = [];
    if (inputResume.skills.languages?.length) {
      skillsArr.push(`Languages: ${inputResume.skills.languages.join(", ")}`);
    }
    if (inputResume.skills.frameworks_libraries?.length) {
      skillsArr.push(
        `Frameworks: ${inputResume.skills.frameworks_libraries.join(", ")}`
      );
    }
    if (inputResume.skills.tools?.length) {
      skillsArr.push(`Tools: ${inputResume.skills.tools.join(", ")}`);
    }
    if (skillsArr.length > 0) {
      estimatedHeight += 28;
      skillsArr.forEach((skillLine) => {
        const lines = doc.splitTextToSize(skillLine, contentWidth);
        estimatedHeight += lines.length * lineHeightFor(10) + 4;
      });
    }
  }

  if (inputResume.education && inputResume.education.length > 0) {
    estimatedHeight += 28;
    inputResume.education.forEach((edu, index) => {
      const degreeText = `${edu.degree ?? ""} — ${edu.institution ?? ""}`;
      const degreeLines = doc.splitTextToSize(degreeText, contentWidth);
      estimatedHeight += degreeLines.length * lineHeightFor(10) + 6;

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
        estimatedHeight += detailLines.length * lineHeightFor(9) + 8;
      }

      if (index < inputResume.education.length - 1) {
        estimatedHeight += 8;
      }
    });
  }

  return estimatedHeight;
};

const maxHeight = pageHeight - margin * 2;
const fittedResume = JSON.parse(JSON.stringify(resume));

console.log("=== Simulating fitResumeToOnePage() ===\n");
console.log(`Max height: ${maxHeight.toFixed(2)}pt\n`);

// Priority 1: Trim tools skills
let step = 1;
let height = estimateResumeHeight(fittedResume);
console.log(`Step ${step} - Before trimming tools: ${height.toFixed(2)}pt ${height <= maxHeight ? "✓ FITS" : "✗ OVER"}`);

if (fittedResume.skills.tools.length > 4) {
  fittedResume.skills.tools = fittedResume.skills.tools.slice(0, 4);
  height = estimateResumeHeight(fittedResume);
  step++;
  console.log(`Step ${step} - After trimming tools to 4: ${height.toFixed(2)}pt ${height <= maxHeight ? "✓ FITS" : "✗ OVER"}`);
}

// Priority 2: Trim frameworks
if (height > maxHeight && fittedResume.skills.frameworks_libraries.length > 5) {
  fittedResume.skills.frameworks_libraries = fittedResume.skills.frameworks_libraries.slice(0, 5);
  height = estimateResumeHeight(fittedResume);
  step++;
  console.log(`Step ${step} - After trimming frameworks to 5: ${height.toFixed(2)}pt ${height <= maxHeight ? "✓ FITS" : "✗ OVER"}`);
}

// Priority 3: Trim languages
if (height > maxHeight && fittedResume.skills.languages.length > 5) {
  fittedResume.skills.languages = fittedResume.skills.languages.slice(0, 5);
  height = estimateResumeHeight(fittedResume);
  step++;
  console.log(`Step ${step} - After trimming languages to 5: ${height.toFixed(2)}pt ${height <= maxHeight ? "✓ FITS" : "✗ OVER"}`);
}

// Priority 4: Remove projects
if (height > maxHeight) {
  while (fittedResume.projects.length > 1 && height > maxHeight) {
    fittedResume.projects = fittedResume.projects.slice(0, -1);
    height = estimateResumeHeight(fittedResume);
    step++;
    console.log(`Step ${step} - After removing project (${fittedResume.projects.length} left): ${height.toFixed(2)}pt ${height <= maxHeight ? "✓ FITS" : "✗ OVER"}`);
  }
}

console.log(`\n=== Final Result ===`);
console.log(`Projects: ${fittedResume.projects.length} (${4 - fittedResume.projects.length} removed)`);
console.log(`Tools: ${fittedResume.skills.tools.length}`);
console.log(`Frameworks: ${fittedResume.skills.frameworks_libraries.length}`);
console.log(`Languages: ${fittedResume.skills.languages.length}`);
console.log(`Final height: ${height.toFixed(2)}pt`);
console.log(`Fits? ${height <= maxHeight ? "YES" : "NO"}`);

// Show space utilization
const remainingSpace = maxHeight - height;
const percentUsed = (height / maxHeight) * 100;
console.log(`\nSpace utilization:`);
console.log(`  Used: ${height.toFixed(2)}pt (${percentUsed.toFixed(1)}%)`);
console.log(`  Remaining: ${remainingSpace.toFixed(2)}pt`);

// Check if we're being too conservative
console.log(`\n=== Should we remove projects? ===`);
console.log(`Initial estimate: 810.85pt (from debug-height-v2.js)`);
console.log(`With 3 projects: 677.35pt`);
console.log(`Space remaining: 58.65pt`);
console.log(`4th project size: 133.5pt`);
console.log(`\nThe compaction removes the 4th project because estimate shows it doesn't fit.`);
console.log(`But the real issue: We're including ALL skills and ALL education.`);
console.log(`Together they add ~145pt (74.5 for skills + 71.85 for education).`);
