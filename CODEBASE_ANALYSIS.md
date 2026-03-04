# AutoJobs Codebase Analysis

## Executive Summary

AutoJobs is a full-stack Next.js application designed to simplify job applications through intelligent resume parsing, tailoring, and multi-format export. It combines a modern web UI, Chrome/Firefox browser extension, and OpenAI integration to help candidates customize their resumes and cover letters for specific job postings.

**Project Maturity**: Early-stage MVP with core features implemented
**Lines of Code**: ~3,000 (frontend/backend) + ~2,900 (browser extension)
**Tech Stack**: Next.js 16, React 19, TypeScript 5, OpenAI API, XeLaTeX

---

## 1. API ENDPOINTS & FUNCTIONALITY

### Core API Routes (in `app/api/`)

#### **1.1 `/api/parse-resume` (POST)**
- **Purpose**: Parse PDF resume into structured JSON
- **Input**: FormData with PDF file
- **Output**: Structured resume object
- **Process**:
  1. Reads PDF file using `pdf-parse` library
  2. Extracts raw text via pdf-parse
  3. Sends text to OpenAI GPT-4o-mini with JSON schema
  4. Returns structured resume with: name, contact, summary, projects, experience, education, skills
- **Error Handling**: Returns 400 for missing file, 401 for missing API key, 500 for parsing errors
- **Key Limitation**: Requires exact JSON schema match; LLM may fail to extract complex/unconventional resume formats

#### **1.2 `/api/extract-requirements` (POST)**
- **Purpose**: Extract job requirements from job description
- **Input**: jobDescription (string)
- **Output**: JobRequirements interface with 9 fields
- **Process**:
  1. Sends job description to GPT-4o-mini
  2. Extracts: title, seniority_level, required_skills, nice_to_have_skills, required_tools_frameworks, key_responsibilities, experience_years, domain, team_focus
- **Performance**: Single LLM call, fast response
- **Known Issue**: Seniority level forced to enum (Junior|Mid|Senior|Lead|Manager) which may not match actual role

#### **1.3 `/api/tailor` (POST)**
- **Purpose**: Core tailoring logic - rewrite resume bullets and generate cover letter
- **Input**:
  - jobDescription (string)
  - jobRequirements (JobRequirements, optional)
  - resume (resume object)
- **Output**: Tailoring edits with:
  - updated_summary (2-3 sentences)
  - project_edits (map of project name → rewritten bullets)
  - experience_edits (map of company name → rewritten bullets)
  - skills_to_add (map of skill categories → new skills)
  - cover_letter (full text with "Dear Hiring Manager" opening)
- **Process**:
  1. Constructs detailed prompt with resume + requirements + job description
  2. Instructs LLM to tailor experience/project bullets and write cover letter
  3. Returns JSON response
- **Critical Issue**: Heavy reliance on LLM prompt quality; no validation of response structure
- **Performance**: ~3-5 second response; one of slowest endpoints due to large prompt

#### **1.4 `/api/export/pdf` (POST)**
- **Purpose**: Convert resume JSON → PDF
- **Input**: Resume object (JSON)
- **Output**: PDF binary file
- **Process**:
  1. Calls `buildMTeckResume()` to convert JSON → LaTeX source
  2. Creates temp directory with LaTeX file
  3. Executes `xelatex` command-line tool
  4. Reads generated PDF, returns as binary
- **Dependencies**: XeLaTeX (system package), temp file system
- **Critical Limitation**: **Requires XeLaTeX installation** - fails silently on serverless platforms (Vercel, Netlify, etc.)
- **Strengths**: High-quality LaTeX output, single-page layout enforcement
- **Error Handling**: Returns 500 if xelatex crashes, checks PDF file existence

#### **1.5 `/api/export/latex` (POST)**
- **Purpose**: Export resume as .tex file for user editing
- **Input**: Resume object (JSON)
- **Output**: LaTeX source code (.tex)
- **Features**:
  - TeX character escaping (handles special chars like `$`, `%`, `_`)
  - Basic resume template (10pt article class)
  - Sections: Experience, Projects, Education, Skills
- **Use Case**: Users who want to further customize resume in LaTeX editors

#### **1.6 `/api/export/cover-letter` (POST)**
- **Purpose**: Convert cover letter text → PDF
- **Input**: { text: string } (plain text cover letter)
- **Output**: PDF binary file
- **Process**:
  1. Wraps cover letter paragraphs in LaTeX document
  2. Executes xelatex
  3. Returns PDF
- **Limitation**: Same XeLaTeX dependency as PDF export; fails on serverless

#### **1.7 `/api/chat` (POST)** - Interview Prep Feature
- **Purpose**: AI mock interviewer - answers questions as if candidate
- **Input**:
  - message (interview question)
  - jobDescription (optional context)
  - resume (candidate resume)
  - chatHistory (array of previous messages for context)
- **Output**: { response: string }
- **Features**:
  - Uses GPT-4o-mini with temperature=0.8 for natural responses
  - System prompt embeds full resume + job description
  - Maintains conversation history (last 6 messages)
  - Forces first-person responses ("I built...", not "The candidate built...")
- **Strength**: Contextually aware answers based on actual resume content
- **Known Issue**: Temperature too high (0.8) for factual consistency; should be 0.3-0.5

---

## 2. DATA STRUCTURES & FLOW ARCHITECTURE

### Resume Data Structure
```typescript
{
  name: string
  contact: {
    phone: string
    email: string
    linkedin: string
    github: string
  }
  summary: string (optional)
  projects: Array<{
    name: string
    date: string
    link: string
    bullets: string[]
  }>
  experience: Array<{
    company: string
    role: string
    dates: string
    bullets: string[]
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

### Data Flow: Resume Upload → Tailoring → Export

1. **Resume Input** (Two sources):
   - Browser Extension: PDF upload via `/api/parse-resume`
   - Web UI: Load from `data/resume.json` directly

2. **Requirement Extraction**:
   - Job description → `/api/extract-requirements` → JobRequirements object
   - Used to contextualize tailoring

3. **Tailoring Process**:
   - Base resume + job description → `/api/tailor` 
   - Returns tailoring edits (project/experience rewrites, skills to add, cover letter)

4. **Resume Merge** (`mergeResume()` utility):
   - Base resume + tailoring edits → merged resume
   - Updates summary, bullets, skills using fuzzy matching on company/project names
   - Ensures no duplicate skills added

5. **Export Options**:
   - PDF: Resume JSON → LaTeX → XeLaTeX compiler → PDF binary
   - LaTeX: Resume JSON → TeX source code
   - Cover Letter PDF: Text → LaTeX → XeLaTeX → PDF

### Critical Data Flow Issue
- **No validation of LLM outputs**: If OpenAI returns malformed JSON or missing fields, application crashes
- **No schema validation**: Consider Zod schemas for all API responses
- **Client-side state management**: All state in React component; no persistence

---

## 3. UI COMPONENTS & USER INTERACTIONS

### Main Page (`app/page.tsx`) - The Core UI
```
┌─────────────────────────────────────┐
│ Internship Resume Tailor (H1)       │
├─────────────────────────────────────┤
│ Job Description Textarea (48px high)│
│                                     │
│ [Extract Requirements] [Tailor]    │
│ [Clear]                             │
├─────────────────────────────────────┤
│ Extracted Requirements (if filled)  │
│ ├─ Job Title, Seniority Level...  │
│ ├─ Skills (blue badges)             │
│ ├─ Nice-to-Have (yellow badges)     │
│ └─ Responsibilities (bullet list)   │
├─────────────────────────────────────┤
│ Results (if tailor called)          │
│ ├─ Skills to Add (categorized)      │
│ ├─ Cover Letter (with copy button)  │
│ ├─ Resume Preview (visual)          │
│ └─ [Download PDF] button            │
└─────────────────────────────────────┘
```

### ResumePreview Component (`app/ResumePreview.tsx`)
- **Purpose**: Visual preview of resume before PDF export
- **Display**:
  - Header with name, phone, email, LinkedIn, GitHub icons
  - Projects section (name, date, 2 bullets max)
  - Experience section (role—company, 3 bullets max)
  - Skills section (Languages, Frameworks, Tools in columns)
  - Education section (degree—institution, GPA)
- **Styling**: Tailwind CSS, print-friendly (supports `print:` media queries)
- **Issue**: Hardcoded bullet limits (2 for projects, 3 for experience) don't match LaTeX template limits (3 and 5)

### User Interactions
1. **Paste job description** → textarea input
2. **Click "Extract Requirements"** → async call, displays structured requirements
3. **Click "Tailor Resume"** → async call, shows tailoring results + cover letter + preview
4. **Click "Copy"** on cover letter → `navigator.clipboard.writeText()`
5. **Click "Download PDF"** → fetch `/api/export/pdf`, creates blob, triggers download
6. **Click "Clear"** → reset all state

### UI Limitations
- **No error recovery UI**: Errors show only as red text, no retry buttons
- **No loading skeletons**: UX feels slow during 3-5 second tailoring
- **No success notifications**: Downloads happen silently (no toast/confirmation)
- **Limited mobile responsiveness**: Grid layout assumes desktop widths
- **No dark mode support**: Hardcoded white/gray colors

---

## 4. EXPORT FUNCTIONALITY

### PDF Export (XeLaTeX Pipeline)
**File**: `app/utils/mteckResumeTemplate.ts` + `/api/export/pdf`

**Template Features**:
- 10pt Helvetica font (ATS-friendly)
- Tight 0.4in margins (fits content on one page)
- Section spacing optimized for single-page
- Icons via FontAwesome5 (phone, envelope, LinkedIn, GitHub)
- Bullet limits: 3 per project, 5 per experience
- Horizontal rule separators
- No page numbers

**Process**:
1. `buildMTeckResume()` escapes special TeX chars and builds source
2. `mkdtemp()` creates `/tmp/latex-XXXX` directory
3. XeLaTeX executes: `xelatex -interaction=nonstopmode -halt-on-error ...`
4. PDF read from `/tmp/latex-XXXX/resume.pdf`
5. Returned as binary with `Content-Type: application/pdf`

**Critical Limitation**: XeLaTeX must be installed on server
- **Success on**: Mac, Linux (with texlive-xetex), self-hosted servers
- **Fails on**: Vercel, Netlify, AWS Lambda (no system package support)
- **Workaround needed**: Migrate to serverless-compatible PDF lib (pdfkit, puppeteer, or client-side jsPDF)

### LaTeX Export
- Returns raw .tex source for user customization
- Useful for candidates who want to edit LaTeX directly
- Includes complete preamble (packages, fonts, spacing)

### Cover Letter PDF
- Same XeLaTeX pipeline as resume PDF
- Wraps plain text in article document
- Preserves paragraph structure via newline splitting

---

## 5. CURRENT LIMITATIONS & ROUGH EDGES

### Critical Issues

#### 5.1 PDF Generation Breaks on Serverless
- **Problem**: XeLaTeX dependency makes app non-deployable to Vercel/Netlify
- **Impact**: Users can't use app without self-hosted backend
- **Resolution Required**: 
  - Option A: Migrate to pdfkit/puppeteer (serverless-compatible)
  - Option B: Run separate LaTeX microservice
  - Option C: Implement client-side PDF generation (jsPDF)

#### 5.2 No Validation of LLM Responses
- **Problem**: If OpenAI returns invalid JSON or missing fields, app crashes
- **Example**: `cover_letter` field missing → `copy(String(result.cover_letter || ""))` creates undefined reference
- **Fix**: Add Zod schema validation:
  ```typescript
  const TailorResponseSchema = z.object({
    updated_summary: z.string(),
    project_edits: z.record(z.array(z.string())),
    experience_edits: z.record(z.array(z.string())),
    skills_to_add: z.object({
      languages: z.array(z.string()),
      frameworks_libraries: z.array(z.string()),
      tools: z.array(z.string())
    }),
    cover_letter: z.string()
  });
  ```

#### 5.3 Resume Merge Uses Fuzzy Name Matching
- **Problem**: `mergeResume()` matches by lowercase company/project names
- **Risk**: Matching fails if AI returns slightly different names ("Google Inc" vs "Google")
- **Example**: AI returns `"project_edits": {"AutoApply": [...]}` but resume has `"Apply Boost"`
- **Fix**: Implement Levenshtein distance or use project IDs instead of names

#### 5.4 Hardcoded Resume Data
- **Problem**: Web UI loads from `data/resume.json` directly, not via API
- **Impact**: Can't change resume without redeploying
- **Fix**: Add resume upload/selection UI to web version

#### 5.5 Chat Endpoint Temperature Too High
- **Problem**: `temperature: 0.8` (0-1 scale) encourages creative/inconsistent responses
- **Risk**: Interviewer bot gives different answers to same question each time
- **Fix**: Reduce to 0.3-0.5 for more consistent, factual answers

### Medium Severity Issues

#### 5.6 Missing Error Recovery
- **Problem**: API errors show only as red text; no retry mechanism
- **Example**: Network timeout → user must manually re-submit entire form
- **Fix**: Add automatic retry logic with exponential backoff

#### 5.7 Button Disabling Logic Inconsistent
- **Problem**: Extract button checks `job.trim() === ""` but tailor button also checks same
- **Result**: Both disabled when job description empty, but message says "Please paste a job description or valid JSON"
- **Confusing**: Doesn't explain why button is disabled

#### 5.8 Console Logging for Debugging
- **Problem**: `console.log("API Response:", data)` on line 92 shipped in prod
- **Impact**: Sensitive data may leak to console
- **Fix**: Remove or guard with `process.env.NODE_ENV === "development"`

#### 5.9 Alert Boxes for Errors
- **Problem**: Uses native `alert()` on lines 345, 358
- **UX Issue**: Blocks interaction, doesn't integrate with UI
- **Fix**: Use toast notifications (react-hot-toast, sonner)

#### 5.10 Type Safety Issues
- **Problem**: Multiple `any` types in page.tsx:
  - Line 18: `Record<string, unknown>` for mergedResume
  - Line 56: `(data as any).error`
  - Line 60, 96: `catch (err: any)`
- **Fix**: Create interfaces for API response types

### Low Severity Issues

#### 5.11 Resume Preview Bullet Limits Mismatch
- **Problem**: Preview shows 2 bullets for projects, 3 for experience
- **LaTeX Template**: 3 bullets for projects, 5 for experience
- **Result**: Preview doesn't match actual PDF output
- **Fix**: Sync limits or make configurable

#### 5.12 No Accessibility Features
- **Problem**: 
  - Missing ARIA labels on buttons
  - No keyboard navigation hints
  - Color-coded sections (blue/yellow/purple) not label-distinguished
- **Fix**: Add `aria-label`, `role`, semantic HTML

#### 5.13 Styling Inconsistencies
- **Problem**:
  - Tailwind classes sometimes inconsistent (e.g., "px-5 py-2" vs "px-4 py-2")
  - Some sections use "bg-gray-50", others "bg-white"
- **Fix**: Create Tailwind utility classes

---

## 6. BROWSER EXTENSION ARCHITECTURE

### Manifest & Permissions
- **Version**: 2.0 (Manifest v3)
- **Permissions**: activeTab, scripting, storage, notifications
- **Host Permissions**: `https://*/*`, `http://*/*` (all websites)

### Key Components

#### 6.1 Content Script (`extension/content/content-script.js` - 1,701 lines)
- Injects into every webpage
- Detects job application platforms:
  - Greenhouse (recruiter.com)
  - Ashby (jobboard platform)
  - Generic form detection
- **Features**:
  - Extracts job description from page DOM
  - Auto-fills resume/cover letter into form fields
  - Handles React/Vue fiber injection for form input
  - Firefox + Chrome compatibility layer
  - Custom event dispatch system (avoids XRay vision in Firefox)

#### 6.2 Popup (`extension/popup/popup.js` - 621 lines)
- Main UI shown in extension icon click
- **Features**:
  - Display cached resume status
  - "Open Settings" button → options page
  - "Open Chatbot" button → interview prep mode
  - Settings checks for OpenAI API key
  - **Issue**: Checks `openaiApiKey` in sync storage, but API key should be validated server-side

#### 6.3 Options Page
- Allows user to set OpenAI API key
- Stores in `chrome.storage.sync`
- **Security Issue**: API key stored in unencrypted browser storage (minor risk since limited to extension)

#### 6.4 Job Board Injectors
- **greenhouse-inject.js**: Handles Greenhouse-specific React fiber injection
- **ashby-inject.js**: Handles Ashby form auto-fill
- **Challenge**: Each platform has different form structures; brittle selectors like `input[type=file][name*="resume"]`

#### 6.5 Resume Upload
- Detects PDF, caches in local storage
- Fallback to web UI `/api/parse-resume` endpoint
- **Limitation**: PDF parsing happens on backend (requires API call), not in extension

### Extension Data Flow
```
User clicks extension icon
    ↓
popup.js checks for cached resume
    ↓
User clicks "Tailor" button
    ↓
Scrapes job description from current page
    ↓
Sends to next.js backend: /api/tailor
    ↓
Gets tailored bullets + cover letter
    ↓
Injects into form fields using React fiber manipulation
    ↓
User submits application
```

---

## 7. FEATURE COMPLETENESS MATRIX

| Feature | Status | Notes |
|---------|--------|-------|
| Resume Parsing (PDF→JSON) | ✅ Complete | via parse-resume endpoint |
| Job Requirement Extraction | ✅ Complete | 9-field schema |
| Resume Tailoring (bullets, summary) | ✅ Complete | LLM-based, single call |
| Cover Letter Generation | ✅ Complete | Generated as part of tailor |
| PDF Export | ⚠️ Working* | *Requires XeLaTeX system dependency |
| LaTeX Export | ✅ Complete | For user customization |
| Resume Preview | ✅ Basic | Hardcoded styling, limited to 1 page preview |
| Chrome Extension | ✅ Functional | Works with Greenhouse, Ashby |
| Firefox Extension | ✅ Partial | Basic support, Firefox-specific bugs |
| Interview Chatbot | ✅ Complete | Mock interviewer, context-aware |
| Resume Caching | ✅ Complete | Extension local storage |
| Multi-job Comparison | ❌ Missing | Can't save/compare multiple tailorings |
| Analytics | ❌ Missing | No tracking of usage/success |
| Batch Processing | ❌ Missing | Can't tailor for multiple jobs at once |
| A/B Testing | ❌ Missing | No variants for different resume styles |
| Resume Template Selection | ❌ Missing | Only one LaTeX template |

---

## 8. AREAS FOR IMPROVEMENT (Priority Order)

### P0 (Must Fix for Production)

1. **Fix PDF Generation on Serverless** (4-6 hours)
   - Replace XeLaTeX with pdfkit or puppeteer
   - Test on Vercel/Netlify
   - Add fallback to client-side PDF if needed

2. **Add Response Validation** (2-3 hours)
   - Create Zod schemas for all API responses
   - Validate LLM outputs before using
   - Return 500 with validation errors if schema mismatch

3. **Improve Resume Merge Matching** (2 hours)
   - Replace exact name match with fuzzy matching (fuse.js)
   - Or use resume IDs instead of names

4. **Fix Type Safety** (1-2 hours)
   - Remove all `any` types from page.tsx
   - Create interfaces for API responses
   - Add strict mode errors

### P1 (Important for Beta)

5. **Improve Error UX** (3 hours)
   - Replace alert() with toast notifications
   - Add retry buttons for failed API calls
   - Show network status indicator

6. **Add Resume Upload to Web UI** (2 hours)
   - Allow users to upload PDF directly
   - Parse via `/api/parse-resume`
   - Store in session state (no persistence)

7. **Lower Chat Temperature** (10 minutes)
   - Change from 0.8 → 0.4 for more consistent answers
   - Test with same questions

8. **Sync Resume Preview Limits** (30 minutes)
   - Match preview bullet counts to LaTeX template
   - Or make configurable via settings

### P2 (Nice to Have)

9. **Add Persistence** (4 hours)
   - Save resume to IndexedDB or server
   - Save multiple tailorings for comparison
   - Allow version history

10. **Improve Accessibility** (3 hours)
    - Add ARIA labels
    - Keyboard navigation
    - Color-independent status indicators

11. **Add Analytics** (2 hours)
    - Track tailoring success rates
    - Measure time spent per resume
    - Identify bottleneck platforms

12. **Support Multiple Resume Templates** (3 hours)
    - Create template selector UI
    - Implement 2-3 additional templates (chronological, skills-first, etc.)
    - Allow custom CSS/LaTeX

13. **Batch Processing** (4 hours)
    - Upload multiple job descriptions
    - Tailor resume for each in parallel
    - Export all as zip file

---

## 9. CODE QUALITY ASSESSMENT

### Strengths
- ✅ TypeScript strict mode enabled
- ✅ Consistent code style (enforced by ESLint)
- ✅ Good separation of concerns (API routes, utilities, components)
- ✅ Proper error handling in API routes
- ✅ CORS headers configured for extension

### Weaknesses
- ❌ No request validation (Zod schemas missing)
- ❌ No response validation (LLM outputs trusted)
- ❌ Console logging in production code
- ❌ Alert() boxes instead of proper error UI
- ❌ Multiple `any` types in React component
- ❌ No unit tests
- ❌ No integration tests
- ❌ Hardcoded limits in templates
- ❌ Brittle DOM selectors in extension

### Testing Coverage
- 📊 Unit Tests: 0
- 📊 Integration Tests: 0
- 📊 E2E Tests: 0
- ✅ Manual Test Script: `npm run test:pdf` (basic PDF generation test)

---

## 10. DEPLOYMENT & HOSTING NOTES

### Current Deployment Challenges

1. **XeLaTeX Requirement**
   - Cannot deploy to Vercel/Netlify (no LaTeX)
   - Recommended: Self-hosted VPS or Railway

2. **Browser Extension Distribution**
   - Chrome: Requires $5 developer account + review (1-3 days)
   - Firefox: Free, similar review process
   - Current: Available for sideload only (test mode)

3. **API Key Management**
   - Currently: User provides OpenAI API key via extension settings
   - Alternative: Backend API key in environment variable (better security)
   - Risk: User key storage unencrypted in chrome.storage.sync

### Recommended Hosting Stack
- **Web App**: Railway.app or Fly.io (supports XeLaTeX install)
- **Database**: PostgreSQL (optional, for multi-user)
- **Analytics**: Vercel Analytics or Plausible
- **CDN**: Cloudflare (free tier)

---

## FINAL SUMMARY TABLE

| Category | Score | Notes |
|----------|-------|-------|
| **Feature Completeness** | 7/10 | Core features working; missing persistence & advanced options |
| **Code Quality** | 6/10 | TypeScript strict mode good; lacks validation & tests |
| **Production Readiness** | 3/10 | XeLaTeX blocker; needs better error handling |
| **User Experience** | 6/10 | Functional but basic; needs better feedback & error recovery |
| **Extensibility** | 5/10 | Monolithic approach; hard to add new resume templates |
| **Performance** | 7/10 | API calls reasonable (1-5 sec); no caching or optimization |
| **Security** | 5/10 | API key in browser storage; no input sanitization on LLM outputs |
| **Documentation** | 6/10 | AGENTS.md helpful; HOSTING.md comprehensive but outdated |

---

## Recommended Next Steps

### Week 1: Foundation
1. Fix PDF export (serverless-compatible library)
2. Add Zod validation to all API responses
3. Improve resume merge matching

### Week 2: Polish
1. Rewrite error UX (toast notifications)
2. Add resume upload to web UI
3. Fix type safety (`any` → interfaces)

### Week 3: Features
1. Add persistence (session or database)
2. Support multiple tailorings for comparison
3. Improve accessibility

### Week 4: Launch
1. Set up CI/CD pipeline (GitHub Actions)
2. Deploy to production (Railway/Fly)
3. Release browser extension to stores
4. Set up analytics & error tracking

