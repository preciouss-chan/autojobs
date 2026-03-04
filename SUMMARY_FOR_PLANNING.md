# AutoJobs Codebase Summary for Next Steps Planning

## Quick Facts

| Metric | Value |
|--------|-------|
| **Project Type** | Full-stack Next.js + Browser Extension |
| **Primary Language** | TypeScript (strict mode) |
| **Line Count** | ~3,000 (backend) + ~2,900 (extension) |
| **Key Libraries** | React 19, Next.js 16, OpenAI API, pdf-parse, XeLaTeX |
| **API Endpoints** | 7 (parse, extract, tailor, pdf, latex, cover-letter, chat) |
| **UI Components** | 2 (page.tsx, ResumePreview.tsx) + extension |
| **Maturity** | Early MVP - core features working, needs hardening |

---

## What Works Well ✅

1. **Core Resume Tailoring** - LLM-based bullet rewriting + cover letter generation works
2. **PDF Export** - XeLaTeX template produces high-quality single-page PDFs
3. **Browser Extension** - Chrome & Firefox compatible, detects Greenhouse/Ashby platforms
4. **Interview Chatbot** - Context-aware mock interviewer using resume data
5. **Resume Parsing** - PDF→JSON parsing via pdf-parse + GPT-4o-mini
6. **API Architecture** - Clean separation of concerns, good error handling structure

---

## What Needs Fixing 🚨

### Critical (Blocks Production)
1. **XeLaTeX Dependency** - PDF export fails on serverless (Vercel/Netlify)
   - **Fix Time**: 4-6 hours
   - **Options**: Migrate to pdfkit, puppeteer, or client-side jsPDF

2. **No Response Validation** - LLM outputs not validated; crashes on malformed JSON
   - **Fix Time**: 2-3 hours
   - **Solution**: Add Zod schemas for all API responses

### Important (For Beta)
3. **Resume Merge Matching** - Uses exact lowercase name match; brittle
   - **Fix Time**: 2 hours
   - **Solution**: Use fuzzy matching (fuse.js) or resume IDs

4. **Poor Error UX** - Shows red text, no retry, uses alert() boxes
   - **Fix Time**: 3 hours
   - **Solution**: Toast notifications, automatic retry, error guidance

5. **Missing Resume Upload on Web** - Web UI uses hardcoded data/resume.json
   - **Fix Time**: 2 hours
   - **Solution**: Add PDF upload UI to match extension capability

6. **Type Safety Issues** - Multiple `any` types in React component
   - **Fix Time**: 1-2 hours
   - **Solution**: Create interfaces for API responses

### Nice to Have
7. No persistence (can't save multiple tailorings)
8. No accessibility features (ARIA, keyboard nav)
9. No unit/integration tests
10. Chat temperature too high (0.8 → should be 0.4)

---

## Critical Path for Launch

### Phase 1: Foundation (Week 1)
**Goal**: Make production-ready
- [ ] Replace XeLaTeX with serverless-compatible PDF lib
- [ ] Add Zod validation to all API responses
- [ ] Improve resume merge fuzzy matching
- **Estimated**: 8-10 hours

### Phase 2: Polish (Week 2)
**Goal**: Improve UX & reliability
- [ ] Rewrite error handling (toast notifications + retry)
- [ ] Add resume upload to web UI
- [ ] Fix type safety (remove `any`)
- [ ] Lower chat temperature to 0.4
- **Estimated**: 8 hours

### Phase 3: Launch (Week 3)
**Goal**: Deploy + distribute
- [ ] Set up GitHub Actions CI/CD
- [ ] Deploy to Railway or Fly.io
- [ ] Test extension on Chrome & Firefox
- [ ] Prepare Chrome Web Store submission
- **Estimated**: 6 hours

### Phase 4: Monitoring (Week 4)
**Goal**: Track quality & usage
- [ ] Set up error tracking (Sentry)
- [ ] Add analytics (Vercel Analytics or Plausible)
- [ ] Monitor API costs
- [ ] Gather user feedback
- **Estimated**: 4 hours

**Total**: ~26 hours (3-4 weeks at 10 hrs/week part-time)

---

## Recommended Hosting Stack

### For Immediate Deployment
**Railway.app** (recommended):
- Supports XeLaTeX (no system dependency restriction)
- Simple GitHub integration
- $5-10/month for typical usage
- Can install texlive-xetex in Dockerfile

Alternative: **Fly.io** or self-hosted VPS

### Future: Serverless-Optimized
Once you migrate away from XeLaTeX:
- **Frontend + APIs**: Vercel or Netlify
- **Database** (optional): PostgreSQL (Railway, Supabase)
- **Analytics**: Vercel Analytics or Plausible

---

## Feature Completeness Assessment

### MVP (Done ✅)
- Resume parsing from PDF
- Job requirement extraction
- Resume tailoring (bullets + summary)
- Cover letter generation
- PDF export (with quality template)
- Browser extension integration
- Interview chatbot

### Beta (Todo)
- Resume upload on web UI
- Multiple resume support
- Tailoring history
- Error recovery UI
- Accessibility features

### V1.0 (Future)
- Multiple resume templates
- Batch job processing
- Analytics dashboard
- Integration with job boards (API-level)
- Team/org features
- Custom training data

---

## Known Limitations & Trade-offs

### Architecture Decisions
1. **No Database** - Simplifies deployment, but limits features
   - Trade-off: Can't save history or do comparisons
   - Fix: Add PostgreSQL if persisting data becomes critical

2. **LLM-Driven Tailoring** - Fast iteration, but requires prompt engineering
   - Trade-off: Quality depends on LLM version + prompt
   - Fix: Add human review feature or A/B test different prompts

3. **Browser Storage for API Keys** - Easy UX, but security risk
   - Trade-off: User controls API costs, but key is unencrypted
   - Fix: Move to backend API key for production

4. **Single LaTeX Template** - Quick to launch, hard to customize
   - Trade-off: Professional look, but one-size-fits-all
   - Fix: Support 2-3 templates, then custom CSS

### Performance Bottlenecks
1. OpenAI API latency (2-5s per request)
2. XeLaTeX compilation (1-3s for PDF)
3. No caching between similar jobs

### Security Considerations
1. API key in browser storage (extension)
2. No input validation on API routes
3. No rate limiting (spam risk)
4. Prompt injection vulnerability (job description unchecked)

---

## Code Health Snapshot

```
TypeScript Strict Mode:  ✅ Enabled
ESLint Configuration:    ✅ Configured
Test Coverage:           ❌ 0% (unit/integration/E2E)
Type Safety:             ⚠️  Partial (some `any` types)
Input Validation:        ❌ Missing (no Zod)
Response Validation:     ❌ Missing
Error Handling:          ⚠️  Basic
Documentation:           ⚠️  Moderate (AGENTS.md good, code sparse)
```

---

## Key Files to Understand

| File | Lines | Purpose | Quality |
|------|-------|---------|---------|
| `app/page.tsx` | 373 | Main web UI | Good (simple flow, some `any` types) |
| `app/api/tailor/route.ts` | 159 | Core tailoring logic | Good (clean, no validation) |
| `app/api/export/pdf/route.ts` | 73 | PDF generation | Good (but XeLaTeX dependent) |
| `app/utils/mergeResume.ts` | 58 | Resume merging | Fair (brittle name matching) |
| `app/utils/mteckResumeTemplate.ts` | 137 | LaTeX template | Good (clean, some hardcoded limits) |
| `extension/content/content-script.js` | 1,701 | Job board injection | Complex (handles React fiber) |
| `app/api/parse-resume/route.ts` | 139 | PDF parsing | Good (proper error handling) |
| `app/api/chat/route.ts` | 153 | Interview chatbot | Good (contextual prompts) |

---

## Quick Start for New Developers

1. **Clone & Setup**
   ```bash
   git clone <repo>
   cd autojobs
   npm install
   # Create .env.local with OPENAI_API_KEY
   ```

2. **Run Dev Server**
   ```bash
   npm run dev
   # Open http://localhost:3000
   ```

3. **Test PDF Export**
   ```bash
   npm run test:pdf
   # (requires xelatex installed locally)
   ```

4. **Load Extension**
   - Chrome: `chrome://extensions` → Load unpacked → `/extension`
   - Firefox: `about:debugging` → Load temporary add-on → `/extension/manifest.firefox.json`

5. **Code Style**
   ```bash
   npm run lint           # Check ESLint
   npx tsc --noEmit      # Check types
   ```

---

## Recommended Next Action

### This Week
1. **Fix PDF Export** - Migrate to pdfkit or puppeteer (unblocks serverless deployment)
2. **Add Response Validation** - Create Zod schemas for all API responses
3. **Test on Serverless** - Deploy to Railway/Fly to verify it works

### After That
4. Improve error UX (toast notifications + retry logic)
5. Add resume upload to web UI
6. Fix type safety (remove `any` types)
7. Deploy to production

---

## Questions for Product Planning

1. **Persistence**: Do you want to save user's tailoring history? (Requires database)
2. **Monetization**: Charge per API call or subscription? (Affects API key strategy)
3. **Multi-Resume**: Support multiple resumes per user? (Requires resume management UI)
4. **Templates**: How important is custom resume templates? (Effort: 3-6 hours per template)
5. **Integrations**: Any job board API integrations planned? (Greenhouse, LinkedIn, etc.)
6. **Teams**: Will this be team/org-based or individual users only? (Affects auth & persistence)

---

## Document Map

- **CODEBASE_ANALYSIS.md** - Detailed technical analysis (10 sections)
- **ARCHITECTURE_DIAGRAMS.md** - Visual diagrams for system design
- **SUMMARY_FOR_PLANNING.md** - This file (executive summary)
- **AGENTS.md** - Development guidelines (tools, code style, etc.)
- **HOSTING.md** - Deployment options (comprehensive but outdated re: serverless)

---

## Resources

- OpenAI API Docs: https://platform.openai.com/docs
- Next.js Docs: https://nextjs.org/docs
- Zod Schema Validation: https://zod.dev
- pdf-parse NPM: https://www.npmjs.com/package/pdf-parse
- pdfkit (serverless-safe): https://pdfkit.org
- Railway Deployment: https://railway.app
- Browser Extension Docs: https://developer.chrome.com/docs/extensions

---

**Last Updated**: March 4, 2026
**Analysis Depth**: Comprehensive (explored 100% of codebase)
