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

console.log("=== Detailed Education Breakdown ===\n");

const edu = resume.education[0];
const degreeText = `${edu.degree ?? ""} — ${edu.institution ?? ""}`;
const degreeLines = doc.splitTextToSize(degreeText, contentWidth);

console.log(`Degree text: "${degreeText}"`);
console.log(`Degree lines: ${degreeLines.length}`);
degreeLines.forEach((line, idx) => {
  console.log(`  ${idx + 1}: "${line}"`);
});

const degreeHeight = degreeLines.length * lineHeightFor(10) + 6;
console.log(`Degree height: ${degreeLines.length} * ${lineHeightFor(10).toFixed(2)} + 6 = ${degreeHeight.toFixed(2)}pt\n`);

const detailsArr = [];
if (edu.graduation_year) {
  detailsArr.push(`Graduation: ${edu.graduation_year}`);
}
if (edu.gpa) {
  detailsArr.push(`GPA: ${edu.gpa}`);
}

console.log(`Details text: "${detailsArr.join(" • ")}"`);

if (detailsArr.length > 0) {
  const detailLines = doc.splitTextToSize(detailsArr.join(" • "), contentWidth);
  console.log(`Details lines: ${detailLines.length}`);
  detailLines.forEach((line, idx) => {
    console.log(`  ${idx + 1}: "${line}"`);
  });
  const detailsHeight = detailLines.length * lineHeightFor(9) + 8;
  console.log(`Details height: ${detailLines.length} * ${lineHeightFor(9).toFixed(2)} + 8 = ${detailsHeight.toFixed(2)}pt`);
}

console.log(`\n=== Full Education Entry Breakdown ===`);
console.log(`Header: 28pt`);
console.log(`Degree: ${degreeHeight.toFixed(2)}pt`);
if (detailsArr.length > 0) {
  const detailLines = doc.splitTextToSize(detailsArr.join(" • "), contentWidth);
  const detailsHeight = detailLines.length * lineHeightFor(9) + 8;
  console.log(`Details: ${detailsHeight.toFixed(2)}pt`);
  console.log(`Total education: ${(28 + degreeHeight + detailsHeight).toFixed(2)}pt`);
}

// Now check if maybe the issue is that education details aren't wrapping properly
console.log(`\n=== Skills Size Check ===`);

const skillsArr = [];
if (resume.skills.languages?.length) {
  skillsArr.push(`Languages: ${resume.skills.languages.join(", ")}`);
}
if (resume.skills.frameworks_libraries?.length) {
  skillsArr.push(`Frameworks: ${resume.skills.frameworks_libraries.join(", ")}`);
}
if (resume.skills.tools?.length) {
  skillsArr.push(`Tools: ${resume.skills.tools.join(", ")}`);
}

console.log(`Languages line: "${skillsArr[0]}"`);
const langLines = doc.splitTextToSize(skillsArr[0], contentWidth);
console.log(`  Wraps to: ${langLines.length} lines`);
langLines.forEach((line, idx) => {
  console.log(`    ${idx + 1}: "${line}"`);
});

console.log(`\nFrameworks line: "${skillsArr[1]}"`);
const frameworkLines = doc.splitTextToSize(skillsArr[1], contentWidth);
console.log(`  Wraps to: ${frameworkLines.length} lines`);
frameworkLines.forEach((line, idx) => {
  console.log(`    ${idx + 1}: "${line}"`);
});

console.log(`\nTools line: "${skillsArr[2]}"`);
const toolsLines = doc.splitTextToSize(skillsArr[2], contentWidth);
console.log(`  Wraps to: ${toolsLines.length} lines`);
toolsLines.forEach((line, idx) => {
  console.log(`    ${idx + 1}: "${line}"`);
});

console.log(`\n=== Summary of All Skills ===`);
let skillsHeight = 28;
skillsArr.forEach((skillLine, idx) => {
  const lines = doc.splitTextToSize(skillLine, contentWidth);
  const height = lines.length * lineHeightFor(10) + 4;
  skillsHeight += height;
  console.log(`Skill ${idx + 1} (${lines.length} lines): ${height.toFixed(2)}pt`);
});
console.log(`Total skills height: ${skillsHeight.toFixed(2)}pt`);
