# Vercel Configuration for GRNDS Web App

Since you already have `grnds.xyz` deployed with static files and API routes, you need to configure Vercel to also serve the Next.js app from the `web/` directory.

## Option 1: Separate Vercel Project (Recommended)

Deploy the Next.js app as a **separate Vercel project** on the same domain:

1. **Create New Project in Vercel**
   - Go to https://vercel.com/dashboard
   - Click "Add New" → "Project"
   - Import your GitHub repository (ValorantBot)

2. **Configure Project Settings**
   - **Root Directory**: `web` (IMPORTANT!)
   - **Framework Preset**: Next.js (auto-detected)
   - **Build Command**: `npm run build` (auto-filled)
   - **Output Directory**: `.next` (auto-filled)
   - **Install Command**: `npm install` (auto-filled)

3. **Environment Variables**
   Add these in Project Settings → Environment Variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   NEXT_PUBLIC_APP_URL=https://grnds.xyz
   ```

4. **Deploy**
   - Click "Deploy"
   - Wait for build to complete

5. **Custom Domain Setup**
   - Go to Project Settings → Domains
   - Add `grnds.xyz` as a custom domain
   - Vercel will configure the domain automatically
   - **Note**: Vercel will handle routing - static files and API routes will work from the main project, Next.js routes will work from this project

## Option 2: Monorepo Configuration (Advanced)

If you want everything in one Vercel project, you need to configure it for monorepo:

1. **Go to Project Settings**
   - Vercel Dashboard → Your Project → Settings → General

2. **Update Root Directory**
   - Change **Root Directory** from `(none)` to `web`
   - This tells Vercel to treat the `web/` directory as the root

3. **Update Build Settings**
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`
   - **Install Command**: `npm install`

4. **Add Environment Variables**
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   NEXT_PUBLIC_APP_URL=https://grnds.xyz
   ```

5. **Handle Static Files**
   - Your static HTML files (welcome.html, leaderboard.html) are in `public/`
   - You may need to move them or configure rewrites
   - Or serve them via API routes (which you're already doing)

6. **Deploy**
   - Push to GitHub or trigger a redeploy
   - Vercel will rebuild with the new configuration

**Note**: This approach requires adjusting your file structure or API routes to work with the new root directory.

## Recommended: Option 1 (Separate Projects)

For the cleanest setup, use **Option 1**:
- Keep your existing Vercel project for static files and API routes
- Create a separate Vercel project for the Next.js app
- Both can use the same domain `grnds.xyz` - Vercel handles routing automatically

The Next.js app will handle routes like:
- `/dashboard`
- `/season`
- `/leaderboard` (if you want to replace the static one)
- `/profile/[userId]`
- `/auth/login`

Your existing routes will continue to work:
- `/welcome` → API route
- `/leaderboard` → API route (or use Next.js version)
- `/api/*` → API functions

## After Deployment

Once the Next.js app is deployed:
1. Test all routes: `/dashboard`, `/season`, `/leaderboard`, `/profile/[userId]`
2. Verify the welcome page link to `/dashboard` works
3. Check that environment variables are set correctly
4. Test comment submission (requires Discord OAuth setup)

## Troubleshooting

**404 on `/dashboard`**:
- Make sure the Next.js project is deployed
- Check that root directory is set to `web`
- Verify build succeeded in Vercel dashboard
- Check deployment logs for errors

**Environment variables not working**:
- Make sure they start with `NEXT_PUBLIC_` for client-side access
- Redeploy after adding env vars
- Check that values are correct in Vercel dashboard

**Routes not working**:
- Verify Next.js build succeeded
- Check that `web/app/` directory structure is correct
- Look at Vercel deployment logs for routing issues
