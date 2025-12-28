# Railway Environment Variables Setup

## CRITICAL: Set These Environment Variables in Railway Dashboard

For the Facebook integration to work, you **MUST** set these environment variables in the Railway dashboard **BEFORE** deploying:

### Required Environment Variables

**⚠️ IMPORTANT: Get actual values from your local `.env.local` file**

1. **VITE_OPENAI_API_KEY**
   - Get from: https://platform.openai.com/api-keys
   - Format: `sk-proj-...`
   - Copy from `.env.local` file in project root

2. **VITE_FACEBOOK_APP_ID**
   - Get from: https://developers.facebook.com/apps/
   - Copy from `.env.local` file in project root

3. **VITE_FACEBOOK_APP_SECRET**
   - Get from: https://developers.facebook.com/apps/
   - Copy from `.env.local` file in project root

## How to Set Environment Variables in Railway

1. Go to your Railway project dashboard
2. Click on your service
3. Go to the **"Variables"** tab
4. Click **"New Variable"**
5. Add each variable:
   - **Variable name**: `VITE_FACEBOOK_APP_ID`
   - **Value**: (paste value from your `.env.local` file)
6. Repeat for all three variables above
7. Click **"Deploy"** or trigger a redeploy

## Important Notes

- ⚠️ **These variables are baked into the build** - Railway must have them set BEFORE building
- ⚠️ **After adding/changing variables, you MUST redeploy** for changes to take effect
- ✅ Variables starting with `VITE_` are exposed to the browser (this is intentional for Vite)
- ✅ Railway automatically passes environment variables to Docker builds

## Verification

After deployment, check if variables are loaded:
1. Visit: https://demo.adnavigator.app/
2. Open browser console (F12)
3. Try to connect Facebook - you should NOT see "Facebook App ID not configured" error
4. If you still see the error, check Railway logs to verify env vars were available during build

## Troubleshooting

### "Facebook App ID not configured" error in browser
**Cause**: Environment variables weren't available during the build step
**Solution**:
1. Verify variables are set in Railway dashboard
2. Trigger a new deployment (don't just restart)
3. Check Railway build logs for "Build-time environment check"

### Variables not showing in Railway
**Cause**: You might be looking at the wrong service or environment
**Solution**: Make sure you're in the correct project and service

### Build succeeds but app doesn't work
**Cause**: Variables might be set but misspelled
**Solution**: Double-check variable names match exactly (case-sensitive)
