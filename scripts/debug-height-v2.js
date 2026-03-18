import { jsPDF } from "jspdf";
import { readFileSync } from "fs";

const resume = JSON.parse(readFileSync("./data/resume.json", "utf-8"));

// Create PDF document (Letter size: 8.5 x 11 inches = 612 x 792 pt)
const doc = new jsPDF({
  orientation: "portrait",
  unit: "pt",
  format: "letter",
});

const pageWidth = doc.internal.pageSize.getWidth();
const pageHeight = doc.internal.pageSize.getHeight();
const margin = 28;
const contentWidth = pageWidth - 2 * margin;

console.log("=== PDF Page Dimensions ===");
console.log(`Page width: ${pageWidth}pt`);
console.log(`Page height: ${pageHeight}pt`);
console.log(`Margin: ${margin}pt`);
console.log(`Content width: ${contentWidth}pt`);
console.log(`Max height for content: ${pageHeight - margin * 2}pt`);
console.log("");

const lineHeightFor = (fontSize) => {
  return fontSize * 1.15;
};

// Estimate function from the actual code
const estimateResumeHeight = (inputResume) => {
  let estimatedHeight = 34; // Initial margin for header

  if (inputResume.summary && inputResume.summary.trim().length > 0) {
    const summaryLines = doc.splitTextToSize(
      inputResume.summary,
      contentWidth
    );
    estimatedHeight += 28 + summaryLines.length * lineHeightFor(10) + 8;
  }

  if (inputResume.experience && inputResume.experience.length > 0) {
    estimatedHeight += 28; // Section header
    inputResume.experience.forEach((exp, index) => {
      estimatedHeight += 14; // Company/role line
      (exp.bullets ?? []).forEach((bullet) => {
        const lines = doc.splitTextToSize(`• ${bullet}`, contentWidth - 10);
        estimatedHeight += lines.length * lineHeightFor(10) + 2;
      });
      if (index < inputResume.experience.length - 1) {
        estimatedHeight += 10; // Space between entries
      }
    });
  }

  if (inputResume.projects && inputResume.projects.length > 0) {
    estimatedHeight += 28; // Section header
    inputResume.projects.forEach((proj, index) => {
      estimatedHeight += 14; // Project name line
      (proj.bullets ?? []).forEach((bullet) => {
        const lines = doc.splitTextToSize(`• ${bullet}`, contentWidth - 10);
        estimatedHeight += lines.length * lineHeightFor(10) + 2;
      });
      if (index < inputResume.projects.length - 1) {
        estimatedHeight += 10; // Space between entries
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
      estimatedHeight += 28; // Section header
      skillsArr.forEach((skillLine) => {
        const lines = doc.splitTextToSize(skillLine, contentWidth);
        estimatedHeight += lines.length * lineHeightFor(10) + 4;
      });
    }
  }

  if (inputResume.education && inputResume.education.length > 0) {
    estimatedHeight += 28; // Section header
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
const estimatedHeight = estimateResumeHeight(resume);

console.log("=== Height Estimation ===");
console.log(`Estimated height: ${estimatedHeight.toFixed(2)}pt`);
console.log(`Max height available: ${maxHeight.toFixed(2)}pt`);
console.log(`Difference: ${(maxHeight - estimatedHeight).toFixed(2)}pt`);
console.log(`Percentage of page used: ${((estimatedHeight / maxHeight) * 100).toFixed(1)}%`);
console.log("");

console.log("=== Component Breakdown ===");

// Header
let componentHeight = 34;
console.log(`Header: ${componentHeight}pt`);

// Experience
let expHeight = 28;
resume.experience.forEach((exp, index) => {
  expHeight += 14;
  (exp.bullets ?? []).forEach((bullet) => {
    const lines = doc.splitTextToSize(`• ${bullet}`, contentWidth - 10);
    const bulletHeight = lines.length * lineHeightFor(10) + 2;
    expHeight += bulletHeight;
  });
  if (index < resume.experience.length - 1) {
    expHeight += 10;
  }
});
console.log(`Experience: ${expHeight.toFixed(2)}pt`);

// Projects
let projectHeight = 28;
resume.projects.forEach((proj, index) => {
  projectHeight += 14;
  (proj.bullets ?? []).forEach((bullet) => {
    const lines = doc.splitTextToSize(`• ${bullet}`, contentWidth - 10);
    const bulletHeight = lines.length * lineHeightFor(10) + 2;
    projectHeight += bulletHeight;
  });
  if (index < resume.projects.length - 1) {
    projectHeight += 10;
  }
});
console.log(`Projects: ${projectHeight.toFixed(2)}pt`);

// Skills
let skillsHeight = 28;
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
  skillsHeight += lines.length * lineHeightFor(10) + 4;
});
console.log(`Skills: ${skillsHeight.toFixed(2)}pt`);

// Education
let eduHeight = 28;
resume.education.forEach((edu, index) => {
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

  if (index < resume.education.length - 1) {
    eduHeight += 8;
  }
});
console.log(`Education: ${eduHeight.toFixed(2)}pt`);

console.log("");
console.log("=== Total Calculation ===");
const total = componentHeight + expHeight + projectHeight + skillsHeight + eduHeight;
console.log(`Total: ${total.toFixed(2)}pt`);
console.log(`Estimated (from function): ${estimatedHeight.toFixed(2)}pt`);

console.log("");
console.log("=== Project Details ===");
resume.projects.forEach((proj, idx) => {
  console.log(`\nProject ${idx + 1}: ${proj.name}`);
  console.log(`  Bullets: ${proj.bullets.length}`);
  proj.bullets.forEach((bullet, bIdx) => {
    const lines = doc.splitTextToSize(`• ${bullet}`, contentWidth - 10);
    console.log(`    Bullet ${bIdx + 1}: ${lines.length} lines (${bullet.substring(0, 50)}...)`);
  });
});

console.log("");
console.log("=== Question: Why doesn't the 4th project fit? ===");
console.log(`Available space: ${maxHeight}pt`);
console.log(`Used by first 3 projects + other sections: Check by removing 4th project`);

// Test without last project
const testResume = JSON.parse(JSON.stringify(resume));
testResume.projects = testResume.projects.slice(0, 3);
const heightWith3Projects = estimateResumeHeight(testResume);

testResume.projects = JSON.parse(JSON.stringify(resume)).projects.slice(0, 4);
const heightWith4Projects = estimateResumeHeight(testResume);

console.log(`Height with 3 projects: ${heightWith3Projects.toFixed(2)}pt`);
console.log(`Height with 4 projects: ${heightWith4Projects.toFixed(2)}pt`);
console.log(`4th project adds: ${(heightWith4Projects - heightWith3Projects).toFixed(2)}pt`);
console.log(`Space remaining: ${(maxHeight - heightWith3Projects).toFixed(2)}pt`);
console.log(`Would 4th project fit? ${heightWith4Projects <= maxHeight ? "YES" : "NO (estimate says)"}`);
