const fs = require("fs");
const resume = JSON.parse(fs.readFileSync("data/resume.json", "utf8"));

(async () => {
  console.log("🧪 Testing PDF Export with Reduced Spacing\n");

  try {
    const response = await fetch("http://localhost:3000/api/export/pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(resume), // Send full resume object
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("❌ PDF export failed:", response.status);
      console.error(err.substring(0, 500));
      return;
    }

    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("pdf")) {
      console.error("❌ Response is not a PDF:", contentType);
      return;
    }

    const buffer = await response.arrayBuffer();
    fs.writeFileSync("/tmp/test-export-reduced-spacing.pdf", Buffer.from(buffer));

    console.log("✅ PDF generated successfully!");
    console.log(`Size: ${(buffer.byteLength / 1024).toFixed(1)} KB`);
    console.log("Saved to: /tmp/test-export-reduced-spacing.pdf");
    console.log("\nCheck if all 4 projects are now visible!");
  } catch (err) {
    console.error("❌ Error:", err);
  }
})();
