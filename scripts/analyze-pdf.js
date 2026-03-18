const fs = require("fs");
const { PDFParse } = require("pdf-parse");

(async () => {
  try {
    const pdfPath = "/tmp/test-export.pdf";
    const pdfData = fs.readFileSync(pdfPath);

    const data = await new PDFParse(pdfData);

    console.log("=== PDF Content Analysis ===\n");
    console.log(`Total pages: ${data.numpages}`);
    console.log(`Text length: ${data.text.length} characters\n`);

    const text = data.text;

    // Count projects mentioned
    const projectNames = ["Rizz Chatbot", "Flappy Bird", "Automated Budget", "Apply Boost"];
    projectNames.forEach((name) => {
      const found = text.includes(name) ? "✓" : "✗";
      console.log(`${found} ${name}`);
    });

    console.log("\n=== Bullet Point Verification ===\n");

    // Check for specific bullets from each project
    const checks = [
      {
        project: "Rizz Chatbot",
        bullets: [
          "Fine-tuned a GPT-3.5 model",
          "Designed and built a lightweight",
          "Evolved from a playful side project",
        ],
      },
      {
        project: "Flappy Bird",
        bullets: [
          "Developed a Unity game",
          "Implemented progression-based",
          "Abilities can be used",
        ],
      },
      {
        project: "Automated Budget App",
        bullets: [
          "Automated budgeting app",
          "monthly spending summaries",
          "AI-powered categorization",
        ],
      },
      {
        project: "Apply Boost",
        bullets: [
          "Co-developed Apply-Boost",
          'Simplifying Recruiting and Hiring"',
          "seamless backend",
        ],
      },
    ];

    checks.forEach(({ project, bullets }) => {
      console.log(`${project}:`);
      bullets.forEach((bullet) => {
        const found = text.includes(bullet) ? "✓" : "✗";
        console.log(`  ${found} ${bullet}`);
      });
      console.log("");
    });

    console.log("=== Section Headings ===\n");
    const sections = ["EXPERIENCE", "PROJECTS", "SKILLS", "EDUCATION"];
    sections.forEach((section) => {
      const found = text.includes(section) ? "✓" : "✗";
      console.log(`${found} ${section}`);
    });

    console.log("\n=== Number of Projects in PDF ===\n");
    const projectCount = (
      text.match(/Rizz Chatbot|Flappy Bird|Automated Budget|Apply Boost/g) || []
    ).length;
    console.log(`Projects found: ${projectCount}`);

    // Extract a preview
    console.log("\n=== Text Preview (first 1000 chars) ===\n");
    console.log(text.substring(0, 1000));
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
})();
