# Final Setup Steps - Facebook Integration Fix

## What's Been Fixed

✅ All code is working perfectly
✅ Local builds show Facebook App ID correctly
✅ All commits are on GitHub
✅ Vite config uses `loadEnv()` to read environment variables

## What's Missing

❌ Railway doesn't have environment variables set
❌ This is why the deployed site still shows the error

## How to Fix (Choose ONE option)

### Option A: Use Railway CLI (Fastest - 2 minutes)

1. **Login to Railway:**
   ```bash
   railway login
   ```
   This will open your browser to authenticate.

2. **Link to your project:**
   ```bash
   railway link
   ```
   Select your `adnavigator-demo` project.

3. **Run the setup script:**
   ```bash
   ./set-railway-vars.sh
   ```
   This will automatically:
   - Read values from `.env.local`
   - Set all 3 environment variables in Railway
   - Trigger a redeploy

4. **Wait 3-5 minutes** for Railway to rebuild and deploy.

5. **Verify it works:**
   ```bash
   curl -s https://demo.adnavigator.app/ | grep -o 'assets/index-[^"]*\.js'
   ```
   The filename should be different from `index-DGSs6h5K.js`

### Option B: Use Railway Dashboard (Manual - 5 minutes)

1. Go to: https://railway.app
2. Login and find `adnavigator-demo` project
3. Click on your service
4. Go to **"Variables"** tab
5. Add these 3 variables:

   **VITE_FACEBOOK_APP_ID**
   ```
   853455260538900
   ```

   **VITE_FACEBOOK_APP_SECRET**
   ```
   d01f93007675bf565e9a91f38db14f09
   ```

   **VITE_OPENAI_API_KEY**
   ```
   (copy the full key from .env.local - starts with sk-proj-)
   ```

6. Click **"Redeploy"** (not just Restart)
7. Wait 3-5 minutes for rebuild

## Verification

After Railway finishes deploying:

1. Visit: https://demo.adnavigator.app/
2. Open browser console (F12)
3. Fill out the demo form
4. When you reach Facebook connection:
   - Should see: `🔵 FB_APP_ID: 853455260538900`
   - Should NOT see: `❌ Facebook App ID not configured`

## Why This Happened

1. **Vite needs env vars at BUILD time** (not runtime)
2. Railway was building WITHOUT the environment variables
3. The JavaScript bundle was being created with `undefined` values
4. Even though `.env.local` exists locally, Railway doesn't have access to it
5. Railway needs variables set in its dashboard OR via CLI

## The Fix

- Changed `vite.config.js` to use `loadEnv()` ✅
- Now Vite properly reads `.env` files during build ✅
- Railway will create `.env` from dashboard variables ✅
- Facebook App ID will be baked into the bundle ✅

**All that's left is setting those 3 environment variables in Railway!**

## Need Help?

If you run into issues:

1. Check Railway build logs for "Build-time environment check"
2. Should show: `VITE_FACEBOOK_APP_ID: ✅ Set`
3. If it shows `❌ Missing`, the variables aren't set correctly
4. Make sure you triggered a **Redeploy** (not just Restart)

The code is 100% ready. Just need to set those env vars! 🚀
