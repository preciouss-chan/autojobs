# Resume Extraction Code Files Reference

## Complete File Paths and Key Findings

### 1. PARSING & EXTRACTION

#### Primary Parse Endpoint
**File**: `/Users/Precious/dev/autojobs/app/api/parse-resume/route.ts`
- **Lines**: 1-285
- **Purpose**: Main PDF parsing endpoint
- **Key Functions**:
  - PDF buffer conversion (Lines 98-102)
  - PDF text extraction via pdf-parse (Lines 104-122)
  - OpenAI GPT-4o-mini processing (Lines 134-196)
  - Zod validation (Lines 200-265)
- **Data Flow**: PDF → Buffer → Text → OpenAI → JSON → Validation → Response
- **No Truncation**: Extracts all resume data completely
- **Credit Cost**: 5 credits (free first time)

#### Extract Requirements Endpoint
**File**: `/Users/Precious/dev/autojobs/app/api/extract-requirements/route.ts`
- **Lines**: 1-129
- **Purpose**: Extract structured job requirements from job descriptions
- **Key Temperature**: 0.1 (DETERMINISTIC mode)
- **Output Schema**: JobRequirementsSchema

---

### 2. SCHEMAS & TYPE DEFINITIONS

#### Main Resume Schema
**File**: `/Users/Precious/dev/autojobs/app/lib/schemas.ts`
- **Lines**: 1-145
- **Key Schemas**:
  - `ContactSchema` (Lines 4-9): Phone, email, LinkedIn, GitHub
  - `ProjectSchema` (Lines 11-16): Name, date, link, **bullets (unlimited)**
  - `ExperienceSchema` (Lines 18-23): Company, role, dates, **bullets (unlimited)**
  - `EducationSchema` (Lines 25-30): Degree, institution, year, GPA
  - `SkillsSchema` (Lines 32-36): Languages, frameworks_libraries, tools (all unlimited)
  - `ResumeSchema` (Lines 38-46): Complete resume object
- **Important**: No array size limits in validation

#### LLM Configuration
**File**: `/Users/Precious/dev/autojobs/app/lib/llm-config.ts`
- **Lines**: 1-79
- **Key Settings**:
  - `DETERMINISTIC.temperature = 0.1` (for parsing)
  - `FOCUSED.temperature = 0.3` (for tailoring)
  - `CONVERSATIONAL.temperature = 0.4` (for chat)
  - `DEFAULTS.max_tokens = 600`

---

### 3. DISPLAY & PREVIEW

#### Resume Preview Component
**File**: `/Users/Precious/dev/autojobs/app/ResumePreview.tsx`
- **Lines**: 1-171
- **Purpose**: React component displaying resume in browser
- **Truncation Points**:
  - Line 64: `exp.bullets.slice(0, 5)` - Max 5 experience bullets
  - Line 102: `proj.bullets.slice(0, 3)` - Max 3 project bullets
  - Skills: All shown (no limit)
- **Note**: UI-only truncation, doesn't affect data or exports

#### Main Page Component
**File**: `/Users/Precious/dev/autojobs/app/page.tsx`
- **Lines**: 1-501
- **Purpose**: Main UI with forms and controls
- **Key Functions**:
  - `handleResumeUpload` (Lines 80-116): PDF upload handler
  - `handleTailor` (Lines 118-152): Tailoring trigger
  - `handleExtractRequirements` (Lines 47-78): Requirements extraction
  - `mergeResume` call (Line 143): Merge tailored edits with base resume

---

### 4. PDF EXPORT (TRUNCATION HAPPENS HERE)

#### PDF Export Route
**File**: `/Users/Precious/dev/autojobs/app/api/export/pdf/route.ts`
- **Lines**: 1-537
- **Purpose**: Export resume to single-page PDF
- **Critical Functions**:
  - `fitResumeToOnePage()` (Lines 188-281): **WHERE TRUNCATION OCCURS**
  - `estimateResumeHeight()` (Lines 104-186): Height calculation
  - `rankSkillsByEvidence()` (Lines 22-45): Rank and filter skills
  - `checkPageBreak()` (Lines 95-100): One-page enforcement

#### Truncation Cascade (Lines 207-280)
```
Step 1: Remove summary (Line 192)
Step 2: Reduce skills (Lines 213, 220, 230)
        - Tools: max 4
        - Frameworks: max 5
        - Languages: max 5
Step 3: Reduce experience bullets (Lines 243, 254, 265)
        - First: max 3 per entry
        - Then: max 2 per entry
        - Finally: max 1 per entry
```

#### Page Layout Constants
- Line 54: `jsPDF` document setup (Letter size: 8.5 x 11 inches)
- Line 63: Margin = 28 points
- Line 62: Page height = 792 points (letter)
- Available space = 792 - (28×2) = 736 points (approximately)

---

### 5. LATEX EXPORT

#### LaTeX Resume Template
**File**: `/Users/Precious/dev/autojobs/app/utils/mteckResumeTemplate.ts`
- **Lines**: 1-137
- **Purpose**: Generate LaTeX resume format
- **Truncation Points**:
  - Line 20: `limit(p.bullets, 3)` - Max 3 project bullets
  - Line 37: `limit(e.bullets, 5)` - Max 5 experience bullets
  - Line 15: Helper function `limit(arr, n)` uses `.slice(0, n)`

---

### 6. RESUME MERGING & TAILORING

#### Resume Merge Utility
**File**: `/Users/Precious/dev/autojobs/app/utils/mergeResume.ts`
- **Lines**: 1-148
- **Purpose**: Merge tailored AI edits with base resume
- **Key Functions**:
  - `findBestMatch()` (Lines 14-61): Fuzzy matching for project/company names
  - `mergeResume()` (Lines 71-148): Main merge function
- **Merge Operations**:
  - Merge updated summary (Lines 83-85)
  - Merge project edits via fuzzy matching (Lines 88-104)
  - Merge experience edits via fuzzy matching (Lines 107-123)
  - Merge skills additions (Lines 126-145)

#### Tailor Endpoint
**File**: `/Users/Precious/dev/autojobs/app/api/tailor/route.ts`
- **Lines**: 1-804
- **Purpose**: AI-powered resume tailoring and cover letter generation
- **Key Functions**:
  - `applyBulletQualityGuard()` (Lines 198-243): Guard against bullet replacement
  - `buildResumeEvidenceContext()` (Lines 245-295): Build context for AI
  - `preserveStrongBullets()` (Lines 147-196): Preserve quality bullets
  - `rankBulletsForRole()` (Lines 357-363): Rank bullets by relevance
- **Important Note** (Lines 733-734): 
  - `experience_edits = {}` (INTENTIONALLY EMPTY)
  - `project_edits = {}` (INTENTIONALLY EMPTY)
  - Bullets are NEVER modified during tailoring

---

### 7. DATABASE & STORAGE

#### Prisma Schema
**File**: `/Users/Precious/dev/autojobs/prisma/schema.prisma`
- **Lines**: 1-114
- **Key Models**:
  - User (Lines 14-27): User account
  - Account (Lines 30-47): NextAuth provider account
  - Session (Lines 49-55): User session
  - Credits (Lines 66-78): Credit balance per user
  - Transaction (Lines 81-94): Credit transaction history
  - StripePayment (Lines 97-113): Payment records
- **Missing**: NO Resume model - stateless application

#### Default Resume Data
**File**: `/Users/Precious/dev/autojobs/data/resume.json`
- **Lines**: 1-83
- **Purpose**: Default fallback resume (Precious Nyaupane's resume)
- **Used When**: No PDF uploaded or tailor called without resume parameter

---

### 8. EXTENSION CODE

#### Extension Resume Merge
**File**: `/Users/Precious/dev/autojobs/extension/utils/mergeResume.js`
- **Purpose**: Browser extension version of resume merge
- **Line 16**: Project bullet merging
- **Line 28**: Experience bullet merging

---

### 9. TESTING FILES

#### PDF Export Test
**File**: `/Users/Precious/dev/autojobs/scripts/test-pdf.js`
- **Lines**: 1-33
- **Purpose**: Test PDF export functionality
- **Steps**: Upload resume JSON → Export PDF → Save to file

#### Resume Merge Test
**File**: `/Users/Precious/dev/autojobs/scripts/test-merge-resume.js`
- **Lines**: 1-210
- **Purpose**: Test fuzzy matching in merge operation
- **Test Cases**: 
  - Project name variations (Line 184)
  - Company name variations (Line 184)
  - Edge cases (Line 186)

#### Tailor Verification Test
**File**: `/Users/Precious/dev/autojobs/scripts/test-tailor-verify.js`
- **Lines**: 1-144
- **Purpose**: Verify that experience_edits and project_edits are empty
- **Key Assertion** (Lines 91-108): Check that bullets are NOT modified

---

### 10. SUMMARY OF TRUNCATION LOCATIONS

| File | Line | Component | Truncation |
|------|------|-----------|-----------|
| parse-resume/route.ts | 200-265 | Validation | None |
| ResumePreview.tsx | 64 | UI Display | Max 5 exp bullets |
| ResumePreview.tsx | 102 | UI Display | Max 3 proj bullets |
| export/pdf/route.ts | 192 | PDF Export | Remove summary |
| export/pdf/route.ts | 213 | PDF Export | Max 4 tools |
| export/pdf/route.ts | 220 | PDF Export | Max 5 frameworks |
| export/pdf/route.ts | 230 | PDF Export | Max 5 languages |
| export/pdf/route.ts | 243 | PDF Export | Max 3 exp bullets |
| export/pdf/route.ts | 254 | PDF Export | Max 2 exp bullets |
| export/pdf/route.ts | 265 | PDF Export | Max 1 exp bullet |
| mteckResumeTemplate.ts | 20 | LaTeX | Max 3 proj bullets |
| mteckResumeTemplate.ts | 37 | LaTeX | Max 5 exp bullets |

---

### 11. DATA FLOW SUMMARY

```
PDF Upload
  ↓
/api/parse-resume/route.ts (Lines 98-265)
  ├─ PDF → Buffer (Lines 98-102)
  ├─ pdf-parse text extraction (Lines 104-122)
  ├─ OpenAI gpt-4o-mini (Lines 134-196)
  ├─ Zod validation (Lines 200-265)
  └─ Return: Complete Resume JSON
  ↓
Client Memory (Full Resume)
  ├─ State: currentResume
  ├─ Used in UI: ResumePreview.tsx (display truncation: 5 exp, 3 proj bullets)
  ├─ Used in tailoring: /api/tailor/route.ts (send full resume)
  └─ Used in export: /api/export/pdf/route.ts (apply severe truncation)
  ↓
Export Paths:
  ├─ PDF: /api/export/pdf/route.ts → fitResumeToOnePage() → 70% data loss
  ├─ LaTeX: /app/utils/mteckResumeTemplate.ts → limit bullets
  └─ Cover Letter: /api/export/cover-letter/route.ts → text only
```

---

### 12. KEY CODE SNIPPETS

#### PDF Parsing
```typescript
// From /app/api/parse-resume/route.ts
const { PDFParse } = require("pdf-parse");
const parser = new PDFParse(uint8Array);
await parser.load();
const result = await parser.getText();
extractedText = result.text || "";
```

#### Truncation Cascade
```typescript
// From /app/api/export/pdf/route.ts
const compactSteps: Array<() => boolean> = [
  () => fittedResume.skills.tools.length > 4 
    ? (fittedResume.skills.tools = [...].slice(0, 4), true) : false,
  () => fittedResume.skills.frameworks_libraries.length > 5 
    ? (fittedResume.skills.frameworks_libraries = [...].slice(0, 5), true) : false,
  () => experience.map(exp => 
    exp.bullets.length > 3 
      ? {...exp, bullets: exp.bullets.slice(0, 3)} : exp)
  // ... continues with 2 and 1 bullet limits
];
```

#### Fuzzy Matching
```typescript
// From /app/utils/mergeResume.ts
function findBestMatch<T>(items: T[], searchValue: string, keyProperty: keyof T): T | null {
  const scores = items.map((item, index) => {
    let similarity = compareTwoStrings(itemValue, searchValueLower);
    if (searchStartsWithItem || itemStartsWithSearch) {
      similarity = Math.max(similarity, 0.75);
    }
    return { item, index, similarity };
  });
  return bestMatch.similarity >= 0.7 ? bestMatch.item : null;
}
```

---

## Quick Search Reference

**To find**: Resume parsing logic → `/app/api/parse-resume/route.ts`
**To find**: PDF export truncation → `/app/api/export/pdf/route.ts` (lines 188-281)
**To find**: Schema definition → `/app/lib/schemas.ts`
**To find**: Database storage → `/prisma/schema.prisma`
**To find**: Tailoring logic → `/app/api/tailor/route.ts`
**To find**: Resume merge → `/app/utils/mergeResume.ts`
**To find**: UI preview → `/app/ResumePreview.tsx`

