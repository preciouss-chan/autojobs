# Backend Hosting Options for Auto Apply AI

Since your backend is a Next.js application, here are the best hosting options:

## Recommended Options

### 1. **Vercel** (Easiest & Best for Next.js) ⭐ RECOMMENDED
- **Why**: Made by the creators of Next.js, perfect integration
- **Free Tier**: Yes (generous)
- **Setup**: 
  1. Push code to GitHub
  2. Connect GitHub repo to Vercel
  3. Deploy automatically
- **Pros**: 
  - Zero config for Next.js
  - Automatic HTTPS
  - Global CDN
  - Free SSL
  - Easy custom domains
- **Cons**: 
  - Serverless functions have cold starts (but fine for your use case)
- **Cost**: Free for hobby projects, $20/month for Pro
- **Link**: https://vercel.com

### 2. **Railway**
- **Why**: Simple, good for Node.js apps
- **Free Tier**: Yes ($5 credit/month)
- **Setup**: 
  1. Connect GitHub repo
  2. Auto-detects Next.js
  3. Deploy
- **Pros**: 
  - Simple interface
  - Good free tier
  - Easy database add-ons
- **Cons**: 
  - Less Next.js optimized than Vercel
- **Cost**: Pay-as-you-go after free credit
- **Link**: https://railway.app

### 3. **Render**
- **Why**: Good free tier, simple deployment
- **Free Tier**: Yes (with limitations)
- **Setup**: 
  1. Connect GitHub
  2. Select Next.js template
  3. Deploy
- **Pros**: 
  - Free tier available
  - Simple setup
  - Auto-deploy from Git
- **Cons**: 
  - Free tier spins down after inactivity
  - Slower cold starts
- **Cost**: Free tier available, $7/month for always-on
- **Link**: https://render.com

### 4. **Fly.io**
- **Why**: Good for global distribution
- **Free Tier**: Yes (3 shared VMs)
- **Setup**: 
  1. Install flyctl CLI
  2. `fly launch`
  3. Deploy
- **Pros**: 
  - Global edge deployment
  - Good free tier
  - Docker-based
- **Cons**: 
  - More complex setup
  - CLI required
- **Cost**: Free tier, pay for additional resources
- **Link**: https://fly.io

### 5. **DigitalOcean App Platform**
- **Why**: Simple, reliable
- **Free Tier**: No
- **Setup**: 
  1. Connect GitHub
  2. Select Next.js
  3. Deploy
- **Pros**: 
  - Reliable infrastructure
  - Good documentation
  - Easy scaling
- **Cons**: 
  - No free tier
  - More expensive
- **Cost**: $5/month minimum
- **Link**: https://www.digitalocean.com/products/app-platform

## Quick Setup Guide (Vercel - Recommended)

1. **Prepare your code:**
   ```bash
   # Make sure your code is pushed to GitHub
   git add .
   git commit -m "Ready for deployment"
   git push
   ```

2. **Deploy to Vercel:**
   - Go to https://vercel.com
   - Sign up/login with GitHub
   - Click "New Project"
   - Import your GitHub repository
   - Vercel auto-detects Next.js
   - Click "Deploy"

3. **Update extension:**
   - After deployment, Vercel gives you a URL like: `https://your-app.vercel.app`
   - Update `BASE_URL` in `extension/background/background.js`:
     ```javascript
     const BASE_URL = "https://your-app.vercel.app";
     ```
   - Also update in `extension/popup/popup.js` and `extension/content/content-script.js`

4. **Environment Variables (if needed):**
   - In Vercel dashboard → Settings → Environment Variables
   - Add any env vars (though you're using user API keys now)

## Important Notes

### PDF Generation Issue ⚠️

Your backend uses **XeLaTeX** to generate PDFs, which requires:
- LaTeX installation on the server
- System fonts
- File system access

**Serverless platforms (Vercel, Netlify, etc.) DON'T support LaTeX** because:
- No shell access
- No system binaries
- Ephemeral file system

### Solutions:

1. **Use a VPS/VM** (Recommended for LaTeX):
   - **DigitalOcean Droplet** ($6/month)
   - **Linode** ($5/month)
   - **AWS EC2** (Free tier available)
   - **Google Cloud Compute Engine** (Free tier available)
   - Install LaTeX: `sudo apt-get install texlive-xetex`

2. **Switch to Serverless-Friendly PDF Generation**:
   - Use `@react-pdf/renderer` (client-side)
   - Use `pdfkit` (works on serverless)
   - Use `puppeteer` (works on some platforms like Railway)

3. **Hybrid Approach**:
   - Keep LaTeX on a VPS for PDF generation
   - Host API routes on Vercel
   - Call VPS for PDF generation

### CORS Configuration

Add to your Next.js `next.config.ts`:
```typescript
const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, X-OpenAI-API-Key' },
        ],
      },
    ];
  },
};
```

## Alternative: Serverless PDF Generation

Since LaTeX/XeLaTeX might not work on serverless platforms, consider:

1. **Use a PDF service API** (like PDFShift, HTML2PDF, etc.)
2. **Use Puppeteer** (works on some platforms, but heavy)
3. **Client-side PDF generation** (using jsPDF or similar)

Let me know which hosting option you prefer and I can help set it up!

