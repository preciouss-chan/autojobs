# API Documentation

## Overview

AutoJobs provides a comprehensive REST API for resume parsing, job analysis, resume tailoring, and PDF export. All endpoints require authentication (except for public endpoints marked as "Public") and return JSON responses.

## Authentication

All authenticated endpoints require either:
- **NextAuth Session Cookie**: For web clients
- **Extension Token**: For browser extension requests (via `/api/extension/token`)
- **Bearer Token**: `Authorization: Bearer <token>` header

### Getting an Extension Token

```bash
GET /api/extension/token
```

Returns:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 3600
}
```

## Endpoints

### Resume Operations

#### Parse Resume (PDF Upload)

Upload and parse a PDF resume to extract structured data.

**Request:**
```
POST /api/parse-resume
Content-Type: multipart/form-data

file: <PDF_FILE>
```

**Response (200):**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "555-1234",
  "summary": "Software engineer with 5 years experience...",
  "skills": ["JavaScript", "React", "Node.js"],
  "experience": [
    {
      "company": "Tech Corp",
      "title": "Senior Engineer",
      "startDate": "2020-01",
      "endDate": "2023-12",
      "description": "Led development of...",
      "bullets": ["Implemented feature X", "Improved performance by 40%"]
    }
  ],
  "projects": [
    {
      "name": "Project Name",
      "description": "Description",
      "startDate": "2022-01",
      "endDate": "2022-06",
      "bullets": ["Achievement 1", "Achievement 2"]
    }
  ]
}
```

**Response (400):**
```json
{
  "error": "Invalid PDF file",
  "details": "The uploaded file could not be parsed"
}
```

**Timeout:** 30 seconds  
**Rate Limit:** 10 requests per hour per user

---

#### Extract Job Requirements

Analyze a job description and extract key requirements.

**Request:**
```
POST /api/extract-requirements
Content-Type: application/json

{
  "jobDescription": "We are looking for a Senior React Developer with 5+ years experience..."
}
```

**Response (200):**
```json
{
  "title": "Senior React Developer",
  "seniority_level": "senior",
  "domain": "Frontend",
  "team_focus": "Web Development",
  "experience_years": 5,
  "required_skills": [
    "React",
    "TypeScript",
    "JavaScript",
    "CSS",
    "HTML"
  ],
  "nice_to_have_skills": [
    "Next.js",
    "GraphQL",
    "Jest"
  ],
  "required_tools_frameworks": [
    "Webpack",
    "npm",
    "Git"
  ],
  "key_responsibilities": [
    "Build responsive web applications",
    "Mentor junior developers",
    "Lead code reviews"
  ]
}
```

**Response (400):**
```json
{
  "error": "Invalid job description",
  "details": "Job description must be at least 50 characters"
}
```

**Timeout:** 15 seconds  
**Rate Limit:** 20 requests per hour per user

---

#### Tailor Resume

Generate a customized resume tailored to a specific job.

**Request:**
```
POST /api/tailor
Content-Type: application/json

{
  "resume": { /* Resume object from parse-resume */ },
  "jobDescription": "Full job description text...",
  "jobRequirements": { /* Job requirements object */ }
}
```

**Response (200):**
```json
{
  "tailored_summary": "Senior React engineer with 5 years of experience building scalable web applications...",
  "skills_to_add": {
    "technical": ["GraphQL", "Jest"],
    "soft": ["Team Leadership"]
  },
  "experience_modifications": {
    "new_bullets": [
      {
        "company": "Tech Corp",
        "original_bullet": "Improved performance",
        "suggested_bullet": "Improved application performance by 40% through code optimization"
      }
    ]
  },
  "cover_letter": "Dear Hiring Manager,\n\nI am excited to apply for the Senior React Developer position...",
  "match_score": 0.87,
  "missing_skills": ["Advanced TypeScript", "Testing frameworks"]
}
```

**Response (400):**
```json
{
  "error": "Validation failed",
  "details": "Resume, jobDescription, and jobRequirements are required"
}
```

**Timeout:** 30 seconds  
**Credits:** 10 credits per request

---

### Export Operations

#### Export PDF Resume

Export the tailored resume as a PDF file.

**Request:**
```
POST /api/export/pdf
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "555-1234",
  "summary": "...",
  "skills": ["..."],
  "experience": [/* ... */],
  "projects": [/* ... */]
}
```

**Response (200):**
```
Content-Type: application/pdf
Content-Disposition: attachment; filename="resume.pdf"

[Binary PDF data]
```

**Response (400):**
```json
{
  "error": "Invalid resume format",
  "details": "Resume must include at least name and contact information"
}
```

**Timeout:** 30 seconds  
**Credits:** 5 credits per request

---

#### Export Cover Letter

Export the generated cover letter as text.

**Request:**
```
POST /api/export/cover-letter
Content-Type: application/json

{
  "cover_letter": "Dear Hiring Manager...",
  "candidate_name": "John Doe",
  "company_name": "Tech Corp",
  "job_title": "Senior React Developer"
}
```

**Response (200):**
```
Content-Type: text/plain

Dear Hiring Manager,

I am excited to apply for the Senior React Developer position at Tech Corp...
```

**Response (400):**
```json
{
  "error": "Missing required fields",
  "details": "cover_letter and candidate_name are required"
}
```

**Timeout:** 10 seconds

---

### Chat Operations

#### Resume Assistant Chat

Send messages to the AI resume assistant for guidance and tips.

**Request:**
```
POST /api/chat
Content-Type: application/json

{
  "message": "How can I improve my resume for a frontend role?",
  "context": "Senior React Developer role at Tech Corp"
}
```

**Response (200):**
```json
{
  "response": "To improve your resume for a frontend role, focus on...",
  "suggestions": [
    "Highlight TypeScript skills",
    "Add performance optimization examples",
    "Include testing framework experience"
  ]
}
```

**Response (429):**
```json
{
  "error": "Rate limit exceeded",
  "details": "Too many requests. Please wait before trying again.",
  "retryAfter": 60
}
```

**Timeout:** 20 seconds  
**Rate Limit:** 30 requests per hour per user

---

### Credit Operations

#### Check Credit Balance

Get the current credit balance for the authenticated user.

**Request:**
```
GET /api/credits/balance
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "credits": 150,
  "used": 50,
  "remaining": 150,
  "lastUpdated": "2024-03-09T10:30:00Z",
  "nextRefresh": "2024-03-10T00:00:00Z"
}
```

**Response (401):**
```json
{
  "error": "Unauthorized",
  "details": "No valid authentication token provided"
}
```

---

#### Deduct Credits

Deduct credits for an operation (called automatically by endpoints that consume credits).

**Request:**
```
POST /api/credits/deduct
Content-Type: application/json
Authorization: Bearer <token>

{
  "operation": "tailor",
  "amount": 10
}
```

**Response (200):**
```json
{
  "success": true,
  "remainingCredits": 140,
  "operation": "tailor",
  "amountDeducted": 10
}
```

**Response (402):**
```json
{
  "error": "Insufficient credits",
  "details": "This operation requires 10 credits but you only have 5",
  "required": 10,
  "available": 5
}
```

---

### Extension Operations

#### Validate Extension Session

Verify that the extension session is still valid.

**Request:**
```
GET /api/extension/validate
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "valid": true,
  "userId": "user_123",
  "expiresAt": "2024-03-09T14:30:00Z",
  "credits": 120
}
```

**Response (401):**
```json
{
  "valid": false,
  "error": "Token expired",
  "expiresAt": "2024-03-09T10:30:00Z"
}
```

**Timeout:** 5 seconds

---

#### Extension Logout

Log out the extension and invalidate the session token.

**Request:**
```
POST /api/extension/logout
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "success": true,
  "message": "Extension session terminated"
}
```

**Response (401):**
```json
{
  "error": "Unauthorized",
  "details": "No valid token provided"
}
```

---

## Error Codes

| Code | Message | Description |
|------|---------|-------------|
| 400 | Bad Request | Invalid request parameters or missing required fields |
| 401 | Unauthorized | Authentication failed or token expired |
| 402 | Payment Required | Insufficient credits for operation |
| 404 | Not Found | Requested resource not found |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error occurred |
| 503 | Service Unavailable | OpenAI API temporarily unavailable |

## Rate Limiting

Rate limits are per-user and reset hourly:

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/api/parse-resume` | 10/hour | Hour |
| `/api/extract-requirements` | 20/hour | Hour |
| `/api/tailor` | 15/hour | Hour |
| `/api/chat` | 30/hour | Hour |
| `/api/export/pdf` | 50/hour | Hour |

Responses include rate limit headers:
```
X-RateLimit-Limit: 20
X-RateLimit-Remaining: 15
X-RateLimit-Reset: 1678440600
```

## Timeout Specifications

Operations have timeouts to prevent hanging requests:

| Operation | Timeout | Critical |
|-----------|---------|----------|
| Resume Parsing | 30s | Yes |
| Job Extraction | 15s | Yes |
| Resume Tailoring | 30s | Yes |
| Cover Letter | 30s | No |
| Chat | 20s | No |
| PDF Export | 30s | No |

## Response Format

All successful responses follow this format:

```json
{
  "success": true,
  "data": { /* Response data */ },
  "timestamp": "2024-03-09T10:30:00Z"
}
```

Error responses:

```json
{
  "success": false,
  "error": "Error code",
  "message": "Human readable error message",
  "details": "Additional details if available",
  "timestamp": "2024-03-09T10:30:00Z"
}
```

## Example Integration

### Using cURL

```bash
# Parse a resume
curl -X POST http://localhost:3000/api/parse-resume \
  -F "file=@resume.pdf"

# Extract job requirements
curl -X POST http://localhost:3000/api/extract-requirements \
  -H "Content-Type: application/json" \
  -d '{
    "jobDescription": "Senior React Developer with 5+ years..."
  }'

# Tailor resume
curl -X POST http://localhost:3000/api/tailor \
  -H "Content-Type: application/json" \
  -d '{
    "resume": { /* resume data */ },
    "jobDescription": "...",
    "jobRequirements": { /* requirements */ }
  }'
```

### Using JavaScript/Fetch

```javascript
// Parse resume
const formData = new FormData();
formData.append('file', resumeFile);

const parseResponse = await fetch('/api/parse-resume', {
  method: 'POST',
  body: formData
});
const resume = await parseResponse.json();

// Extract requirements
const requirementsResponse = await fetch('/api/extract-requirements', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    jobDescription: jobText
  })
});
const requirements = await requirementsResponse.json();

// Tailor resume
const tailorResponse = await fetch('/api/tailor', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    resume,
    jobDescription: jobText,
    jobRequirements: requirements
  })
});
const tailored = await tailorResponse.json();
```

## Webhook Endpoints

### Stripe Payment Webhook

Handles Stripe payment events for subscription management.

**Endpoint:** `POST /api/payments/webhook`

**Headers:**
```
Stripe-Signature: t=<timestamp>,v1=<signature>
```

**Events Handled:**
- `checkout.session.completed` - User completed payment
- `invoice.payment_succeeded` - Subscription payment processed
- `invoice.payment_failed` - Subscription payment failed
- `customer.subscription.updated` - Subscription modified
- `customer.subscription.deleted` - Subscription cancelled

---

**API Version:** 1.0  
**Last Updated:** March 2026  
**Base URL:** `https://autojobs.dev/api`
