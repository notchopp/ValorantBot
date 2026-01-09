# Deploy Web App to Vercel (grnds.xyz)

## Quick Deployment Steps

### Option 1: Deploy via Vercel Dashboard (Recommended)

1. **Go to Vercel Dashboard**
   - Visit https://vercel.com/dashboard
   - Click "Add New" → "Project"

2. **Import Repository**
   - Select your GitHub repository (ValorantBot)
   - Or connect your repository if not already connected

3. **Configure Project Settings**
   - **Root Directory**: Set to `web` (IMPORTANT!)
   - **Framework Preset**: Next.js (should auto-detect)
   - **Build Command**: `npm run build` (auto-filled)
   - **Output Directory**: `.next` (auto-filled)
   - **Install Command**: `npm install` (auto-filled)

4. **Environment Variables**
   Add these in Vercel dashboard → Settings → Environment Variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   NEXT_PUBLIC_APP_URL=https://grnds.xyz
   ```

5. **Deploy**
   - Click "Deploy"
   - Wait for build to complete
   - Your app will be live at a Vercel URL

6. **Custom Domain Setup**
   - Go to Project Settings → Domains
   - Add `grnds.xyz`
   - Follow DNS configuration instructions
   - Vercel will automatically configure SSL

### Option 2: Deploy via Vercel CLI

1. **Install Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **Login**
   ```bash
   vercel login
   ```

3. **Navigate to web directory**
   ```bash
   cd web
   ```

4. **Deploy**
   ```bash
   vercel
   ```

5. **Set Environment Variables**
   ```bash
   vercel env add NEXT_PUBLIC_SUPABASE_URL
   vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
   vercel env add NEXT_PUBLIC_APP_URL
   ```

6. **Production Deploy**
   ```bash
   vercel --prod
   ```

7. **Link Custom Domain**
   ```bash
   vercel domains add grnds.xyz
   ```

## Important Configuration

### Root Directory Must Be `web`

When deploying, make sure to set the **Root Directory** to `web` in Vercel project settings. This tells Vercel where your Next.js app is located.

### Environment Variables Required

These must be set in Vercel:
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon/public key
- `NEXT_PUBLIC_APP_URL` - Your app URL (https://grnds.xyz)

### After Deployment

Once deployed, your routes will be available at:
- `https://grnds.xyz/` - Landing page
- `https://grnds.xyz/dashboard` - Dashboard
- `https://grnds.xyz/season` - Season view
- `https://grnds.xyz/leaderboard` - Leaderboard
- `https://grnds.xyz/profile/[userId]` - Profile pages
- `https://grnds.xyz/auth/login` - Login page
- `https://grnds.xyz/api/comments` - Comment API

## Troubleshooting 404 Errors

If you see 404 errors after deployment:

1. **Check Root Directory**
   - Project Settings → General → Root Directory must be `web`

2. **Check Build Logs**
   - Vercel Dashboard → Deployments → Click on deployment → View Build Logs
   - Look for any build errors

3. **Verify Routes Exist**
   - Check that `web/app/dashboard/page.tsx` exists
   - Check that `web/app/season/page.tsx` exists
   - etc.

4. **Check Environment Variables**
   - Make sure all required env vars are set
   - Redeploy after adding env vars

5. **Clear Build Cache**
   - Project Settings → General → Clear Build Cache
   - Redeploy

## Production Checklist

- [ ] Root directory set to `web`
- [ ] Environment variables configured
- [ ] Build succeeds without errors
- [ ] Custom domain configured (grnds.xyz)
- [ ] SSL certificate active
- [ ] Test all routes:
  - [ ] `/` (landing page)
  - [ ] `/dashboard`
  - [ ] `/season`
  - [ ] `/leaderboard`
  - [ ] `/profile/[userId]`
  - [ ] `/auth/login`

## Quick Deploy Command

Once Vercel CLI is set up, you can deploy from the repo root:

```bash
cd web && vercel --prod && cd ..
```
