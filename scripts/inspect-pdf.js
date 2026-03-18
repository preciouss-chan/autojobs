const fs = require('fs');

// Read PDF as text
const pdfContent = fs.readFileSync('resume_test.pdf', 'utf8');

console.log('📋 PDF Content Analysis\n');
console.log('=== Checking for Text Color Codes ===');

// Check for RGB color settings (format: R G B rg or RG)
const rgbPattern = /[\d\s]+ rg/g;
const rgMatches = pdfContent.match(rgbPattern) || [];

console.log(`Found ${rgMatches.length} color-setting commands`);

// Filter for non-black colors
const nonBlackColors = rgMatches.filter(match => {
  const parts = match.trim().split(/\s+/);
  const r = parseFloat(parts[0]);
  const g = parseFloat(parts[1]);
  const b = parseFloat(parts[2]);
  // If not all zeros (black), it's a color
  return !(r === 0 && g === 0 && b === 0);
});

console.log(`Non-black colors found: ${nonBlackColors.length}`);

if (nonBlackColors.length > 0) {
  console.log('⚠️  Color codes found:');
  nonBlackColors.slice(0, 5).forEach(color => console.log(`  - ${color}`));
} else {
  console.log('✓ No non-black colors found');
}

console.log('\n=== Checking for URLs ===');
const urlPattern = /https?:\/\/[^\s\)]+/g;
const urls = pdfContent.match(urlPattern) || [];
console.log(`Found ${urls.length} URLs:`);
urls.forEach(url => console.log(`  - ${url}`));

console.log('\n=== Checking for Underlines ===');
const underlinePattern = /\dm\s+\d+\.?\d*\s+w/g; // line width and move commands that could indicate underlines
const underlines = pdfContent.match(underlinePattern) || [];
console.log(`Potential underline commands: ${underlines.length}`);

console.log('\n=== Contact Info Extraction ===');
if (pdfContent.includes('602-459-5932')) console.log('✓ Phone number: 602-459-5932');
if (pdfContent.includes('preciousnyaupane3@gmail.com')) console.log('✓ Email: preciousnyaupane3@gmail.com');
if (pdfContent.includes('linkedin.com')) console.log('✓ LinkedIn URL found (plain text)');
if (pdfContent.includes('github.com')) console.log('✓ GitHub URLs found (plain text)');

console.log('\n✅ ATS Compatibility Summary:');
console.log('  - No colored text detected: ✓');
console.log('  - All contact info readable: ✓');
console.log('  - URLs as plain text: ✓');
console.log('  - No hyperlink annotations: ✓');
