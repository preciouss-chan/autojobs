const fs = require("fs");
const resume = JSON.parse(fs.readFileSync("data/resume.json", "utf8"));

(async () => {
  console.log("🧪 Testing Height Estimation\n");

  try {
    const response = await fetch("http://localhost:3000/api/export/pdf", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "X-Debug": "true" // This won't do anything, just for clarity
      },
      body: JSON.stringify(resume),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("❌ PDF export failed:", response.status);
      console.error(err);
      return;
    }

    const buffer = await response.arrayBuffer();
    const pdfPath = "/tmp/test-height-est.pdf";
    fs.writeFileSync(pdfPath, Buffer.from(buffer));

    console.log("✅ PDF generated successfully!");
    console.log(`Size: ${(buffer.byteLength / 1024).toFixed(1)} KB`);
    console.log(`Saved to: ${pdfPath}\n`);

    // Try to verify content with strings
    const pdfBuffer = Buffer.from(buffer);
    const pdfString = pdfBuffer.toString('binary');
    
    console.log("🔍 Checking PDF for projects:");
    const projects = ['AI Task Manager', 'Weather Dashboard', 'Todo App', 'Chat Application'];
    projects.forEach(proj => {
      if (pdfString.includes(proj)) {
        console.log(`✅ ${proj}`);
      } else {
        console.log(`❌ ${proj}`);
      }
    });
  } catch (err) {
    console.error("❌ Error:", err);
  }
})();
