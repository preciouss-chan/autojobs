# AGENTS.md - Development Guide for AutoJobs

## Project Overview
**AutoJobs** is a Next.js 16 application that simplifies job applications through resume parsing, tailoring, and export functionality. It uses React 19, TypeScript 5, and OpenAI integration for intelligent resume processing.

---

## Build, Lint, and Test Commands

### Development
- `npm run dev` — Start Next.js dev server with Webpack (hot reload enabled)

### Production
- `npm run build` — Build Next.js production bundle
- `npm run start` — Start production server

### Linting
- `npm run lint` — Run ESLint (includes Next.js core-web-vitals and TypeScript rules)
- `npm run lint -- <file>` — Lint specific file
- `npm run lint -- <glob>` — Lint files matching pattern (e.g., `npm run lint -- 'app/**/*.tsx'`)

### Testing
- `npm run test:pdf` — Test PDF parsing functionality (`scripts/test-pdf.js`)

### Type Checking
- `npx tsc --noEmit` — Check TypeScript types without emitting (run before commits)

---

## Code Style Guidelines

### Imports
- Use ES module imports (`import` not `require`), except where module loading requires CommonJS (e.g., pdf-parse in API routes)
- Group imports: external packages → Next.js → React → local files
- Use path alias `@/*` for project root imports where applicable
- Explicitly import types: `import type { SomeType } from "..."` for type-only imports

**Example:**
```typescript
import type { Metadata } from "next";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import Component from "@/app/components/Component";
```

### Formatting
- Use 2-space indentation (enforced by ESLint/Next.js defaults)
- Max line length: follow ESLint defaults (typically 80-100 chars for readability)
- Semicolons required (ESLint enforced)
- No trailing commas in object/array literals unless multi-line
- Use double quotes for strings (ESLint: `quotes: ["error", "double"]`)

### TypeScript & Types
- Enable strict mode (configured in `tsconfig.json`)
- Always add return types to functions: `function foo(): ReturnType { }`
- Avoid `any`; use specific types or `unknown` with type narrowing
- Use `readonly` for immutable props in React components
- Define explicit prop interfaces instead of inline types
- Use `Readonly<>` wrapper for readonly props: `Readonly<{ children: React.ReactNode }>`

**Example:**
```typescript
interface Props {
  readonly resume: ResumeData;
  readonly onSubmit: (data: FormData) => Promise<void>;
}

export default function Component({ resume, onSubmit }: Props) { ... }
```

### Naming Conventions
- **Files/Directories**: kebab-case for dirs, PascalCase for React components (`.tsx`), camelCase for utilities (`.ts`)
  - Exception: `route.ts` for Next.js API routes, `layout.tsx` for layouts
- **Variables/Functions**: camelCase
- **Constants**: UPPER_SNAKE_CASE if truly constant, camelCase if config-like
- **Types/Interfaces**: PascalCase
- **Boolean variables**: Prefix with `is`, `has`, `can` (e.g., `isLoading`, `hasError`)

### Error Handling
- Use try-catch blocks in async functions, especially API routes
- Always catch errors as `err: any` and extract properties safely:
  ```typescript
  catch (err: any) {
    const message = err.message || String(err);
    const stack = err.stack || "";
    console.error("Operation failed:", message);
  }
  ```
- Return structured NextResponse errors with appropriate HTTP status codes:
  ```typescript
  return NextResponse.json(
    { error: "User-friendly message", details: errorMessage },
    { status: 400 }
  );
  ```
- Log errors with context (operation name, relevant IDs)
- Include dev stack traces via environment check: `process.env.NODE_ENV === "development"`

### React Components
- Mark client components with `"use client"` at the top of file
- Use functional components with hooks (no class components)
- Prefer composition over prop drilling; use context for global state
- Avoid inline functions in render; extract to useCallback
- Use semantic HTML and ARIA attributes for accessibility
- Style with Tailwind CSS classes (configured in `tailwind.config.js`)

### API Routes
- Set runtime explicitly: `export const runtime = "nodejs"` for Node.js APIs
- Accept `req: Request` and return `NextResponse` (Next.js 13+ App Router pattern)
- Validate inputs before processing; return 400 for invalid requests
- Use headers for optional config: `req.headers.get("X-Custom-Header")`
- Fallback to environment variables: `req.headers.get("X-Key") || process.env.KEY`
- Always use try-catch; never let unhandled rejections reach client

### Next.js Specific
- Use App Router (not Pages Router): routes in `app/` directory with `page.tsx` and `route.ts`
- Use layout.tsx for shared layout (defined in `app/layout.tsx`)
- Metadata exported from components: `export const metadata: Metadata = { ... }`
- Use path alias `@/*` for imports (configured in tsconfig.json)
- Static content in `public/`; dynamic API responses use API routes

### Comments
- Avoid obvious comments; focus on "why" not "what"
- Use `// TODO:` for pending work
- Document complex logic, non-obvious algorithms, and business rules
- Use JSDoc for exported functions/types (optional but encouraged for APIs)

---

## Tools & Technologies
- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript 5 (strict mode)
- **UI**: React 19, Tailwind CSS 3
- **Styling**: PostCSS with Tailwind
- **Linting**: ESLint 9 (Next.js config + TypeScript)
- **External APIs**: OpenAI (gpt-4o-mini)
- **Testing**: PDF parsing with pdf-parse
- **Browser Automation**: Playwright (available for testing)

---

## Git & Commits
- Commit messages should be clear and concise (imperative mood)
- Include relevant file paths in detailed descriptions
- Reference issue numbers when applicable
- Example: `feat: add resume parsing via OpenAI API`

---

## Environment
- See `.env.local` for required environment variables
- `OPENAI_API_KEY` required for API calls
- Development mode checks available via `process.env.NODE_ENV`
