# AutoJobs Production Deployment Guide

Complete step-by-step instructions for deploying AutoJobs to production.

---

## Prerequisites

- GitHub repository with code pushed
- Vercel account (free tier works)
- Stripe account with production keys
- Google Cloud Console for OAuth credentials
- PostgreSQL database provider (e.g., Railway, Neon, Supabase)
- Chrome Web Store Developer account (for extension publishing)

---

## 1. Database Setup (PostgreSQL)

### Option A: Railway (Recommended - Simple)

1. **Create Railway Account**
   - Go to https://railway.app
   - Sign up with GitHub
   - Create new project

2. **Add PostgreSQL**
   - Click "+ Create"
   - Select "PostgreSQL"
   - Railway creates a database automatically

3. **Get Connection String**
   - In Railway dashboard, click PostgreSQL service
   - Copy the connection URL from "Connect" tab
   - It looks like: `postgresql://user:pass@host:port/db`

4. **Run Database Migrations**
   ```bash
   # Set environment variable temporarily
   export DATABASE_URL="postgresql://user:pass@host:port/db"
   
   # Run Prisma migrations
   npm run migrate
   ```

### Option B: Neon (Also Simple)

1. **Create Neon Account**
   - Go to https://neon.tech
   - Sign up with GitHub
   - Create new project

2. **Get Connection String**
   - Copy the connection string from project settings
   - Format: `postgresql://user:password@host/database`

3. **Run Migrations**
   - Same as Option A above

### Option C: Supabase (PostgreSQL + Auth)

1. **Create Supabase Project**
   - Go to https://supabase.com
   - Create new project
   - Select PostgreSQL

2. **Get Connection String**
   - Go to Project Settings > Database
   - Copy connection string from "URI" section
   - Use the "Connection pooling" URL for serverless

3. **Run Migrations**
   - Same as Option A above

---

## 2. Google OAuth Setup

### Create Google OAuth Credentials

1. **Go to Google Cloud Console**
   - https://console.cloud.google.com
   - Create a new project or use existing

2. **Enable OAuth 2.0**
   - Search "APIs & Services" in search bar
   - Click "APIs & Services"
   - Click "OAuth consent screen"
   - Select "External" user type
   - Fill in app name: "AutoJobs"
   - Add your email as developer contact

3. **Create OAuth 2.0 Credentials**
   - Click "Credentials" tab
   - Click "+ CREATE CREDENTIALS"
   - Select "OAuth client ID"
   - Choose "Web application"
   - Add authorized redirect URIs:
     - `https://your-domain.com/api/auth/callback/google`
     - `http://localhost:3000/api/auth/callback/google` (for testing)
   - Click Create
   - Copy **Client ID** and **Client Secret**

4. **Save Credentials**
   - Note down:
     - `AUTH_GOOGLE_ID` = Client ID
     - `AUTH_GOOGLE_SECRET` = Client Secret

---

## 3. Stripe Setup

### Create Stripe Production Account

1. **Go to Stripe Dashboard**
   - https://dashboard.stripe.com
   - Already have account? Sign in
   - Otherwise, create account

2. **Get Production API Keys**
   - Go to Developers > API keys
   - Copy **Publishable key** (starts with `pk_live_`)
   - Copy **Secret key** (starts with `sk_live_`)
   - Save these securely

3. **Get Webhook Signing Secret**
   - Go to Developers > Webhooks
   - Click "Add endpoint"
   - Enter endpoint URL: `https://your-domain.com/api/webhooks/stripe`
   - Select events to listen for:
     - `payment_intent.succeeded`
     - `charge.refunded`
     - `customer.subscription.updated`
   - Click "Add endpoint"
   - Copy the **Signing secret** (starts with `whsec_`)

4. **Create Products in Stripe**
   - Go to Billing > Products
   - Create product "Additional Credits"
   - Set price: $5 for 25 credits (or your pricing)
   - Note the **Product ID** (starts with `prod_`)
   - Note the **Price ID** (starts with `price_`)

5. **Save Stripe Credentials**
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` = Publishable key
   - `STRIPE_SECRET_KEY` = Secret key
   - `STRIPE_WEBHOOK_SECRET` = Webhook signing secret

---

## 4. Vercel Deployment

### Deploy Next.js App to Vercel

1. **Connect GitHub Repository**
   - Go to https://vercel.com
   - Click "Add New..." > "Project"
   - Select your GitHub repository
   - Authorize Vercel to access GitHub

2. **Configure Build Settings**
   - Framework: "Next.js"
   - Root Directory: "./" (or detect automatically)
   - Build Command: `npm run build`
   - Output Directory: ".next"
   - Install Command: `npm install`

3. **Add Environment Variables**
   - In Vercel project settings, go to "Environment Variables"
   - Add all variables from section 5 below
   - Make sure to set for all environments (Production, Preview, Development)

4. **Deploy**
   - Click "Deploy"
   - Wait for build to complete (5-10 minutes)
   - Get your production URL (e.g., `https://autojobs-xyz.vercel.app`)

5. **Update OAuth Redirect URI**
   - Go back to Google Cloud Console
   - Update authorized redirect URI to match Vercel URL:
     - `https://your-vercel-domain.vercel.app/api/auth/callback/google`

---

## 5. Environment Variables

### Complete Environment Variables Template

Create `.env.local` file locally with all values. In Vercel, add to "Environment Variables" dashboard:

```bash
# Database
DATABASE_URL="postgresql://user:password@host:port/database"

# Authentication
AUTH_SECRET="your-random-secret-key-32-chars-min"
AUTH_GOOGLE_ID="your-google-client-id"
AUTH_GOOGLE_SECRET="your-google-client-secret"

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_live_..."
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
STRIPE_PRICE_ID="price_..."

# OpenAI
OPENAI_API_KEY="sk-..."

# Extension Configuration
CHROME_EXTENSION_ID="your-extension-id-from-chrome-web-store"
ALLOWED_ORIGINS="chrome-extension://your-extension-id,https://your-domain.com"
VITE_BACKEND_URL="https://your-vercel-domain.vercel.app"

# Application
NODE_ENV="production"
NEXTAUTH_URL="https://your-vercel-domain.vercel.app"
NEXTAUTH_SECRET="your-random-secret-key-32-chars-min"
```

### Generate AUTH_SECRET and NEXTAUTH_SECRET

```bash
# Run this command to generate a secure random secret
openssl rand -base64 32
```

Or use Node.js:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 6. Update Extension for Production

### Update Extension Configuration

1. **Modify `extension/shared/config.js`**
   ```javascript
   export const BACKEND_URL = 
     typeof window !== "undefined" && window.__BACKEND_URL__ 
       ? window.__BACKEND_URL__
       : "https://your-vercel-domain.vercel.app"; // Update this
   ```

2. **Update `extension/manifest.json`**
   ```json
   {
     "host_permissions": [
       "https://your-domain.com/*"
     ],
     "oauth2": {
       "client_id": "your-oauth-client-id.apps.googleusercontent.com",
       "scopes": ["email"]
     }
   }
   ```

3. **Build Extension**
   ```bash
   npm run build:extension
   ```

### Publish to Chrome Web Store

1. **Create Developer Account**
   - Go to https://chrome.google.com/webstore/developer/dashboard
   - Pay $5 one-time registration fee
   - Agree to terms

2. **Upload Extension**
   - Click "New item"
   - Upload the built extension ZIP file
   - Fill in details:
     - Name: "AutoJobs - Resume Tailoring"
     - Description: "Automatically tailor resumes to job applications"
     - Category: "Productivity"
     - Upload screenshots and store images

3. **Submit for Review**
   - Review should take 1-3 days
   - Once approved, note your **Extension ID**

4. **Update CORS in Production**
   - Get the Extension ID from Chrome Web Store
   - Update `ALLOWED_ORIGINS` and `CHROME_EXTENSION_ID` in Vercel environment variables
   - Redeploy (push to GitHub or manual redeploy in Vercel)

---

## 7. Verification Checklist

Before going live, verify:

- [ ] Database migrations ran successfully
- [ ] Vercel deployment successful (check build logs)
- [ ] Authentication works (test sign-in with Google)
- [ ] API endpoints respond (test `/api/auth/session`)
- [ ] CORS headers correct (check browser DevTools > Network)
- [ ] Stripe webhooks working (test payment flow)
- [ ] Extension can reach backend (check `/api/extension/token`)
- [ ] All environment variables set in Vercel
- [ ] HTTPS enforced (check `next.config.ts`)
- [ ] Error logging working (check Vercel logs)

---

## 8. First-Time Setup Testing

### Test Authentication Flow

```bash
# 1. Open production URL
https://your-vercel-domain.vercel.app

# 2. Click "Sign in with Google"
# 3. Complete Google OAuth flow
# 4. Check dashboard loads
# 5. Verify credits display correctly
```

### Test Extension Integration

```bash
# 1. Load extension locally (Chrome Dev Mode)
# 2. Open extension popup
# 3. Verify backend URL is correct
# 4. Click "Get Token" (should trigger auth if needed)
# 5. Verify token returned successfully
```

### Test Stripe Payment

```bash
# 1. Go to dashboard > Buy Credits
# 2. Click "Upgrade Credits"
# 3. Use test card: 4242 4242 4242 4242
# 4. Enter any future expiration and CVC
# 5. Verify payment succeeds
# 6. Check credits updated
```

---

## 9. Monitoring & Maintenance

### Set Up Monitoring

1. **Vercel Analytics**
   - Enable in Vercel dashboard > Settings > Analytics
   - View real-time traffic and errors

2. **Database Backups**
   - Railway: Automatic daily backups
   - Neon: Automatic daily backups
   - Supabase: Automatic daily backups
   - Check provider dashboard for restore options

3. **Stripe Monitoring**
   - Check Stripe dashboard > Events
   - Monitor failed payments and webhook issues

4. **Application Logs**
   - Vercel: Deployment > Logs
   - Check for errors and warnings
   - Database: Provider dashboard logs

### Regular Maintenance

- Monitor error rates weekly
- Check Stripe webhook delivery monthly
- Update dependencies (npm update)
- Review database backup status

---

## 10. Troubleshooting

### Common Issues

**"AUTH_SECRET is not set" Error**
- Solution: Add `AUTH_SECRET` to Vercel environment variables
- Verify it's set for Production environment
- Redeploy application

**CORS Errors on Extension**
- Check `ALLOWED_ORIGINS` includes extension ID
- Verify `CHROME_EXTENSION_ID` is correct
- Check next.config.ts headers configuration

**"Unauthorized" on Token Endpoint**
- Verify Google OAuth credentials are correct
- Check `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` in Vercel
- Test sign-in flow on web dashboard first

**Stripe Payment Fails**
- Verify `STRIPE_SECRET_KEY` is live key (starts with `sk_live_`)
- Check `STRIPE_PRICE_ID` exists in Stripe
- Test with Stripe test mode first

**Database Connection Error**
- Verify `DATABASE_URL` is correct
- Check database is running and accessible
- Test connection locally before deploying
- Verify IP whitelist if database has restrictions

---

## 11. Rollback Plan

If something breaks in production:

1. **Immediate Rollback**
   - Go to Vercel > Deployments
   - Click the previous successful deployment
   - Click "Promote to Production"

2. **Investigate Issue**
   - Check Vercel logs for errors
   - Check database status
   - Check Stripe dashboard

3. **Fix and Redeploy**
   - Fix issue in code
   - Push to GitHub
   - Vercel auto-redeploys
   - Verify fixes work

---

## Next Steps

1. Follow sections 1-6 above to set up all services
2. Run verification checklist in section 7
3. Test flows in section 8
4. Monitor application as described in section 9

For questions or issues, check error logs in:
- **Vercel**: Deployment > Logs
- **Database Provider**: Dashboard logs
- **Stripe**: Events page
- **Browser**: DevTools > Network & Console tabs

Good luck with your deployment! 🚀
