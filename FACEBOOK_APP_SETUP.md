# Facebook App Setup Guide

## Issue: SDK Error in Facebook Login Popup

When the Facebook login popup appears, it shows an SDK-related error. This happens because the Facebook App (ID: `853455260538900`) needs to be configured to allow your domain.

## Fix This in Facebook Developer Console

### 1. Go to Facebook App Settings

1. Visit: https://developers.facebook.com/apps/853455260538900/settings/basic/
2. Login with your Facebook account

### 2. Add App Domain

Scroll down to **"App Domains"** and add:
```
demo.adnavigator.app
```

Click **"Add Domain"** and then **"Save Changes"**

### 3. Configure OAuth Redirect URIs

1. In the left sidebar, click **"Facebook Login"** → **"Settings"**
2. Under **"Valid OAuth Redirect URIs"**, add:
   ```
   https://demo.adnavigator.app/
   ```
3. Click **"Save Changes"**

### 4. Set Site URL (if required)

1. Scroll down to **"Site URL"**
2. Enter:
   ```
   https://demo.adnavigator.app
   ```
3. Click **"Save Changes"**

### 5. Make App Live (if in Development Mode)

1. At the top of the page, check if there's a toggle or button that says **"Development"**
2. If the app is in Development mode, you need to either:
   - **Switch to Live Mode** (requires app review for production)
   - **OR Add Test Users** (for testing without app review)

#### Option A: Add Test Users (Recommended for Testing)

1. Go to: https://developers.facebook.com/apps/853455260538900/roles/test-users/
2. Click **"Add"**
3. Add the Facebook accounts that need to test the login
4. Those users can now use the Facebook login without the app being live

#### Option B: Make App Live (Requires App Review)

1. You'll need to submit the app for Facebook review
2. This takes several days and requires specific permissions
3. Only do this when ready for production

## Expected Result

After completing these steps:

1. Visit: https://demo.adnavigator.app/
2. Fill out the demo form
3. Click to connect Facebook
4. The Facebook login popup should now work without SDK errors
5. You should see the standard Facebook permissions dialog

## Common Error Messages

### "App Not Set Up: This app is still in development mode"
- **Fix:** Add yourself as a test user (Option A above)

### "Can't Load URL: The domain of this URL isn't included in the app's domains"
- **Fix:** Add `demo.adnavigator.app` to App Domains (Step 2 above)

### "URL Blocked: This redirect failed because the redirect URI is not whitelisted"
- **Fix:** Add redirect URI to OAuth settings (Step 3 above)

## Verify Settings Are Correct

After making changes:

1. Clear your browser cache and cookies for `demo.adnavigator.app`
2. Try the Facebook login again
3. The SDK error should be gone

## Need Help?

If you still see SDK errors after these steps:

1. Check the browser console for the exact error message
2. Make sure you clicked **"Save Changes"** after each setting
3. Try in an incognito/private browser window
4. Verify the App ID in the Facebook console matches: `853455260538900`

---

**Note:** The code is working perfectly. The Facebook SDK is initializing correctly with the App ID. This is purely a Facebook App configuration issue on the Facebook Developer side.
