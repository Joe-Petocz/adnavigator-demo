# Railway Deployment Guide for AdNavigator Demo

## Quick Start

### 1. Deploy to Railway

**Option A: Using Railway Dashboard (Recommended)**
1. Go to [railway.app](https://railway.app)
2. Click "New Project" → "Deploy from GitHub repo"
3. Select or connect this repository
4. Railway will auto-detect it as a Node.js/Vite project

**Option B: Using Railway CLI**
```bash
# Install Railway CLI (if not installed)
npm i -g @railway/cli

# Login to Railway
railway login

# Initialize project
railway init

# Deploy
railway up
```

### 2. Configure Environment Variables

In Railway Dashboard:
1. Go to your project → "Variables" tab
2. Add the following variable:
   - **Variable Name**: `VITE_OPENAI_API_KEY`
   - **Value**: Copy from your local `.env.local` file (starts with `sk-proj-...`)
3. Click "Redeploy" after adding variables

> **Security Note**: Never commit API keys to Git. Keep them in Railway's environment variables only.

### 3. Set Up Custom Domain (demo.adnavigator.app)

**In Railway Dashboard:**
1. Go to your project → "Settings" tab
2. Scroll to "Domains" section
3. Click "Add Domain" → "Custom Domain"
4. Enter: `demo.adnavigator.app`
5. Railway will provide you with DNS records

**In Namecheap Dashboard:**
1. Go to Domain List → Manage `adnavigator.app`
2. Click "Advanced DNS" tab
3. Add a CNAME record:
   - **Type**: CNAME Record
   - **Host**: demo
   - **Value**: [the value provided by Railway, typically something like `xxx.up.railway.app`]
   - **TTL**: Automatic

**OR** Add A record if Railway provides IP:
   - **Type**: A Record
   - **Host**: demo
   - **Value**: [IP address from Railway]
   - **TTL**: Automatic

4. Save changes
5. Wait 5-30 minutes for DNS propagation

### 4. Verify Deployment

Once DNS propagates:
- Visit: https://demo.adnavigator.app
- Test the full demo flow:
  1. Enter business details
  2. Wait for AI analysis
  3. Review brand report
  4. View creative assets
  5. Check pricing page

## Build Configuration

The project uses:
- **Node.js**: v20
- **Build Command**: `npm run build`
- **Start Command**: `npm run preview -- --host 0.0.0.0 --port $PORT`
- **Output Directory**: `dist/`

## Troubleshooting

### Build Fails
- Check that all dependencies are in package.json
- Verify Node version is 18+ in Railway settings

### Environment Variables Not Working
- Ensure variable name starts with `VITE_` (required for Vite)
- Redeploy after adding/changing variables
- Check Railway logs for errors

### Custom Domain Not Working
- Verify DNS records in Namecheap
- Use `dig demo.adnavigator.app` to check DNS propagation
- Wait up to 48 hours for full DNS propagation (usually faster)

### App Won't Start
- Check Railway logs in dashboard
- Verify PORT environment variable is being used
- Ensure preview command includes `--host 0.0.0.0`

## Next Steps (Phase 2)

After demo is live and tested:
- Add Facebook App credentials for actual ad deployment
- Configure additional environment variables for Facebook integration
- Test full deployment flow with real Facebook account
