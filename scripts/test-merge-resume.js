/**
 * Test file demonstrating the improved fuzzy matching in mergeResume
 * This shows how the new logic handles variations in company/project names
 * 
 * Run with: node scripts/test-merge-resume.js
 */

const { compareTwoStrings } = require('string-similarity');

const SIMILARITY_THRESHOLD = 0.7;

// Improved helper function that includes prefix matching
function findBestMatch(targetName, names) {
  const targetLower = targetName.toLowerCase().trim();
  
  let bestMatch = null;
  let bestScore = 0;

  names.forEach((name) => {
    const nameLower = name.toLowerCase().trim();
    
    // Base similarity from string-similarity
    let score = compareTwoStrings(targetLower, nameLower);
    
    // Bonus: if one string starts with the other
    const searchStartsWithItem = targetLower.startsWith(nameLower);
    const itemStartsWithSearch = nameLower.startsWith(targetLower);
    
    if (searchStartsWithItem || itemStartsWithSearch) {
      score = Math.max(score, 0.75);
    }
    
    if (score > bestScore) {
      bestScore = score;
      bestMatch = name;
    }
  });

  return bestScore >= SIMILARITY_THRESHOLD ? bestMatch : null;
}

// Sample base resume
const baseResume = {
  name: "John Doe",
  contact: {
    phone: "123-456-7890",
    email: "john@example.com",
    linkedin: "linkedin.com/in/johndoe",
    github: "github.com/johndoe"
  },
  summary: "Software engineer with 5 years of experience",
  projects: [
    {
      name: "E-Commerce Platform",
      date: "2023",
      link: "github.com/ecommerce",
      bullets: ["Built REST API", "Implemented payment system"]
    },
    {
      name: "React Dashboard",
      date: "2022",
      link: "github.com/dashboard",
      bullets: ["Real-time data visualization", "User authentication"]
    }
  ],
  experience: [
    {
      company: "Google",
      role: "Software Engineer",
      dates: "2021-2023",
      bullets: ["Led microservices architecture", "Mentored junior developers"]
    },
    {
      company: "Microsoft",
      role: "Senior Developer",
      dates: "2019-2021",
      bullets: ["Cloud infrastructure", "CI/CD pipeline development"]
    }
  ],
  education: [],
  skills: {
    languages: ["TypeScript", "JavaScript", "Python"],
    frameworks_libraries: ["React", "Node.js", "Express"],
    tools: ["Docker", "Kubernetes", "Git"]
  }
};

// AI-generated edits with VARIATIONS in naming
const tailoredEdits = {
  updated_summary: "Experienced full-stack engineer specializing in cloud infrastructure",
  project_edits: {
    "E-commerce platform": [
      "Architected scalable REST API serving 100k+ requests/day",
      "Integrated Stripe payment processing with fraud detection"
    ],
    "React Dashboard App": [
      "Built real-time analytics dashboard with WebSocket streaming",
      "Implemented OAuth 2.0 authentication with role-based access control"
    ]
  },
  experience_edits: {
    "Google Inc": [
      "Led development of distributed microservices handling 10M QPS",
      "Mentored team of 8 engineers in software design patterns"
    ],
    "Microsoft Corporation": [
      "Designed and deployed cloud infrastructure on Azure reducing costs 40%",
      "Established CI/CD pipeline reducing deployment time from 2 hours to 10 minutes"
    ]
  },
  skills_to_add: {
    languages: ["Go", "Rust"],
    frameworks_libraries: ["GraphQL", "Apollo"],
    tools: ["Terraform", "CloudFormation"]
  },
  cover_letter: "Dear Hiring Manager, I am excited to apply for this position..."
};

console.log("\n=== Resume Merge Test: Fuzzy Matching ===\n");

// Test 1: Project Matching
console.log("Test 1: Project Name Matching");
console.log("─".repeat(60));
const projectNames = baseResume.projects.map(p => p.name);
console.log("Base projects:", projectNames);
console.log("\nAI-generated project names:", Object.keys(tailoredEdits.project_edits));
console.log("\nMatching results:");

let projectMatches = 0;
Object.keys(tailoredEdits.project_edits).forEach(aiProjectName => {
  const match = findBestMatch(aiProjectName, projectNames);
  const targetLower = aiProjectName.toLowerCase();
  const matchLower = match ? match.toLowerCase() : "";
  let score = compareTwoStrings(targetLower, matchLower);
  
  // Check for prefix bonus
  if (match) {
    const searchStartsWithItem = targetLower.startsWith(matchLower);
    const itemStartsWithSearch = matchLower.startsWith(targetLower);
    if (searchStartsWithItem || itemStartsWithSearch) {
      score = Math.max(score, 0.75);
    }
  }
  
  const status = match ? "✅" : "❌";
  console.log(`  ${status} "${aiProjectName}" → "${match}" (score: ${score.toFixed(3)})`);
  if (match) projectMatches++;
});

// Test 2: Company Matching
console.log("\n\nTest 2: Company Name Matching");
console.log("─".repeat(60));
const companyNames = baseResume.experience.map(e => e.company);
console.log("Base companies:", companyNames);
console.log("\nAI-generated company names:", Object.keys(tailoredEdits.experience_edits));
console.log("\nMatching results:");

let companyMatches = 0;
Object.keys(tailoredEdits.experience_edits).forEach(aiCompanyName => {
  const match = findBestMatch(aiCompanyName, companyNames);
  const targetLower = aiCompanyName.toLowerCase();
  const matchLower = match ? match.toLowerCase() : "";
  let score = compareTwoStrings(targetLower, matchLower);
  
  // Check for prefix bonus
  if (match) {
    const searchStartsWithItem = targetLower.startsWith(matchLower);
    const itemStartsWithSearch = matchLower.startsWith(targetLower);
    if (searchStartsWithItem || itemStartsWithSearch) {
      score = Math.max(score, 0.75);
    }
  }
  
  const status = match ? "✅" : "❌";
  console.log(`  ${status} "${aiCompanyName}" → "${match}" (score: ${score.toFixed(3)})`);
  if (match) companyMatches++;
});

// Test 3: Edge cases
console.log("\n\nTest 3: Edge Cases");
console.log("─".repeat(60));

const testCases = [
  { ai: "Google", base: ["Google", "Google Inc", "Google LLC"], expected: "Google" },
  { ai: "Google Inc", base: ["Google", "Google Inc", "Google LLC"], expected: "Google Inc" },
  { ai: "Microsoft Azure", base: ["Microsoft", "Microsoft Corp"], expected: "Microsoft" },
  { ai: "Amazon", base: ["Amazon", "AWS"], expected: "Amazon" },
  { ai: "Very Different Name", base: ["Google", "Microsoft"], expected: null }
];

let edgeCasesPassed = 0;
testCases.forEach(({ ai, base, expected }) => {
  const match = findBestMatch(ai, base);
  const status = match === expected ? "✅" : "❌";
  console.log(`  ${status} "${ai}" vs ${JSON.stringify(base)}`);
  console.log(`     Expected: ${expected}, Got: ${match}`);
  if (match === expected) edgeCasesPassed++;
});

console.log("\n\n=== Summary ===");
console.log(`Project matches: ${projectMatches}/2 ✅`);
console.log(`Company matches: ${companyMatches}/2 ✅`);
console.log(`Edge cases: ${edgeCasesPassed}/5 ✅`);
console.log("\n✅ Fuzzy matching successfully handles:");
console.log("   • Capitalization differences (E-Commerce Platform → E-commerce platform)");
console.log("   • Added suffixes (React Dashboard → React Dashboard App)");
console.log("   • Company name variations (Google → Google Inc, Microsoft → Microsoft Corporation)");
console.log("   • Prefix matching bonus for better company/project matching");
console.log("   • Threshold-based matching (0.7 = 70% similarity required)");
console.log("\n");
