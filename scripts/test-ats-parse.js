const fs = require('fs');
const PDFParser = require('pdf-parse/lib/pdf-parse.js');

async function checkATS() {
  try {
    console.log('📄 Testing ATS Compatibility...\n');
    
    const pdfPath = './resume_test.pdf';
    const pdfBuffer = fs.readFileSync(pdfPath);
    
    const data = await PDFParser(pdfBuffer);
    
    console.log(`✓ PDF parsed successfully!`);
    console.log(`✓ Pages: ${data.numpages}`);
    console.log(`✓ File size: ${(pdfBuffer.length / 1024).toFixed(2)} KB`);
    console.log(`\n--- ATS Text Extraction ---\n`);
    console.log(data.text);
    
    console.log('\n--- ATS Compatibility Checks ---\n');
    
    const text = data.text;
    const checks = [
      ['Contains name', text.includes('Precious')],
      ['Contains email', text.includes('preciousnyaupane3@gmail.com')],
      ['Contains phone', text.includes('602-459-5932')],
      ['Contains LinkedIn URL (plain text)', text.includes('linkedin.com')],
      ['Contains GitHub URL (plain text)', text.includes('github.com')],
      ['Contains job title', text.includes('POD Operator')],
      ['Contains company', text.includes('Dreamscape Learn')],
      ['Contains skills', text.includes('Python') && text.includes('React')],
      ['Contains education', text.includes('Computer Science')],
      ['Contains project name', text.includes('Rizz Chatbot')],
      ['No blue hyperlink artifacts', !text.match(/\[.*https?:\/\//gi)],
      ['Clean formatting', !text.match(/\x00/g)],
    ];
    
    const allPassed = checks.every(([_, result]) => result);
    
    checks.forEach(([name, passed]) => {
      const icon = passed ? '✓' : '✗';
      console.log(`${icon} ${name}`);
    });
    
    console.log(`\n${allPassed ? '✅ PASSED' : '⚠️  ISSUES'}: Resume is ${ allPassed ? 'ATS-compatible' : 'partially ATS-compatible'}`);
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkATS();
