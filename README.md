# AutoJobs

AutoJobs is now a local-first open-source resume tailoring app.

## What it does

- parse resume PDFs
- extract job requirements
- tailor resumes and cover letters with OpenAI or a local OpenAI-compatible model server
- export tailored resumes as PDF
- run a local browser extension against your local app server

## Local-only setup

### Prerequisites

- Node.js 18+
- npm 9+
- either an OpenAI API key or a local OpenAI-compatible server such as Ollama

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

### Local model flow

AutoJobs can use a local Ollama model through Ollama's OpenAI-compatible API.

```bash
ollama pull gemma4:e4b
ollama serve
```

Add this to `.env.local`, then restart `npm run dev`:

```bash
LLM_PROVIDER=local
LLM_BASE_URL=http://localhost:11434/v1
LLM_MODEL=gemma4:e4b
```

You can swap `LLM_MODEL` for another local model name, such as `gemma4:e2b`, `gemma4:26b`, or any Ollama model that works well on your machine.

### Web app

Use `/dashboard` only when your provider needs a browser-session API key. Local Ollama does not require one.

### Extension

The extension defaults to `http://localhost:3000`.
For local Ollama, leave the extension API key empty. For OpenAI or another hosted OpenAI-compatible endpoint, set the API key from the extension popup.

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
