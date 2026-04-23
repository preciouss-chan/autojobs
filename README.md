# AutoJobs

AutoJobs is now a local-first open-source resume tailoring app.

## What it does

- parse resume PDFs
- extract job requirements
- tailor resumes and cover letters with OpenAI
- export tailored resumes as PDF
- run a local browser extension against your local app server

## Local-only setup

### Prerequisites

- Node.js 18+
- npm 9+
- an OpenAI API key

### Install

```bash
npm install
```

### Run

```bash
npm run dev
```

Open:

- app: `http://localhost:3000`
- dashboard/API-key page: `http://localhost:3000/dashboard`

## API key flow

### Web app

Use `/dashboard` to enter your OpenAI API key for the current browser session.

### Extension

The extension defaults to `http://localhost:3000`.
Set your OpenAI API key from the extension popup, then use the popup against your local app server.

## Available commands

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run test:pdf
```

## Notes

- Stripe/payment flow has been removed.
- Hosted deployment docs and baked production extension builds were removed.
- Legacy auth/credits routes still exist in the repo in dormant form, but the main web flow no longer depends on them.

## License

MIT
