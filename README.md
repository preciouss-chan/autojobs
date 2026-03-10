# AutoJobs: Intelligent Resume Tailor

A Next.js 16 application that simplifies job applications through AI-powered resume parsing, intelligent tailoring, and seamless PDF export. Designed for internship seekers and early-career professionals.

## Features

- **Resume Parsing**: Upload PDF resumes and automatically extract structured data using OpenAI
- **Job Analysis**: Extract key requirements from job descriptions
- **Resume Tailoring**: AI-powered resume customization tailored to specific job requirements
- **Cover Letter Generation**: Auto-generated cover letters matching job specifications
- **PDF Export**: One-click resume download with professional formatting
- **Browser Extension**: Chrome/Firefox extension for job board integration
- **Error Recovery**: Comprehensive error handling with user-friendly error messages
- **Accessibility**: Full WCAG 2.1 compliance with ARIA labels and keyboard navigation

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript 5 (strict mode)
- **UI**: React 19 with Tailwind CSS 3
- **AI**: OpenAI GPT-4 Mini
- **Database**: Prisma ORM with PostgreSQL
- **Authentication**: NextAuth.js
- **Payment**: Stripe integration
- **PDF Export**: jsPDF (serverless-compatible)

## Getting Started

### Prerequisites

- Node.js 18+ and npm 9+
- PostgreSQL database
- OpenAI API key
- Stripe account (for payment features)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/autojobs.git
   cd autojobs
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.local.example .env.local
   ```

   Configure these required variables:
   - `OPENAI_API_KEY`: Your OpenAI API key
   - `DATABASE_URL`: PostgreSQL connection string
   - `NEXTAUTH_SECRET`: Secret for NextAuth sessions
   - `STRIPE_SECRET_KEY`: Stripe API secret (for payments)
   - `STRIPE_WEBHOOK_SECRET`: Stripe webhook signing secret

4. **Set up database**
   ```bash
   npx prisma migrate dev
   npx prisma db seed
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

   Navigate to `http://localhost:3000`

## Development

### Available Commands

```bash
# Development
npm run dev                    # Start dev server with hot reload

# Production
npm run build                  # Build for production
npm run start                  # Start production server

# Linting & Type Checking
npm run lint                   # Run ESLint
npm run lint -- <file>         # Lint specific file
npx tsc --noEmit              # Type check without emitting

# Testing
npm run test:pdf              # Test PDF parsing
node scripts/test-extension-timeouts.js    # Test extension timeouts
```

## Project Structure

```
autojobs/
├── app/
│   ├── api/                   # API routes
│   │   ├── chat/              # Chatbot endpoint
│   │   ├── export/            # PDF/Cover Letter export
│   │   ├── extension/         # Extension auth endpoints
│   │   ├── parse-resume/      # PDF parsing
│   │   ├── tailor/            # Resume tailoring
│   │   └── ...
│   ├── components/            # React components
│   │   ├── ErrorBoundary.tsx  # Main error boundary
│   │   ├── FormErrorBoundary.tsx  # Form-specific errors
│   │   └── ...
│   ├── lib/                   # Utilities & configuration
│   │   ├── llm-config.ts      # LLM temperature settings
│   │   └── schemas.ts         # TypeScript types
│   ├── utils/                 # Helper functions
│   ├── page.tsx               # Main tailor page
│   └── layout.tsx             # Root layout
├── extension/                 # Browser extension source
│   ├── chrome/                # Chrome-specific code
│   ├── firefox/               # Firefox-specific code
│   ├── shared/                # Shared extension code
│   └── popup/                 # Extension popup UI
├── public/                    # Static assets
├── scripts/                   # Testing & utility scripts
└── prisma/                    # Database schema
```

## Error Handling

The application includes comprehensive error handling with two error boundary components:

### ErrorBoundary
Main error boundary for application-wide errors. Shows a user-friendly error message with retry capability.

```tsx
import ErrorBoundary from "@/app/components/ErrorBoundary";

<ErrorBoundary>
  <YourComponent />
</ErrorBoundary>
```

### FormErrorBoundary
Specialized error boundary for form operations and API errors. Displays inline error notifications with auto-dismiss.

```tsx
import FormErrorBoundary from "@/app/components/FormErrorBoundary";

<FormErrorBoundary onError={(error) => console.log(error)}>
  <Form />
</FormErrorBoundary>
```

## API Documentation

See [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) for detailed endpoint specifications, request/response formats, and usage examples.

### Key Endpoints

- `POST /api/parse-resume` - Parse PDF resume
- `POST /api/extract-requirements` - Extract job requirements
- `POST /api/tailor` - Generate tailored resume
- `POST /api/export/pdf` - Export resume as PDF
- `GET /api/chat` - Chat with resume assistant
- `POST /api/credits/deduct` - Deduct user credits

## Extension Development

See [EXTENSION_DOCUMENTATION.md](./EXTENSION_DOCUMENTATION.md) for detailed extension API documentation, setup instructions, and development guidelines.

## Performance Optimizations

- **Memoization**: React components use memo for expensive computations
- **Code Splitting**: Dynamic imports for large components
- **API Caching**: Response caching for stable data
- **Image Optimization**: Next.js automatic image optimization
- **Bundle Size**: Tree-shaking and minification

## Configuration

### LLM Temperature Settings

Temperature presets are configured in `app/lib/llm-config.ts`:

```typescript
DETERMINISTIC: 0.1   // For parsing and extraction
FOCUSED: 0.3         // For resume tailoring
CONVERSATIONAL: 0.4  // For chat interactions
CREATIVE: 0.7        // For creative responses
```

### API Timeouts

Operation-specific timeouts configured in `extension/shared/api-utils.js`:

```javascript
OPERATION_TIMEOUTS = {
  'extension/validate': 5000,
  'parse-resume': 30000,
  'export/cover-letter': 30000,
  'tailor': 30000,
  // ... more operations
}
```

## Testing

The application includes comprehensive test suites:

1. **Extension Timeout Tests**: Verify timeout behavior for all extension operations
2. **Extension Auth Tests**: Test authentication flow and session management
3. **PDF Parsing Tests**: Validate PDF parsing functionality
4. **Fuzzy Matching Tests**: Test resume bullet synchronization

Run tests with:
```bash
node scripts/test-extension-timeouts.js
node scripts/test-extension-auth-endpoints.js
npm run test:pdf
```

## Deployment

### Production Build

```bash
npm run build
npm run start
```

### Environment Variables for Production

Ensure these are set in your production environment:
- `DATABASE_URL`
- `OPENAI_API_KEY`
- `NEXTAUTH_SECRET`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_WEBHOOK_ENDPOINT_ID`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

### Database Migrations

Run migrations before deploying:
```bash
npx prisma migrate deploy
```

## Contributing

Contributions are welcome! Please follow these guidelines:

1. Create a feature branch (`git checkout -b feature/amazing-feature`)
2. Commit changes with clear messages (`git commit -m 'feat: add amazing feature'`)
3. Push to branch (`git push origin feature/amazing-feature`)
4. Open a Pull Request

### Code Style

- Use 2-space indentation
- Prefer TypeScript over JavaScript
- Write descriptive commit messages
- Add JSDoc comments for public functions
- Follow the existing code organization patterns

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support, email support@autojobs.dev or open an issue on GitHub.

## Roadmap

- [ ] Batch resume tailoring
- [ ] Custom resume templates
- [ ] Job application tracking
- [ ] Resume version history
- [ ] Collaboration features
- [ ] Mobile app
- [ ] Webhook integrations

---

**Version**: 1.0.0  
**Last Updated**: March 2026  
**Maintainers**: AutoJobs Team
