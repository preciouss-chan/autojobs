const fs = require('fs');

(async () => {
  try {
    const resume = JSON.parse(fs.readFileSync('data/resume.json', 'utf8'));

    const res = await fetch('http://localhost:3000/api/export/pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(resume),
    });

    if (!res.ok) {
      const txt = await res.text();
      console.error('Server returned error:', res.status, txt);
      process.exit(1);
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('pdf')) {
      const txt = await res.text();
      console.error('Response was not a PDF:', txt);
      process.exit(2);
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync('resume_test.pdf', buffer);
    console.log('Saved resume_test.pdf');
  } catch (err) {
    console.error('Test script failed:', err);
    process.exit(99);
  }
})();
