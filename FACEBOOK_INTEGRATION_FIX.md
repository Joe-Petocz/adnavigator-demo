# Facebook Integration Fix - Action Required

## Problem Summary

The Facebook integration shows `"Facebook App ID not configured"` because **Railway does not have the environment variables set in the dashboard**.

### What We Fixed

✅ Fixed `vite.config.js` to use `loadEnv()` - now properly reads env files
✅ Local builds now work perfectly with Facebook App ID
✅ Dockerfile is configured to use Railway env vars
✅ All code is pushed to GitHub

### What's Still Missing

❌ **Railway dashboard does not have environment variables set**
❌ This is why the deployed build doesn't have Facebook App ID
❌ This MUST be fixed manually in Railway dashboard

## Required Action: Set Railway Environment Variables

You need to login to Railway and set these 3 environment variables:

### Step 1: Login to Railway
1. Go to: https://railway.app
2. Login with your account
3. Find the `adnavigator-demo` project
4. Click on your service

### Step 2: Add Environment Variables
1. Click the **"Variables"** tab
2. Add these 3 variables (get values from `.env.local` file):

   **Variable 1:**
   - Name: `VITE_FACEBOOK_APP_ID`
   - Value: `853455260538900`

   **Variable 2:**
   - Name: `VITE_FACEBOOK_APP_SECRET`
   - Value: `d01f93007675bf565e9a91f38db14f09`

   **Variable 3:**
   - Name: `VITE_OPENAI_API_KEY`
   - Value: (copy from `.env.local` - starts with `sk-proj-`)

### Step 3: Trigger Redeploy
1. After adding all 3 variables, click **"Redeploy"**
2. **IMPORTANT**: Don't just "Restart" - you need a full "Redeploy" (rebuild)
3. Wait 3-5 minutes for the build to complete

## How to Verify It's Fixed

After Railway redeploys:

1. Visit: https://demo.adnavigator.app/
2. Open browser console (F12)
3. Fill out the demo form and proceed
4. When you get to the Facebook connection step:
   - You should NOT see: `"❌ Facebook App ID not configured"`
   - You SHOULD see: `"🔵 initFacebookSDK called"` and `"🔵 FB_APP_ID: 853455260538900"`

5. Check the build:
   ```bash
   curl -s https://demo.adnavigator.app/ | grep -o 'assets/index-[^"]*\.js'
   ```
   The filename should be different from `index-DGSs6h5K.js` (new build)

   Then check if Facebook ID is in the bundle:
   ```bash
   curl -s https://demo.adnavigator.app/assets/index-XXXXX.js | grep -c "853455260538900"
   ```
   Should return: `1` or higher (not `0`)

## Technical Details

### Why This Happens

1. **Vite requires env vars at BUILD time** (not runtime)
2. The Dockerfile creates a `.env` file using Railway's environment variables:
   ```dockerfile
   RUN echo "VITE_FACEBOOK_APP_ID=${VITE_FACEBOOK_APP_ID}" > .env
   ```
3. If Railway doesn't have `VITE_FACEBOOK_APP_ID` set, it creates:
   ```
   VITE_FACEBOOK_APP_ID=
   ```
   (empty value)
4. Vite then bakes this empty value into the JavaScript bundle
5. When the app runs, `import.meta.env.VITE_FACEBOOK_APP_ID` is `undefined`

### Why Local Works But Railway Doesn't

- **Local**: `.env.local` file exists with values → `loadEnv()` reads it → ✅ Works
- **Railway**: No `.env.local` file → Dockerfile creates `.env` from env vars → ❌ Fails if env vars not set in dashboard

## Alternative: Facebook Developer Console

If Railway env vars are set correctly but you still get errors, check the Facebook Developer Console:

1. Go to: https://developers.facebook.com/apps/853455260538900/settings/basic/
2. Check **App Domains**: Make sure `demo.adnavigator.app` is listed
3. Check **Website** under "Add Platform": Should have `https://demo.adnavigator.app`
4. Check **Valid OAuth Redirect URIs**: Should include `https://demo.adnavigator.app/`
5. Make sure the app is in **Live** mode (not Development)

## Summary

**The code is 100% fixed and working.**
**The ONLY remaining issue is setting environment variables in Railway dashboard.**
**Once you set those 3 env vars and redeploy, Facebook integration will work perfectly!**
