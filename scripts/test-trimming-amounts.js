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

console.log("=== Current Skills Sizes ===\n");
console.log(`Languages: ${resume.skills.languages.length}`);
console.log(`Frameworks: ${resume.skills.frameworks_libraries.length}`);
console.log(`Tools: ${resume.skills.tools.length}\n`);

// Test what trimming actually saves
const testResume = JSON.parse(JSON.stringify(resume));
const baseHeight = estimateResumeHeight(testResume);
console.log(`Base height: ${baseHeight.toFixed(2)}pt\n`);

// Test trimming tools from 6 to 4
testResume.skills.tools = resume.skills.tools.slice(0, 4);
const afterTrimTools = estimateResumeHeight(testResume);
console.log(`After trimming tools 6→4: ${afterTrimTools.toFixed(2)}pt (saves ${(baseHeight - afterTrimTools).toFixed(2)}pt)`);

// Test trimming frameworks from 6 to 5
testResume.skills.tools = resume.skills.tools;
testResume.skills.frameworks_libraries = resume.skills.frameworks_libraries.slice(0, 5);
const afterTrimFrameworks = estimateResumeHeight(testResume);
console.log(`After trimming frameworks 6→5: ${afterTrimFrameworks.toFixed(2)}pt (saves ${(baseHeight - afterTrimFrameworks).toFixed(2)}pt)`);

// Test trimming languages from 7 to 5
testResume.skills.frameworks_libraries = resume.skills.frameworks_libraries;
testResume.skills.languages = resume.skills.languages.slice(0, 5);
const afterTrimLanguages = estimateResumeHeight(testResume);
console.log(`After trimming languages 7→5: ${afterTrimLanguages.toFixed(2)}pt (saves ${(baseHeight - afterTrimLanguages).toFixed(2)}pt)\n`);

// What if we remove education entirely?
testResume.skills = resume.skills;
testResume.education = [];
const noEducation = estimateResumeHeight(testResume);
console.log(`After removing education: ${noEducation.toFixed(2)}pt (saves ${(baseHeight - noEducation).toFixed(2)}pt)`);

// With all 4 projects
testResume.projects = resume.projects;
console.log(`  With all 4 projects + no education: ${noEducation.toFixed(2)}pt`);
console.log(`  Fits? ${noEducation <= 736 ? "YES" : "NO"}`);

// What if we remove education details (keep degree but not GPA/graduation)?
testResume.education = resume.education.map(edu => ({
  ...edu,
  graduation_year: undefined,
  gpa: undefined,
}));
const noEducationDetails = estimateResumeHeight(testResume);
console.log(`\nAfter removing education details (keep degree): ${noEducationDetails.toFixed(2)}pt (saves ${(baseHeight - noEducationDetails).toFixed(2)}pt)`);
console.log(`  With all 4 projects: ${noEducationDetails.toFixed(2)}pt`);
console.log(`  Fits? ${noEducationDetails <= 736 ? "YES" : "NO"}`);

// What if we reduce skills more aggressively?
testResume.education = resume.education;
testResume.skills.languages = resume.skills.languages.slice(0, 3);
testResume.skills.frameworks_libraries = resume.skills.frameworks_libraries.slice(0, 3);
testResume.skills.tools = resume.skills.tools.slice(0, 3);
const aggressiveSkillCut = estimateResumeHeight(testResume);
console.log(`\nWith aggressive skill cuts (all →3): ${aggressiveSkillCut.toFixed(2)}pt (saves ${(baseHeight - aggressiveSkillCut).toFixed(2)}pt)`);
console.log(`  With all 4 projects: ${aggressiveSkillCut.toFixed(2)}pt`);
console.log(`  Fits? ${aggressiveSkillCut <= 736 ? "YES" : "NO"}`);

// What about reducing both?
testResume.education = resume.education.map(edu => ({
  ...edu,
  graduation_year: undefined,
  gpa: undefined,
}));
const combined = estimateResumeHeight(testResume);
console.log(`\nWith aggressive skills + no education details: ${combined.toFixed(2)}pt (saves ${(baseHeight - combined).toFixed(2)}pt)`);
console.log(`  Fits? ${combined <= 736 ? "YES" : "NO"}`);

console.log(`\n=== Summary ===`);
console.log(`Current: Removes 4th project to fit, uses ${(677.35 / 736 * 100).toFixed(1)}% of page`);
console.log(`Solution: Reduce education details saves ${(baseHeight - noEducationDetails).toFixed(2)}pt`);
console.log(`          Would allow all 4 projects with ${(736 - noEducationDetails).toFixed(2)}pt free`);
