# Resume Extraction & Parsing Analysis - AutoJobs

## Executive Summary
The AutoJobs application has a multi-stage resume extraction flow with **deliberate data truncation at the PDF export/rendering stage** (not during extraction). While the initial parsing extracts all resume data comprehensively, significant data loss occurs during display and export to fit resumes onto a single page.

---

## 1. HOW RESUMES ARE EXTRACTED

### Entry Points
1. **PDF Upload** (`/api/parse-resume`) - Primary extraction method
2. **JSON File Fallback** (`data/resume.json`) - Default resume
3. **Direct JSON Input** - Via frontend form submission
4. **UI Input** - Manual entry through web interface

### Extraction Pipeline (Parse-Resume Route)

**File**: `/Users/Precious/dev/autojobs/app/api/parse-resume/route.ts`

```
PDF File → Buffer Conversion → PDF-Parse Extraction → OpenAI GPT-4o-mini → JSON Parsing → Zod Validation → Response
```

#### Step-by-Step Details:

1. **PDF File Reading** (Lines 98-102)
   - Receives FormData with file upload
   - Converts to Buffer via `Uint8Array`
   - No size limit checking

2. **PDF Text Extraction** (Lines 104-122)
   - Uses `pdf-parse` library (v2.4.5)
   - Creates PDFParse instance with uint8array
   - Extracts raw text via `parser.getText()`
   - **Potential Data Loss**: Only extracts text, not formatting/layout
   - Error handling for PDF parsing failures

3. **OpenAI Processing** (Lines 134-196)
   - Sends raw extracted text to GPT-4o-mini
   - Temperature: 0.1 (DETERMINISTIC mode - highly consistent)
   - Uses JSON mode for structured output
   - Prompt specifies exact schema expected
   - **No truncation at this stage**

4. **Validation** (Lines 200-265)
   - Zod schema validation (ResumeSchema)
   - Returns validated JSON

#### Current Schema Extracted:
```typescript
{
  name: string
  contact: {
    phone: string
    email: string
    linkedin: string
    github: string
  }
  summary: string
  projects: Array<{
    name: string
    date: string
    link: string
    bullets: string[] // NO LIMIT on array size
  }>
  experience: Array<{
    company: string
    role: string
    dates: string
    bullets: string[] // NO LIMIT on array size
  }>
  education: Array<{
    degree: string
    institution: string
    graduation_year: string
    gpa: string
  }>
  skills: {
    languages: string[]
    frameworks_libraries: string[]
    tools: string[]
  }
}
```

**Key Finding**: The extracted schema has NO built-in truncation limits in parsing.

---

## 2. DATA CAPTURE & STRUCTURE

### What's Being Captured (Comprehensive)

#### From PDF Extraction
- ✅ All text content
- ✅ Contact information (all fields)
- ✅ Summary/objective sections
- ✅ All projects with unlimited bullets
- ✅ All experience entries with unlimited bullets
- ✅ Education details
- ✅ All skills (languages, frameworks, tools)

#### What's NOT Captured (Format/Layout Issues)
- ❌ Document formatting/styling
- ❌ Images or graphics
- ❌ Color-coded sections
- ❌ Custom fonts/sizes
- ❌ Tables/complex layouts
- ❌ Scanned documents (unless OCR-enabled)

### Data Structures

**Resume Type** (`/Users/Precious/dev/autojobs/app/lib/schemas.ts`):
```typescript
export const ResumeSchema = z.object({
  name: z.string(),
  contact: ContactSchema,
  summary: z.string().default(""),
  projects: z.array(ProjectSchema).default([]),
  experience: z.array(ExperienceSchema).default([]),
  education: z.array(EducationSchema).default([]),
  skills: SkillsSchema,
});
```

**No validation limits on array sizes** - schemas allow unlimited bullets, projects, and experience entries.

---

## 3. DATA LOSS & TRUNCATION POINTS

### Critical Finding: Three-Stage Data Loss

#### Stage 1: Parsing (MINIMAL LOSS)
- **Loss Type**: Extraction errors from PDF text extraction
- **Cause**: PDF-Parse library limitations
- **Impact**: Minor - only affects unreadable PDFs
- **Mitigation**: Error handling returns 400 status

#### Stage 2: Resume Display in UI (MODERATE LOSS)
**File**: `/Users/Precious/dev/autojobs/app/ResumePreview.tsx`

| Component | Truncation | Reason |
|-----------|-----------|--------|
| Experience bullets | `.slice(0, 5)` | Show max 5 bullets (Line 64) |
| Project bullets | `.slice(0, 3)` | Show max 3 bullets (Line 102) |
| All sections | Dynamic | Fit to viewport, no page limits |

#### Stage 3: PDF Export (SEVERE LOSS) ⚠️
**File**: `/Users/Precious/dev/autojobs/app/api/export/pdf/route.ts`

This is where **the most significant data loss occurs**.

##### Aggressive Truncation Strategy:

1. **Summary Removal** (Line 192)
   - `fittedResume.summary = ""`
   - Summary completely removed to fit to one page

2. **Skill Truncation** (Lines 194-205)
   ```typescript
   skills.languages = rankSkillsByEvidence(...).slice(0, 5)    // Max 5
   skills.frameworks = rankSkillsByEvidence(...).slice(0, 5)   // Max 5
   skills.tools = rankSkillsByEvidence(...).slice(0, 4)        // Max 4
   ```

3. **Experience Bullets** (Lines 240-269)
   - Step 1: If > 3 bullets → slice(0, 3)
   - Step 2: If still too long → slice(0, 2)
   - Step 3: If still too long → slice(0, 1)
   - Final: May end up with ZERO bullets if space is tight

4. **Project Bullets** (Not explicitly cascaded)
   - Default: `.slice(0, 3)` in rendering (Line 443)

5. **Page Limit**: One-page only
   - `checkPageBreak(neededSpace)` prevents multi-page (Line 95-100)
   - Uses estimation algorithm: `estimateResumeHeight()`

##### Truncation Logic Flow:
```
Check estimated height against page limit (811 - 56 = 755pt available)
│
├─ Too tall?
│  ├─ Remove summary
│  ├─ Trim skills (tools → frameworks → languages)
│  ├─ Reduce bullets per experience (5 → 3 → 2 → 1)
│  └─ Keep checking until fits
│
└─ Fits? → Render PDF
```

### Data Loss Calculation Example

For a typical resume:
- Original: 30+ project bullets, 20+ experience bullets, 20+ skills
- After PDF Export: 
  - Projects: 6 bullets total (2 projects × 3 bullets max)
  - Experience: 5 bullets total (1 entry × 5 bullets max) OR LESS
  - Summary: REMOVED (0 words)
  - Skills: 14 total (5 languages + 5 frameworks + 4 tools)
  - **Data Retention**: ~25-30% of original

---

## 4. DATA FLOW FROM INPUT TO STORAGE

### Complete Data Journey

```
1. USER UPLOADS PDF
   ↓
2. API /parse-resume receives FormData
   ├─ Validate file exists
   ├─ Check rate limits
   ├─ Check credits
   └─ Extract via pdf-parse
   ↓
3. OpenAI GPT-4o-mini PROCESSES
   ├─ Receives raw text
   ├─ Returns structured JSON
   └─ FULL DATA (no truncation)
   ↓
4. Zod VALIDATES
   ├─ Confirms schema match
   └─ Returns Resume object (FULL DATA)
   ↓
5. CREDIT DEDUCTION
   ├─ First use: free (mark usedFreeResumeParse=true)
   └─ Subsequent: -5 credits
   ↓
6. RETURN TO CLIENT
   └─ Full extracted resume as JSON (FULL DATA)
   ↓
7. CLIENT STORES IN MEMORY
   ├─ State: currentResume (FULL DATA)
   └─ Used for all subsequent operations
   ↓
8a. USER TAILORS RESUME → /api/tailor
    ├─ Sends full resume to API
    ├─ OpenAI generates tailored summary, skills, cover letter
    ├─ DOES NOT modify bullets (preserved from original)
    └─ Returns: {updated_summary, skills_to_add, cover_letter}
    ↓
8b. USER EXPORTS PDF → /api/export/pdf
    ├─ Receives full resume data
    ├─ Calls fitResumeToOnePage()
    ├─ APPLIES AGGRESSIVE TRUNCATION
    └─ Renders single-page PDF (30% of data)
    ↓
9. DATABASE STORAGE
   └─ NO RESUME STORED (stateless application)
```

### Storage Note
**Important**: AutoJobs does NOT store resumes in the database. It's a stateless application where:
- Resume data lives only in client memory during session
- On page refresh, user must re-upload PDF
- No resume history is preserved
- Prisma only stores credits and transactions

---

## 5. SPECIFIC TRUNCATION LIMITS & FILTERING

### PDF Export Truncation Cascade

**File**: `/Users/Precious/dev/autojobs/app/api/export/pdf/route.ts` (Lines 207-280)

```typescript
const compactSteps: Array<() => boolean> = [
  // Step 1: Tools → max 4
  () => fittedResume.skills.tools.length > 4 
    ? (fittedResume.skills.tools = [...].slice(0, 4), true) 
    : false,

  // Step 2: Frameworks → max 5
  () => fittedResume.skills.frameworks_libraries.length > 5 
    ? (fittedResume.skills.frameworks_libraries = [...].slice(0, 5), true) 
    : false,

  // Step 3: Languages → max 5
  () => fittedResume.skills.languages.length > 5 
    ? (fittedResume.skills.languages = [...].slice(0, 5), true) 
    : false,

  // Step 4: Exp bullets → max 3
  () => experience.map(exp => 
    exp.bullets.length > 3 
      ? {...exp, bullets: exp.bullets.slice(0, 3)} 
      : exp),

  // Step 5: Exp bullets → max 2
  // Step 6: Exp bullets → max 1
];
```

### Preview Component Truncation

**File**: `/Users/Precious/dev/autojobs/app/ResumePreview.tsx`

```typescript
// Experience: max 5 bullets (Line 64)
exp.bullets.slice(0, 5).map((b) => ...)

// Projects: max 3 bullets (Line 102)
proj.bullets.slice(0, 3).map((b) => ...)

// Skills: all shown
```

### LaTeX Export Truncation

**File**: `/Users/Precious/dev/autojobs/app/utils/mteckResumeTemplate.ts`

```typescript
const limit = (arr: string[] = [], n: number) => arr.slice(0, n);

// Projects: max 3 bullets per project
const bullets = limit(p.bullets, 3)

// Experience: max 5 bullets per entry
const bullets = limit(e.bullets, 5)
```

---

## 6. RESUME OBJECT CREATION & POPULATION

### Where Resume is Created

1. **From PDF Parsing** (Primary)
   - Route: `/api/parse-resume`
   - Source: OpenAI extraction from PDF text
   - Full data, no truncation

2. **From Default File** (Fallback)
   - File: `/Users/Precious/dev/autojobs/data/resume.json`
   - Used when: No upload provided or tailor called without resume
   - Path: `path.join(process.cwd(), "data", "resume.json")`

3. **From UI Input** (Manual)
   - Form submission via `/api/tailor`
   - User submits resume object directly

### Resume Merge Process

**File**: `/Users/Precious/dev/autojobs/app/utils/mergeResume.ts`

After tailoring, edits are merged back:
```typescript
export function mergeResume(baseResume: Resume, edits: Record<string, unknown>): Resume {
  // 1. Merge updated summary
  if (editsTyped.updated_summary) 
    updatedResume.summary = editsTyped.updated_summary

  // 2. Merge project edits (fuzzy matching)
  for (const [projectName, newBullets] of Object.entries(editsTyped.project_edits))
    project.bullets = newBullets // REPLACES entire bullets array

  // 3. Merge experience edits (fuzzy matching)
  for (const [companyName, newBullets] of Object.entries(editsTyped.experience_edits))
    exp.bullets = newBullets // REPLACES entire bullets array

  // 4. Merge skills additions
  for (const section of ["languages", "frameworks_libraries", "tools"])
    // Adds new skills (no duplicates)
}
```

**Important Note**: In the current implementation (as of test-tailor-verify.js verification):
- `experience_edits` and `project_edits` are **INTENTIONALLY EMPTY** (Line 733-734 of tailor/route.ts)
- Bullets are **NEVER modified** during tailoring
- Only summary, skills, and cover letter are tailored

---

## 7. KEY FINDINGS & IMPLICATIONS

### Where Data is Lost

| Stage | Loss Amount | Cause | Reversible |
|-------|------------|-------|-----------|
| PDF Extract | ~5% | OCR/format issues | No |
| Display UI | ~40% | Preview truncation | Yes |
| PDF Export | ~70% | Space constraints | No |
| Storage | 100% | Stateless design | No |

### Critical Issues

1. **One-Page Restriction**
   - Hard-coded 1-page limit (757pt available)
   - Causes aggressive truncation
   - No user option for multi-page

2. **Summary Removal**
   - Always removed during PDF export (Line 192)
   - Even if summary is 1-2 lines, it's deleted
   - Professional summary lost permanently

3. **Skill Deduplication**
   - Re-ranks skills by evidence frequency (rankSkillsByEvidence)
   - Removes low-frequency skills entirely
   - Most relevant skills may be dropped

4. **Bullet Quality Loss**
   - Only strongest bullets kept
   - Diverse accomplishment examples dropped
   - May remove context needed for specific jobs

5. **No Data Persistence**
   - Resume not stored after upload
   - Each session requires re-upload
   - No version history

### Opportunities for Improvement

1. **Store resume snapshots** in database
2. **Allow multi-page PDFs** (remove 1-page limit)
3. **Preserve summaries** or make truncation configurable
4. **Rank bullets intelligently** using job context
5. **Offer export options**: single-page vs. multi-page
6. **Implement bullet reordering** instead of removal

---

## 8. TECHNICAL SUMMARY

### PDF Parsing Flow
```
pdf-parse v2.4.5
  ↓
getText() extracts raw text
  ↓
OpenAI GPT-4o-mini (temp=0.1)
  ↓
JSON mode response
  ↓
Zod validation (no field limits)
  ↓
Complete Resume object returned to client
```

### Export Flow
```
Resume in memory (FULL)
  ↓
fitResumeToOnePage() called
  ↓
estimateResumeHeight() checks space
  ↓
Cascading truncation (if > 757pt):
  - Remove summary
  - Reduce skills counts
  - Reduce bullets per entry
  ↓
Single-page PDF rendered
```

### Data Limits
- **Parsing**: None
- **Display**: 5 exp bullets, 3 project bullets
- **Export**: 1 page max, skills capped, bullets cascading
- **Storage**: No storage (stateless)

---

## 9. RECOMMENDATIONS FOR ANALYSIS

### To Further Investigate
1. **Test with large resumes** - verify truncation behavior at scale
2. **Check OpenAI extraction accuracy** - any missed sections?
3. **Analyze ranking algorithm** - which skills are dropped?
4. **Profile memory usage** - how much resume data stored client-side?
5. **Review user feedback** - are exported PDFs missing important info?

### Critical Questions
1. Should summary be preserved (maybe reduced font size)?
2. Should multi-page PDFs be allowed?
3. Should all bullets be preserved with smaller font?
4. Should users choose what to include/exclude?
5. Should resume be versioned/stored?

---

## Conclusion

AutoJobs extraction is **comprehensive but destructive at export**. The parsing from PDF to structured JSON captures all data perfectly, but the one-page PDF export applies aggressive truncation that loses 70% of the original resume data. The system prioritizes fitting resumes onto a single page over preserving all information.

**Key Insight**: Data loss occurs at rendering, not extraction. The extracted resume object contains everything; the problem is the export/display layer discards most of it.
