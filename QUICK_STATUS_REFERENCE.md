# AutoJobs - Quick Status Reference

**Overall Status**: 60-65% Production Ready | **Last Updated**: March 9, 2026

---

## Quick Facts

- **Lines of Code**: ~5,000-6,000 (web + extension)
- **Core Feature Status**: 80% implemented
- **Auth**: ✅ Google OAuth + JWT
- **Payments**: ✅ Stripe integration working
- **Build Status**: ✅ Compiles without errors
- **Deployment**: ⚠️ Blocked by XeLaTeX dependency

---

## What Works (Shipped Features)

✅ Resume parsing (PDF → JSON via OpenAI)
✅ Job requirements extraction (9-field schema)
✅ Resume tailoring with AI (bullets + summary)
✅ Cover letter generation (conversational tone)
✅ PDF export (locally - not serverless)
✅ LaTeX export (raw source)
✅ Interview chatbot (mock interviewer)
✅ Google OAuth authentication
✅ Stripe payments ($2.49 for 100 credits)
✅ Credit system with free trial
✅ User dashboard with credit balance
✅ Billing history
✅ Browser extension (Chrome/Firefox)
✅ Platform support: Greenhouse, Ashby, Workday
✅ Toast notifications for feedback
✅ Response validation (Zod schemas)

---

## What's Broken (Critical Issues)

🔴 **XeLaTeX Dependency** - Cannot deploy to Vercel/Netlify/Lambda
   → Impact: Core PDF feature blocked on serverless
   → Fix: Replace with pdfkit/jsPDF (4-6 hours)

🔴 **Extension Auth Sync** - Web and extension can get out of sync
   → Impact: Users may be logged in on web but not extension
   → Fix: Add periodic validation + E2E tests (3-4 hours)

🔴 **Incomplete Response Validation** - 3 endpoints missing LLM output validation
   → Impact: Crashes if LLM returns invalid JSON
   → Fix: Add validation to 3 endpoints (2 hours)

🟡 **No Rate Limiting** - Expensive OpenAI calls unprotected
   → Impact: Users/attackers could spam API
   → Fix: Add middleware rate limiting (3 hours)

🟡 **Resume Merge Uses Exact Matching** - Fails if AI returns slightly different names
   → Impact: Tailored bullets not merged
   → Fix: Fuzzy matching with Levenshtein (1-2 hours)

---

## Architecture Overview

```
Frontend (Web)          Browser Extension         Backend
────────────────────    ─────────────────        ──────────
/                       popup.js                 /api/tailor ──────┐
/dashboard              background.js            /api/extract-req  │
/billing                content-script.js        /api/parse-resume ├─→ OpenAI
/auth/signin            manifest.json            /api/chat         │
                                                 /api/export/*     │
                        ↕ message sync           /api/auth         │
                        ↕ token sync             /api/credits      │
                                                 /api/payments     │
                                                 /api/extension    └──────
                                                     │
                                                PostgreSQL
                                              (Users, Credits, Transactions,
                                               Stripe Payments)
```

---

## Deployment Constraints

**Cannot Deploy To:**
- ✗ Vercel (no XeLaTeX)
- ✗ Netlify (no XeLaTeX)
- ✗ AWS Lambda (no system packages)

**Can Deploy To:**
- ✅ Railway.app (system packages supported)
- ✅ Fly.io (Docker environment)
- ✅ Self-hosted VPS
- ✅ Localhost (dev only)

---

## Environment Setup

```bash
# Required environment variables
OPENAI_API_KEY=sk-...
DATABASE_URL="postgresql://user:pass@host:port/db"
AUTH_GOOGLE_ID=...
AUTH_GOOGLE_SECRET=...
AUTH_SECRET=...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

---

## Testing Status

- 📊 Unit Tests: **0**
- 📊 Integration Tests: **0**
- 📊 E2E Tests: **0**
- ✅ Manual Tests: Some (incomplete)
- ✅ Build Tests: Passing
- ⚠️ API Tests: Partial (via Zod validation)

---

## Code Quality Scores

| Category | Score | Status |
|----------|-------|--------|
| Feature Completeness | 8/10 | Good |
| Code Quality | 7/10 | Good |
| Production Readiness | 6/10 | Fair ⚠️ |
| User Experience | 7/10 | Good |
| Security | 6/10 | Fair |
| Performance | 7/10 | Good |
| Documentation | 6/10 | Fair |
| Testing | 2/10 | Poor ❌ |

---

## Priority Fixes (Blocking Production)

### P0 (Must Fix)
1. **XeLaTeX PDF export** → Replace with serverless library
2. **Extension auth sync** → Add validation checks + tests
3. **API response validation** → Complete remaining endpoints
4. **Rate limiting** → Add middleware protection

### P1 (Important)
1. Resume merge fuzzy matching
2. Webhook idempotency
3. Error recovery UI
4. Extension communication timeouts

### P2 (Nice to Have)
1. Multi-job comparison
2. Resume templates
3. Batch processing
4. Accessibility improvements

---

## Estimated Timeline to Production

- **Current State**: 60-65% ready
- **After P0 fixes** (1 week): 75-80% ready
- **After P1 fixes** (2 weeks): 85-90% ready
- **After P2 work** (3-4 weeks): 95%+ ready

**Recommended Launch**: 3-4 weeks with aggressive work

---

## Key Files & Locations

### Core API Routes
- `/api/tailor` - Resume tailoring with AI
- `/api/parse-resume` - PDF parsing
- `/api/extract-requirements` - Job req extraction
- `/api/export/pdf` - PDF generation (XeLaTeX blocker)
- `/api/chat` - Interview chatbot
- `/api/credits/balance` - Get credit balance
- `/api/credits/deduct` - Deduct credits
- `/api/payments/create-session` - Stripe checkout
- `/api/payments/webhook` - Stripe webhook handler
- `/api/auth/[...nextauth]` - NextAuth routes

### Frontend Pages
- `/app/page.tsx` - Main tailor UI
- `/app/dashboard/page.tsx` - User dashboard
- `/app/billing/page.tsx` - Billing history
- `/app/auth/signin/page.tsx` - Login page

### Browser Extension
- `/extension/manifest.json` - Extension config
- `/extension/background/background.js` - Background worker
- `/extension/popup/popup.js` - Popup UI
- `/extension/content/content-script.js` - Content script

### Database
- `/prisma/schema.prisma` - Database schema
- `/lib/auth.ts` - NextAuth configuration
- `/lib/prisma.ts` - Prisma client

### Validation
- `/app/lib/schemas.ts` - Zod schemas for all types

---

## Recent Work (Last 6 Commits)

✅ JWT-based sessions for reliability
✅ NextAuth configuration consolidation
✅ Dashboard Suspense boundary fix
✅ Webhook error typing improvements
✅ Full payment system implementation
✅ Workday platform support added

---

## Uncommitted Changes (12 files)

⚠️ Dashboard enhancement (auth sync improvements)
⚠️ Popup improvements (auth sync + token management)
⚠️ Background script updates (logout relay)
⚠️ Auth helpers (token sync from dashboard)
⚠️ Webhook improvements (error handling)
⚠️ Transaction endpoint updates

---

## Quick Commands

```bash
# Development
npm run dev                 # Start dev server
npm run build             # Build for production
npm run start             # Start production server
npm run lint             # Run linter

# Testing
npm run test:pdf         # Test PDF parsing

# Type checking
npx tsc --noEmit         # Check TypeScript

# Database
npx prisma migrate dev   # Create new migration
npx prisma migrate deploy # Apply migrations
npx prisma studio       # Open Prisma UI
```

---

## Known Workarounds

**For XeLaTeX Missing**:
- Export to LaTeX instead (download .tex file)
- Use online LaTeX compiler (e.g., Overleaf)
- Deploy to Railway/Fly.io instead

**For Extension Logout**:
- Refresh extension popup manually
- Log out from dashboard (this should cascade)

**For Failed PDF Export**:
- Check XeLaTeX installation: `xelatex --version`
- Check temp directory permissions: `/tmp/`

---

## Next Steps for Developer

1. **Immediate** (Today):
   - Commit uncommitted changes with message: "feat(auth): improve extension-dashboard token sync"
   - Run full test suite (create if missing)

2. **Week 1**:
   - [ ] Fix PDF export for serverless
   - [ ] Complete API response validation
   - [ ] Stabilize extension auth sync
   - [ ] Add rate limiting

3. **Week 2**:
   - [ ] Fix resume merge fuzzy matching
   - [ ] Complete logout handlers
   - [ ] Add E2E tests
   - [ ] Improve error UX

4. **Week 3-4**:
   - [ ] Add advanced features (comparison, templates)
   - [ ] Improve accessibility
   - [ ] Set up CI/CD
   - [ ] Deploy to production

---

## Support & Resources

- **Main Docs**: See `AGENTS.md` (dev guidelines)
- **Full Assessment**: See `CURRENT_STATUS_ASSESSMENT.md`
- **Auth Docs**: NextAuth.js documentation
- **API Docs**: OpenAI API + Stripe API
- **Database**: Prisma documentation

---

**TL;DR**: The app is 80% complete with all core features working. Main blockers are XeLaTeX (4-6 hours to fix), extension auth sync (3-4 hours), and missing tests (ongoing). After P0 fixes, it's launch-ready with some polish needed.
