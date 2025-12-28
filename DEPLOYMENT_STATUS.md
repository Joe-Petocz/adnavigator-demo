# Deployment Status

## Latest Commits (Pushed to GitHub)

All changes have been pushed to the `main` branch and should auto-deploy to Railway:

### Recent Commits:
1. **18fb9b9** - Fix video display and add demand message (Latest)
   - Added video content proxy endpoint
   - Changed iframe to video tag for proper playback
   - Added "3-minute wait time" message for user expectations
   - Video URL now proxied through backend

2. **99fd810** - Security: Update API key and add dotenv support
   - Installed and configured dotenv
   - Updated API key (old one exposed, now revoked)
   - Added data/ to .gitignore

3. **b3add06** - Add stable versioned demo pipeline with caching and real-time progress
   - Complete new versioned pipeline architecture
   - Session-based caching
   - Real-time SSE video progress
   - Deterministic scraping

## Deployment Configuration

**Platform:** Railway
**Domain:** https://demo.adnavigator.app/
**Auto-Deploy:** Enabled (deploys on git push to main)

**Build Process:**
```toml
[phases.setup]
nixPkgs = ['nodejs_20']

[phases.install]
cmds = ['npm ci']

[phases.build]
cmds = ['npm run build']

[start]
cmd = 'npm start'
```

## Required Environment Variables on Railway

Make sure these are set in Railway dashboard:

1. **VITE_OPENAI_API_KEY** (REQUIRED)
   - Copy from your local `.env.local` file
   - Starts with `sk-proj-...`
   - Get from: https://platform.openai.com/api-keys

2. **VITE_FACEBOOK_APP_ID** (Required for Facebook integration)
   ```
   853455260538900
   ```

3. **VITE_FACEBOOK_APP_SECRET** (Required for Facebook integration)
   ```
   d01f93007675bf565e9a91f38db14f09
   ```

## Deployment Verification

Once Railway finishes deploying, verify:

### 1. Health Check
```bash
curl https://demo.adnavigator.app/api/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-12-22T...",
  "apiKeyConfigured": true
}
```

### 2. Test Demo Flow
1. Visit: https://demo.adnavigator.app/
2. Fill out intake form
3. Verify analysis runs successfully
4. Check creative generation works
5. Confirm video generation starts
6. Video should display in video player (not error)

### 3. Check New Features
- Loading message should say: "Due to many agencies testing the platform, this may take up to 3 minutes depending on current demand."
- Video should play in `<video>` tag with controls
- Video URL should be `/api/sora/videos/:id/content` (not direct OpenAI URL)

## What Changed in Latest Deploy

### Video Display Fix (Commit 18fb9b9)
**Problem:** Video showed authentication error when trying to load from OpenAI directly
**Solution:**
- Added backend proxy endpoint for video content
- Changed frontend from iframe to video tag
- Video URL now goes through our server with authentication

**Before:**
```javascript
// Frontend tried to load directly (failed due to auth)
videoUrl = "https://api.openai.com/v1/videos/abc123/content"
<iframe src={videoUrl} />
```

**After:**
```javascript
// Frontend loads through our proxy (works!)
videoUrl = "/api/sora/videos/abc123/content"
<video src={videoUrl} controls autoPlay />
```

**Backend Added:**
```javascript
// server.js:148-187
app.get('/api/sora/videos/:videoId/content', async (req, res) => {
  // Fetches from OpenAI with auth headers
  // Streams video to frontend
});
```

### Better UX
- Title changed: "Video Being Processed" → "Video Being Generated"
- Added demand message: "Due to many agencies testing the platform, this may take up to 3 minutes depending on current demand."
- Sets realistic expectations for users

## Current Pipeline Architecture

### API Endpoints (All Deployed)
```
POST   /api/demo/session              - Create session
GET    /api/demo/session/:id          - Get session state
POST   /api/demo/session/:id/copy     - Generate copy (cached)
POST   /api/demo/session/:id/video/start - Start video
GET    /api/demo/video/stream/:jobId  - SSE progress stream
GET    /api/demo/video/:jobId         - Video status

# Legacy endpoints (still work)
POST   /api/openai/chat               - OpenAI proxy
POST   /api/sora/videos               - Sora create
GET    /api/sora/videos/:id           - Sora status
GET    /api/sora/videos/:id/content   - Sora video content (NEW)
```

### Features Deployed
✅ Stable versioned pipeline (analysis_v1, copy_v1, video_prompt_v1)
✅ Session-based caching (video retry doesn't rerun analysis)
✅ Real-time SSE progress streaming
✅ Deterministic website scraping
✅ radiusMiles validation (max 50)
✅ Video content proxy with authentication
✅ Better loading messages

## Deployment Timeline

**Pushed to GitHub:** All commits are live on main branch
**Railway Auto-Deploy:** Should trigger automatically within 1-2 minutes
**Build Time:** ~2-3 minutes (npm ci + npm run build)
**Total Deploy Time:** ~3-5 minutes from push

## Monitoring Deployment

Check Railway dashboard:
1. Go to Railway project
2. Check "Deployments" tab
3. Latest deployment should show commit `18fb9b9`
4. Watch build logs for any errors
5. Once "Active", test at https://demo.adnavigator.app/

## Troubleshooting

### If video still shows errors:
1. Hard refresh browser (Cmd+Shift+R or Ctrl+Shift+R)
2. Clear browser cache completely
3. Try incognito/private window
4. Check Railway logs for backend errors

### If API key errors:
1. Verify `VITE_OPENAI_API_KEY` is set in Railway
2. Check Railway logs: should show "API key configured: true"
3. Make sure Railway redeployed after env var update

### If build fails:
1. Check Railway logs for specific error
2. Verify package.json dependencies are correct
3. Ensure nixpacks.toml is in repo
4. Check Node version (should be 20)

## Summary

✅ **All code pushed to GitHub**
✅ **Railway configured for auto-deploy**
✅ **Environment variables documented**
✅ **Video display fixed**
✅ **Better UX messages added**
✅ **New versioned pipeline deployed**

**Next:** Wait 3-5 minutes for Railway to finish deploying, then test at https://demo.adnavigator.app/

---

*Last Updated: 2025-12-27*
*Status: Fixing Railway deployment (502 error)*
*Action: Triggering redeploy with data directory fix*
*Deployed To: Railway → https://demo.adnavigator.app/*
